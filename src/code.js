import fs from 'fs';
import path from 'node:path';
import os from 'node:os';

const REGS = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4, R5: 5, SP: 6 };
const CONDS = { Z: 0, NZ: 1, C: 2, NC: 3, N: 4 };

// operand kinds: r=register, i=#immediate, a=$addr, x=$addr + reg, c=condition
const SIZE = { r: 1, i: 4, a: 2, x: 3, c: 1 };

const INSTRUCTIONS = {
    LOAD: [
        { ops: 'ri', opcode: 0x00 },
        { ops: 'ra', opcode: 0x01 },
        { ops: 'rx', opcode: 0x02 },
    ],
    STOR: [
        { ops: 'ar', opcode: 0x03 },
        { ops: 'xr', opcode: 0x04 },
        { ops: 'ai', opcode: 0x05 },
    ],
    MOVE: [{ ops: 'rr', opcode: 0x06 }],
    SWAP: [{ ops: 'rr', opcode: 0x07 }],

    ADD: [
        { ops: 'ri', opcode: 0x08 },
        { ops: 'rr', opcode: 0x09 },
        { ops: 'ra', opcode: 0x0A },
    ],
    SUB: [
        { ops: 'ri', opcode: 0x0B },
        { ops: 'rr', opcode: 0x0C },
        { ops: 'ra', opcode: 0x0D },
    ],
    MUL: [
        { ops: 'ri', opcode: 0x0E },
        { ops: 'rr', opcode: 0x0F },
        { ops: 'ra', opcode: 0x10 },
    ],

    CMP: [
        { ops: 'ri', opcode: 0x11 },
        { ops: 'ra', opcode: 0x12 },
        { ops: 'rr', opcode: 0x13 },
    ],

    LOADB: [
        { ops: 'ra', opcode: 0x14 },
        { ops: 'rx', opcode: 0x15 },
    ],
    STORB: [
        { ops: 'ar', opcode: 0x16 },
        { ops: 'xr', opcode: 0x17 },
    ],

    // -- Jumps --
    JUMP: [
        { ops: 'a', opcode: 0x1A },
        { ops: 'x', opcode: 0x1B },
        { ops: 'r', opcode: 0x1C },
    ],
    JCON: [{ ops: 'ca', opcode: 0x1E }],

    PUSH: [
        { ops: 'r', opcode: 0x1F },
        { ops: 'i', opcode: 0x20 },
    ],
    POP: [{ ops: 'r', opcode: 0x21 }],
    CALL: [
        { ops: 'a', opcode: 0x22 },
        { ops: 'r', opcode: 0x23 },
    ],
    RET: [{ ops: '', opcode: 0x24 }],

    HALT: [{ ops: '', opcode: 0x25 }],
    NOP: [{ ops: '', opcode: 0x26 }],

    AND: [
        { ops: 'ri', opcode: 0x27 },
        { ops: 'rr', opcode: 0x28 },
        { ops: 'ra', opcode: 0x29 },
    ],
    OR: [
        { ops: 'ri', opcode: 0x2A },
        { ops: 'rr', opcode: 0x2B },
        { ops: 'ra', opcode: 0x2C },
    ],
    XOR: [
        { ops: 'ri', opcode: 0x2D },
        { ops: 'rr', opcode: 0x2E },
        { ops: 'ra', opcode: 0x2F },
    ],
    NOT: [{ ops: 'r', opcode: 0x30 }],

    SHL: [
        { ops: 'ri', opcode: 0x31 },
        { ops: 'rr', opcode: 0x32 },
    ],
    SHR: [
        { ops: 'ri', opcode: 0x33 },
        { ops: 'rr', opcode: 0x34 },
    ],

    OUT: [
        { ops: 'r', opcode: 0x35 },
        { ops: 'i', opcode: 0x36 },
    ],
    IN: [{ ops: 'r', opcode: 0x37 }],
    SYS: [{ ops: 'i', opcode: 0x38 }],
};

/*
0x01 RAND      out: R0 = 32-bit random number
0x02 TIME      out: R0 = unix time in seconds
0x03 SLEEP     in:  R0 = delay in milliseconds (cap is 10,000)
0x04 TICKS     out: R0 = milliseconds since VM start (wraps at 2^32)
0x05 DATETIME  in:  R0 = pointer to an 8-byte buffer, R1 = 0 local / 1 UTC
               out: R0 = 8 on success, carry set on failure
               buffer: year (u16, big-endian), month (1-12), day (1-31),
                       hour, minute, second, weekday (0 = Sunday)
0x06 MEM_INFO  in: R1 = type (0: SYS_MEM_TOTAL, 1: SYS_MEM_FREE, 2: SYS_MEM_PROCESS)
               out: R0 = the memory
*/

const F_READ = 1, F_WRITE = 2, F_CREATE = 4, F_TRUNC = 8, F_APPEND = 16;

function toNodeFlags(f) {
    const c = fs.constants;
    const write = (f & F_WRITE) || (f & F_APPEND);      // append implies write
    let n = write ? ((f & F_READ) ? c.O_RDWR : c.O_WRONLY) : c.O_RDONLY;
    if (f & F_CREATE) n |= c.O_CREAT;
    if (f & F_TRUNC)  n |= c.O_TRUNC;
    if (f & F_APPEND) n |= c.O_APPEND;
    return n;
}

const E_NOENT = 2,  E_IO = 5,      E_BADF = 9,   E_ACCES = 13, E_FAULT = 14,
      E_EXIST = 17, E_NOTDIR = 20, E_ISDIR = 21, E_INVAL = 22, E_MFILE = 24,
      E_SPIPE = 29, E_NOSYS = 38,  E_NOTEMPTY = 39;
const E_RANGE = 34;

const ERRNO = {
    ENOENT: E_NOENT, EEXIST: E_EXIST, EISDIR: E_ISDIR, ENOTDIR: E_NOTDIR,
    EACCES: E_ACCES, EPERM: E_ACCES, EMFILE: E_MFILE, EBADF: E_BADF,
    EINVAL: E_INVAL, ESPIPE: E_SPIPE, ENOTEMPTY: E_NOTEMPTY, ERANGE: E_RANGE
};

const withPath = (reg, fn) => (vm) => {
    const full = resolvePath(vm, vm.readString(vm.regs[reg]));
    if (full === null) return vm.fail(E_ACCES);
    try { return fn(vm, full); }
    catch (e) { return vm.fail(fsError(e)); }
};

const typeOf = (st) => st.isFile() ? 0 : st.isDirectory() ? 1 : 2;

function resolvePath(vm, p) {
    const full = path.resolve(vm.cwd, p);
    if (full !== vm.root && !full.startsWith(vm.root + path.sep)) return null;
    return full;
}

const fsError = (e) => ERRNO[e.code] ?? E_IO;

const SYSCALLS = {
    0x01: (vm) => vm.ok(Math.floor(Math.random() * 2 ** 32)),
    0x02: (vm) => vm.ok(Math.floor(Date.now() / 1000)),
    0x03: (vm) => { vm.sleep(vm.regs[0]); vm.ok(0); },
    0x04: (vm) => vm.ok(Math.floor(performance.now() - vm.startTime)),
    0x05: (vm) => {
        const ptr = vm.regs[0] & 0xFFFF;
        if (ptr + 8 > vm.mem.length) return vm.fail(E_FAULT);
        const d = new Date();
        const utc = vm.regs[1] !== 0;
        const g = (name) => d[(utc ? 'getUTC' : 'get') + name]();
        const y = g('FullYear');
        vm.writeBytes(ptr, Uint8Array.of(y >> 8, y & 0xFF, g('Month') + 1, g('Date'),
                                         g('Hours'), g('Minutes'), g('Seconds'), g('Day')));
        vm.ok(8);
    },
    0x06: (vm) => {
        const MIB = 2 ** 20;
        switch (vm.regs[1]) {
            case 0: return vm.ok(Math.floor(os.totalmem() / MIB));
            case 1: return vm.ok(Math.floor(os.freemem() / MIB));
            case 2: return vm.ok(Math.floor(process.memoryUsage().rss / MIB));
            default: return vm.fail(E_INVAL);
        }
    },
    0x10: (vm) => {                                  // openfile   R0 = path, R1 = flags
        const full = resolvePath(vm, vm.readString(vm.regs[0]));
        if (full === null) return vm.fail(E_ACCES);

        const flags = vm.regs[1];
        let fd;
        try {
            fd = fs.openSync(full, toNodeFlags(flags), 0o666);
            if (fs.fstatSync(fd).isDirectory()) {
                fs.closeSync(fd);
                return vm.fail(E_ISDIR);
            }
        } catch (e) {
            return vm.fail(fsError(e));
        }

        const h = vm.allocHandle({
            kind: 'file',
            fd,
            pos: 0,
            append: (flags & F_APPEND) !== 0,
        });
        if (h === null) {
            fs.closeSync(fd);
            return vm.fail(E_MFILE);
        }
        vm.ok(h);
    },
    0x11: withPath(0, (vm, full) => {                // opendir    R0 = path -> handle
        if (!fs.statSync(full).isDirectory()) return vm.fail(E_NOTDIR);
        const entries = fs.readdirSync(full);
        const h = vm.allocHandle({ kind: 'dir', path: full, entries, idx: 0 });
        if (h === null) return vm.fail(E_MFILE);
        vm.ok(h);
    }),
    0x12: (vm) => vm.fail(E_NOSYS),   // opensocket R0 = kind (tcp/udp), R1 = options
    0x13: (vm) => vm.fail(E_NOSYS),   // openserial R0 = path, R1 = baud
    0x14: (vm) => vm.fail(E_NOSYS),   // accept     R0 = listening socket -> new handle

    // -- operations on any handle --
    0x1A: (vm) => {                                  // read   R0 = handle, R1 = buf, R2 = len -> R0 = bytes read
        const h = vm.handles.get(vm.regs[0]);
        if (!h) return vm.fail(E_BADF);
        if (h.kind === 'dir') {
            const ptr = vm.regs[1] & 0xFFFF, len = vm.regs[2];
            if (h.idx >= h.entries.length) return vm.ok(0);
            const name = Buffer.from(h.entries[h.idx], 'utf8');
            if (name.length + 1 > len) return vm.fail(E_RANGE);
            if (ptr + name.length + 1 > vm.mem.length) return vm.fail(E_FAULT);
            vm.writeBytes(ptr, Buffer.concat([name, Buffer.from([0])]));
            h.idx++;
            return vm.ok(name.length);
        }
        const ptr = vm.regs[1] & 0xFFFF, len = vm.regs[2];
        if (ptr + len > vm.mem.length) return vm.fail(E_FAULT);
        if (len === 0) return vm.ok(0);

        const buf = Buffer.alloc(len);
        let n;
        try {
            if (h.kind === 'file') {
                n = fs.readSync(h.fd, buf, 0, len, h.pos);
                h.pos += n;
            } else if (h.kind === 'tty' && h.fd === 0) {
                try { n = fs.readSync(0, buf, 0, len, null); }
                catch (e) { if (e.code !== 'EOF') throw e; n = 0; }
            } else {
                return vm.fail(E_BADF);
            }
        } catch (e) {
            return vm.fail(fsError(e));
        }
        vm.writeBytes(ptr, buf.subarray(0, n));
        vm.ok(n);
    },

    0x1B: (vm) => {                                  // write  R0 = handle, R1 = buf, R2 = len -> R0 = bytes written
        const h = vm.handles.get(vm.regs[0]);
        if (!h) return vm.fail(E_BADF);
        if (h.kind === 'dir') return vm.fail(E_ISDIR);
        const ptr = vm.regs[1] & 0xFFFF, len = vm.regs[2];
        if (ptr + len > vm.mem.length) return vm.fail(E_FAULT);
        const data = vm.readBytes(ptr, len);

        let n;
        try {
            if (h.kind === 'file') {
                n = fs.writeSync(h.fd, data, 0, data.length, h.append ? null : h.pos);
                h.pos = h.append ? fs.fstatSync(h.fd).size : h.pos + n;
            } else if (h.kind === 'tty' && h.fd !== 0) {
                (h.fd === 1 ? process.stdout : process.stderr).write(data);
                n = data.length;
            } else {
                return vm.fail(E_BADF);
            }
        } catch (e) {
            return vm.fail(fsError(e));
        }
        vm.ok(n);
    },

    0x1C: (vm) => {                                  // close  R0 = handle
        const h = vm.handles.get(vm.regs[0]);
        if (!h) return vm.fail(E_BADF);
        vm.handles.delete(vm.regs[0]);               // free the slot even if close errors, like Unix
        if (h.kind === 'file') {
            try { fs.closeSync(h.fd); } catch (e) { return vm.fail(fsError(e)); }
        }
        vm.ok(0);
    },

    0x1D: (vm) => {                                  // seek   R0 = handle, R1 = offset (signed), R2 = whence -> R0 = position
        const h = vm.handles.get(vm.regs[0]);
        if (!h) return vm.fail(E_BADF);
        if (h.kind === 'dir') {                      // only rewinddir: offset 0, SEEK_SET
            if (vm.regs[1] !== 0 || vm.regs[2] !== 0) return vm.fail(E_INVAL);
            h.idx = 0;
            return vm.ok(0);
        }
        if (h.kind !== 'file') return vm.fail(E_SPIPE);

        let base;
        switch (vm.regs[2]) {
            case 0: base = 0; break;                 // SEEK_SET
            case 1: base = h.pos; break;             // SEEK_CUR
            case 2:                                  // SEEK_END
                try { base = fs.fstatSync(h.fd).size; }
                catch (e) { return vm.fail(fsError(e)); }
                break;
            default: return vm.fail(E_INVAL);
        }
        const pos = base + (vm.regs[1] | 0);         // | 0 reads the offset as signed 32-bit
        if (pos < 0 || pos > 0xFFFFFFFF) return vm.fail(E_INVAL);
        h.pos = pos;
        vm.ok(pos);
    },

    0x1E: (vm) => {                                  // ctl    R0 = handle, R1 = request, R2 = arg
        if (!vm.handles.has(vm.regs[0])) return vm.fail(E_BADF);
        return vm.fail(E_INVAL);                     // no requests defined yet (sockets/serial will add them)
    },

    0x1F: (vm) => {                                  // fstat  R0 = handle -> R0 = size, R1 = type, R2 = mtime (s)
        const h = vm.handles.get(vm.regs[0]);
        if (!h) return vm.fail(E_BADF);
        if (h.kind === 'dir') {
            let st;
            try { st = fs.statSync(h.path); } catch (e) { return vm.fail(fsError(e)); }
            vm.regs[1] = 1;
            vm.regs[2] = Math.floor(st.mtimeMs / 1000);
            return vm.ok(0);
        }
        if (h.kind !== 'file') {                     // tty: no size or time
            vm.regs[1] = 2;
            vm.regs[2] = 0;
            return vm.ok(0);
        }
        let st;
        try { st = fs.fstatSync(h.fd); } catch (e) { return vm.fail(fsError(e)); }
        vm.regs[1] = st.isDirectory() ? 1 : 0;
        vm.regs[2] = Math.floor(st.mtimeMs / 1000);
        vm.ok(Math.min(st.size, 0xFFFFFFFF));
    },

    // -- filesystem (paths) --
    0x20: (vm) => {                                  // rename     R0 = old, R1 = new
        const from = resolvePath(vm, vm.readString(vm.regs[0]));
        const to   = resolvePath(vm, vm.readString(vm.regs[1]));
        if (from === null || to === null) return vm.fail(E_ACCES);
        try { fs.renameSync(from, to); } catch (e) { return vm.fail(fsError(e)); }
        vm.ok(0);
    },
    0x21: withPath(0, (vm, full) => { fs.unlinkSync(full); vm.ok(0); }),   // unlink
    0x22: withPath(0, (vm, full) => { fs.mkdirSync(full);  vm.ok(0); }),   // mkdir
    0x23: withPath(0, (vm, full) => { fs.rmdirSync(full);  vm.ok(0); }),   // rmdir
    0x24: withPath(0, (vm, full) => {                // stat  -> R0 = size, R1 = type, R2 = mtime
        const st = fs.statSync(full);
        vm.regs[1] = typeOf(st);
        vm.regs[2] = Math.floor(st.mtimeMs / 1000);
        vm.ok(Math.min(st.size, 0xFFFFFFFF));
    }),
    0x25: withPath(0, (vm, full) => {                // chdir
        if (!fs.statSync(full).isDirectory()) return vm.fail(E_NOTDIR);
        vm.cwd = full;
        vm.ok(0);
    }),
    0x26: (vm) => {                                  // getcwd  R0 = buf, R1 = max len -> R0 = length
        const bytes = Buffer.from(vm.cwd, 'utf8');
        const ptr = vm.regs[0] & 0xFFFF, max = vm.regs[1];
        if (bytes.length + 1 > max) return vm.fail(E_RANGE);          // room for the NUL
        if (ptr + bytes.length + 1 > vm.mem.length) return vm.fail(E_FAULT);
        vm.writeBytes(ptr, Buffer.concat([bytes, Buffer.from([0])]));
        vm.ok(bytes.length);
    },
};

const OPCODE_MAP = {};

for (const [type, forms] of Object.entries(INSTRUCTIONS)) {
    for (const { ops, opcode } of forms) {
        if (Object.hasOwn(OPCODE_MAP, opcode)) {
            throw new Error(
                `duplicate opcode 0x${opcode.toString(16)}: ${type} and ${OPCODE_MAP[opcode].type}`
            );
        }
        OPCODE_MAP[opcode] = { type, ops };
    }
}

class AsmError extends Error {
    constructor(msg, lineNo) {
        super(`line ${lineNo}: ${msg}`);
    }
}

class RuntimeError extends Error {
    constructor(msg, address) {
        super(`at 0x${address.toString(16)}: ${msg}`);
    }
}

function parseOperand(text, lineNo) {
    const t = text.trim();
    const upper = t.toUpperCase();

    if (t.startsWith('#&')) {
        return { kind: 'i', label: t.slice(2).trim() };
    }

    if (t.startsWith('#') && t.includes('|')) {
        const value = t.split('|').reduce(
            (acc, part) => (acc | parseImm(part.trim().replace(/^#/, ''), lineNo)) >>> 0, 0);
        return { kind: 'i', value };
    }

    if (t.startsWith('#')) {
        return { kind: 'i', value: parseImm(t.slice(1), lineNo) };
    }

    if (Object.hasOwn(REGS, upper)) {
        return { kind: 'r', value: REGS[upper] };
    }

    if (Object.hasOwn(CONDS, upper)) {
        return { kind: 'c', value: CONDS[upper] };
    }

    if (t.startsWith('$')) {
        const [base, index] = t.slice(1).split('+').map(s => s.trim());
        if (!base) {
            throw new AsmError(`missing address in "${t}"`, lineNo);
        }

        if (index === undefined) {
            return { kind: 'a', addr: base };
        }
        if (!Object.hasOwn(REGS, index.toUpperCase())) {
            throw new AsmError(`"${index}" is not a register`, lineNo);
        }

        return { kind: 'x', addr: base, index: REGS[index.toUpperCase()] };
    }
    throw new AsmError(`can't parse operand "${t}"`, lineNo);
}

function parseHex(text, lineNo) {
    if (!/^[0-9a-f]+$/i.test(text)) {
        throw new AsmError(`bad number "${text}"`, lineNo);
    }
    return parseInt(text, 16);
}

function parseImm(text, lineNo) {
    const neg = text.startsWith('-');
    const digits = neg ? text.slice(1) : text;

    if (!/^[0-9a-f]+$/i.test(digits)) {
        throw new AsmError(`bad number "${text}"`, lineNo);
    }

    const v = parseInt(digits, 16);

    if (v > 0xFFFFFFFF) {
        throw new AsmError(`immediate ${text} doesn't fit in 32 bits`, lineNo);
    }

    return neg ? (-v) >>> 0 : v;
}

function expandIncludes(source, file, stack = []) {
    const abs = path.resolve(file);
    if (stack.includes(abs)) throw new AsmError(`circular include of "${file}"`, 0);

    const lines = [];
    source.split(/\r?\n/).forEach((raw, idx) => {
        const text = raw.split(';')[0].trim();
        const m = text.match(/^%include\s+("(?:[^"\\]|\\.)*")$/);

        if (!m) {
            lines.push({ text: raw, file: abs, lineNo: idx + 1 });
            return;
        }

        const name = JSON.parse(m[1]);
        const target = path.resolve(path.dirname(abs), name);
        let src;
        try {
            src = fs.readFileSync(target, 'utf8');
        } catch (e) {
            throw new AsmError(`can't read include "${name}" (tried ${target}: ${e.code})`, idx + 1);
        }
        lines.push(...expandIncludes(src, target, [...stack, abs]));
    });
    return lines;
}

function applyDefines(lines) {
    const defs = new Map();
    const out = [];

    const expand = (text) =>
        text.replace(/"(?:[^"\\]|\\.)*"|(?<!\w)[A-Za-z_]\w*/g,
            (tok) => (tok[0] !== '"' && defs.has(tok)) ? defs.get(tok) : tok);

    for (const line of lines) {
        const text = line.text.split(';')[0].trim();

        const m = text.match(/^%define\s+([A-Za-z_]\w*)\s+(.+)$/);
        if (m) {
            const [, name, value] = m;
            const upper = name.toUpperCase();
            if (Object.hasOwn(REGS, upper) || Object.hasOwn(CONDS, upper) ||
                Object.hasOwn(INSTRUCTIONS, upper)) {
                throw new AsmError(`can't define "${name}": reserved word`, line.lineNo);
            }
            if (defs.has(name)) {
                throw new AsmError(`"${name}" is already defined`, line.lineNo);
            }
            defs.set(name, expand(value.trim()));
            continue;
        }

        if (/^%define\b/.test(text)) {
            throw new AsmError('%define needs a name and a value', line.lineNo);
        }

        out.push({ ...line, text: expand(text) });
    }
    return out;
}

// split "a, "b,c", d" on commas that aren't inside a string literal
function splitArgs(s) {
    const args = [];
    let cur = '', inStr = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (inStr) {
            cur += ch;
            if (ch === '\\') cur += s[++i] ?? '';
            else if (ch === '"') inStr = false;
        } else if (ch === '"') { inStr = true; cur += ch; }
        else if (ch === ',') { args.push(cur.trim()); cur = ''; }
        else cur += ch;
    }
    if (cur.trim() || args.length) args.push(cur.trim());
    return args;
}

function applyMacros(lines) {
    const macros = new Map();
    const rest = [];
    let current = null;

    // pass 1: collect definitions
    for (const line of lines) {
        const text = line.text.split(';')[0].trim();
        let m;

        if ((m = text.match(/^%macro\s+([A-Za-z_]\w*)\s*(.*)$/))) {
            if (current) throw new AsmError('macros can\'t be nested', line.lineNo);
            const [, name, paramText] = m;
            const upper = name.toUpperCase();
            if (Object.hasOwn(INSTRUCTIONS, upper) || Object.hasOwn(REGS, upper) || Object.hasOwn(CONDS, upper)) {
                throw new AsmError(`can't name a macro "${name}": reserved word`, line.lineNo);
            }
            if (macros.has(name)) throw new AsmError(`macro "${name}" is already defined`, line.lineNo);
            const params = paramText ? paramText.split(/[\s,]+/).filter(Boolean) : [];
            current = { name, params, lines: [], lineNo: line.lineNo };
            continue;
        }

        if (/^%endmacro\b/.test(text)) {
            if (!current) throw new AsmError('%endmacro without %macro', line.lineNo);
            macros.set(current.name, current);
            current = null;
            continue;
        }

        if (current) current.lines.push(line);
        else rest.push(line);
    }
    if (current) throw new AsmError(`macro "${current.name}" is missing %endmacro`, current.lineNo);

    // pass 2: expand invocations
    let counter = 0;

    const expandLine = (line, depth) => {
        if (depth > 32) throw new AsmError('macro expansion too deep (recursive macro?)', line.lineNo);

        const text = line.text.split(';')[0].trim();
        const m = text.match(/^(?:([A-Za-z_]\w*):\s*)?([A-Za-z_]\w*)\s*(.*)$/);
        if (!m || !macros.has(m[2]) || m[3].startsWith(':')) return [line];

        const [, label, name, argText] = m;
        const macro = macros.get(name);
        const args = argText ? splitArgs(argText) : [];
        if (args.length !== macro.params.length) {
            throw new AsmError(
                `macro "${name}" takes ${macro.params.length} argument(s), got ${args.length}`, line.lineNo);
        }

        const id = counter++;
        const out = [];
        if (label) out.push({ ...line, text: label + ':' });

        for (const bodyLine of macro.lines) {
            const t = bodyLine.text.split(';')[0].replace(
                /"(?:[^"\\]|\\.)*"|@(\w+)|(?<!\w)[A-Za-z_]\w*/g,
                (tok, local) => {
                    if (tok[0] === '"') return tok;               // leave strings alone
                    if (local) return `_m${id}_${local}`;         // @label -> unique label
                    const i = macro.params.indexOf(tok);
                    return i >= 0 ? args[i] : tok;                // parameter -> argument
                });
            out.push(...expandLine({ ...bodyLine, text: t, lineNo: line.lineNo }, depth + 1));
        }
        return out;
    };

    return rest.flatMap(line => expandLine(line, 0));
}

function assemble(source, file = "<input>") {
    const labels = new Map();
    const items = [];
    let address = 0;

    applyDefines(applyMacros(expandIncludes(source, file))).forEach(({ text: raw, lineNo }) => {
        let text = raw.split(';')[0].trim();

        const labelMatch = text.match(/^([A-Za-z_]\w*):\s*(.*)$/);

        if (labelMatch) {
            if (labels.has(labelMatch[1])) {
                throw new AsmError(`duplicate label "${labelMatch[1]}"`, lineNo);
            }

            labels.set(labelMatch[1], address);
            text = labelMatch[2];
        }

        if (!text) return;

        if (text.startsWith('.string')) {
            let str;

            try {
                str = JSON.parse(text.slice(7).trim());
            }
            catch {
                throw new AsmError('.string needs a quoted string', lineNo);
            }

            const bytes = [...Buffer.from(str, 'utf8'), 0];
            items.push({ bytes });
            address += bytes.length;

            return;
        }

        if (text.startsWith('.space')) {
            const n = Number(text.slice(6).trim());
            if (!Number.isInteger(n) || n < 0) throw new AsmError('.space needs a byte count', lineNo);
            items.push({ bytes: new Array(n).fill(0) });
            address += n;
            return;
        }

        const [, mnemonic, rest] = text.match(/^(\S+)\s*(.*)$/);
        const forms = Object.hasOwn(INSTRUCTIONS, mnemonic.toUpperCase())
            ? INSTRUCTIONS[mnemonic.toUpperCase()] : null;

        if (!forms) {
            throw new AsmError(`unknown instruction "${mnemonic}"`, lineNo);
        }

        const operands = rest ? rest.split(',').map(s => parseOperand(s, lineNo)) : [];
        const kinds = operands.map(o => o.kind).join('');
        const form = forms.find(f => f.ops === kinds);

        if (!form) {
            throw new AsmError(`${mnemonic} has no form for operands "${kinds || 'none'}"`, lineNo);
        }

        items.push({ form, operands, lineNo });
        address += 1 + operands.reduce((n, o) => n + SIZE[o.kind], 0);
    });

    const resolve = (name, lineNo) => {
        if (labels.has(name)) return labels.get(name);
        if (/^[0-9a-f]+$/i.test(name)) return parseHex(name, lineNo);
        throw new AsmError(`undefined label "${name}"`, lineNo);
    };

    const word = (n) => [(n >> 8) & 0xFF, n & 0xFF];
    const dword = (n) => [(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF];

    const out = [];
    for (const item of items) {
        if (item.bytes) { out.push(...item.bytes); continue; }

        out.push(item.form.opcode);
        for (const o of item.operands) {
            switch (o.kind) {
                case 'r': case 'c':
                    out.push(o.value); break;
                case 'i':
                    out.push(...dword(o.label ? resolve(o.label, item.lineNo) : o.value)); break;
                case 'a':
                    out.push(...word(resolve(o.addr, item.lineNo))); break;
                case 'x':
                    out.push(...word(resolve(o.addr, item.lineNo)), o.index); break;
            }
        }
    }
    return Buffer.from(out);
}

const REG_NAMES = Object.fromEntries(Object.entries(REGS).map(([k, v]) => [v, k]));
const COND_NAMES = Object.fromEntries(Object.entries(CONDS).map(([k, v]) => [v, k]));
const hex = (n, width = 0) => n.toString(16).toUpperCase().padStart(width, '0');

function disAssemble(binary, withAdresses = true) {
    const lines = [];
    let pc = 0;

    while (pc < binary.length) {
        const start = pc;
        const inst = OPCODE_MAP[binary[pc++]];

        if (!inst) {
            lines.push(`${hex(start, 4)}: .byte ${hex(binary[start], 2)}`);
            continue;
        }

        const operands = [];
        for (const kind of inst.ops) {
            if (pc + SIZE[kind] > binary.length) {
                operands.push('???');
                pc = binary.length;
                break;
            }

            switch (kind) {
                case 'r':
                    operands.push(REG_NAMES[binary[pc]] ?? `R?${binary[pc]}`);
                    break;
                case 'c':
                    operands.push(COND_NAMES[binary[pc]] ?? `C?${binary[pc]}`);
                    break;
                case 'i':
                    operands.push('#' + hex(binary.readUInt32BE(pc)));
                    break;
                case 'a':
                    operands.push('$' + hex(binary.readUInt16BE(pc), 4));
                    break;
                case 'x':
                    operands.push(`$${hex(binary.readUInt16BE(pc), 4)} + ${REG_NAMES[binary[pc + 2]] ?? '?'}`);
                    break;
            }
            pc += SIZE[kind];
        }

        if (withAdresses) {
            lines.push(`${hex(start, 4)}: ${inst.type} ${operands.join(', ')}`.trimEnd());
        } else {
            lines.push(`${inst.type} ${operands.join(', ')}`.trimEnd());
        }
    }

    return lines.join('\n');
}

function output(d) {
    process.stdout.write(String.fromCharCode(d & 0xFF));
}

function run(binary, maxCycles = 50_000_000) {
    const mem = new Uint8Array(0x10000);
    mem.set(binary);

    let cycles = 0;

    const regs = new Uint32Array(7);
    regs[6] = 0x10000;
    const flags = { Z: false, N: false, C: false };
    let pc = 0;

    const read32 = (a) => ((mem[a & 0xFFFF] << 24) | (mem[(a + 1) & 0xFFFF] << 16) |
                           (mem[(a + 2) & 0xFFFF] << 8) | mem[(a + 3) & 0xFFFF]) >>> 0;
    const write32 = (a, v) => {
        mem[a & 0xFFFF] = v >>> 24; mem[(a + 1) & 0xFFFF] = v >>> 16;
        mem[(a + 2) & 0xFFFF] = v >>> 8; mem[(a + 3) & 0xFFFF] = v;
    };
    const push = (v) => { regs[6] -= 4; write32(regs[6], v); };
    const pop = () => { const v = read32(regs[6]); regs[6] += 4; return v; };

    const setZN = (r) => { flags.Z = r === 0; flags.N = (r >>> 31) === 1; return r; };

    const src = (kind, v) => kind === 'r' ? regs[v] : kind === 'i' ? v : read32(v);

    function alu(type, a, b) {
        let r, c = false;
        switch (type) {
            case 'ADD': r = (a + b) >>> 0; c = r < a; break;
            case 'SUB': case 'CMP': r = (a - b) >>> 0; c = a < b; break;
            case 'MUL': r = Math.imul(a, b) >>> 0; c = BigInt(a) * BigInt(b) > 0xFFFFFFFFn; break;
            case 'AND': r = (a & b) >>> 0; break;
            case 'OR':  r = (a | b) >>> 0; break;
            case 'XOR': r = (a ^ b) >>> 0; break;
            case 'SHL':
                r = b >= 32 ? 0 : (a << b) >>> 0;
                c = b > 0 && b <= 32 && ((a >>> (32 - b)) & 1) === 1;
                break;
            case 'SHR':
                r = b >= 32 ? 0 : a >>> b;
                c = b > 0 && b <= 32 && ((a >>> (b - 1)) & 1) === 1;
                break;
        }
        flags.C = c;
        return setZN(r);
    }

    const condMet = (c) => [flags.Z, !flags.Z, flags.C, !flags.C, flags.N][c];

    const vm = {
        mem,
        regs,
        flags,
        read32,
        write32,
        root: process.cwd(),
        cwd: process.cwd(),
        handles: new Map([
            [0, { kind: 'tty', fd: 0 }],    // stdin
            [1, { kind: 'tty', fd: 1 }],    // stdout
            [2, { kind: 'tty', fd: 2 }],    // stderr
        ]),
        allocHandle(entry) {
            for (let h = 3; h < 64; h++) {  // 0-2 reserved for stdin/stdout/stderr
                if (!this.handles.has(h)) { this.handles.set(h, entry); return h; }
            }
            return null;
        },

        startTime: performance.now(),
        sleep(ms) {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(ms, 10_000));
        },

        readString(ptr) {
            let end = ptr & 0xFFFF;
            while (end < mem.length && mem[end] !== 0) end++;
            return Buffer.from(mem.subarray(ptr & 0xFFFF, end)).toString('utf8');
        },

        writeBytes(ptr, bytes) {
            ptr &= 0xFFFF;
            const n = Math.min(bytes.length, mem.length - ptr);
            mem.set(bytes.subarray(0, n), ptr);
            return n;
        },

        readBytes(ptr, len) {
            ptr &= 0xFFFF;
            return Buffer.from(mem.subarray(ptr, Math.min(ptr + len, mem.length)));
        },

        ok(value = 0)  { regs[0] = value >>> 0; flags.C = false; },
        fail(code)     { regs[0] = code >>> 0;  flags.C = true; },
    };

    var halted = false;


    try {
    while (!halted) {
        const start = pc;
        const inst = OPCODE_MAP[mem[pc++]];

        if (pc > 0xFFFF) throw new RuntimeError('pc ran off the end of memory', pc & 0xFFFF);

        if (++cycles > maxCycles) throw new RuntimeError('cycle limit exceeded', pc);

        if (!inst) {
            throw new RuntimeError(`invalid opcode 0x${mem[start].toString(16)}`, start);
        }

        const v = [];
        for (const kind of inst.ops) {
            switch (kind) {
                case 'r': case 'c': v.push(mem[pc]); break;
                case 'i': v.push(read32(pc)); break;
                case 'a': v.push((mem[pc] << 8) | mem[pc + 1]); break;
                case 'x': v.push((((mem[pc] << 8) | mem[pc + 1]) + regs[mem[pc + 2]]) & 0xFFFF); break;
            }
            pc += SIZE[kind];
        }
        const [a, b] = v;
        const k = inst.ops;

        switch (inst.type) {
            case 'ADD': case 'SUB': case 'MUL':
            case 'AND': case 'OR': case 'XOR':
            case 'SHL': case 'SHR':
                regs[a] = alu(inst.type, regs[a], src(k[1], b)); break;
            case "OUT":
                output((inst.ops == "r") ? regs[a] : a); break;
            case 'LOAD':
                regs[a] = k[1] === 'i' ? b : read32(b); break;
            case 'LOADB':
                regs[a] = mem[b]; break;
            case 'STOR':
                write32(a, k[1] === 'i' ? b : regs[b]); break;
            case 'STORB':
                mem[a] = regs[b] & 0xFF; break;
            case 'MOVE':
                regs[a] = regs[b]; break;
            case 'SWAP':
                [regs[a], regs[b]] = [regs[b], regs[a]]; break;
            case 'CMP':
                alu('CMP', regs[a], src(k[1], b)); break;
            case 'NOT':
                regs[a] = setZN(~regs[a] >>> 0); flags.C = false; break;

            case 'JUMP':
                pc = k === 'r' ? regs[a] & 0xFFFF : a; break;
            case 'JCON':
                if (condMet(a)) pc = b; break;

            case 'PUSH': push(k === 'r' ? regs[a] : a); break;
            case 'POP':  regs[a] = pop(); break;
            case 'CALL':
                push(pc);
                pc = k === 'r' ? regs[a] & 0xFFFF : a;
                break;
            case 'RET':  pc = pop(); break;
            case 'NOP':  break;

            case 'IN': {
                const buf = Buffer.alloc(1);
                let n = 0;
                for (;;) {
                    try { n = fs.readSync(0, buf, 0, 1, null); break; }
                    catch (e) {
                        if (e.code === 'EAGAIN') {
                            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5); // don't spin
                            continue;
                        }
                        if (e.code === 'EOF') { n = 0; break; }
                        throw e;
                    }
                }
                regs[a] = n === 1 ? buf[0] : 0;
                break;
            }
            case 'SYS': {
                const fn = SYSCALLS[a];
                if (!fn) throw new RuntimeError(`bad syscall ${a}`, start);
                fn(vm);
                break;
            }
            case "HALT": {
                halted = true;
                break;
            };
        }
    }
    } finally {
        for (const h of vm.handles.values()) {
            if (h.kind === 'file') { try { fs.closeSync(h.fd); } catch {} }
        }
    }
}

export { assemble, disAssemble, run };