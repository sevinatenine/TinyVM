import fs from 'fs';

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

function assemble(source) {
    const labels = new Map();
    const items = [];
    let address = 0;

    source.split(/\r?\n/).forEach((raw, idx) => {
        const lineNo = idx + 1;
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

    var halted = false;

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
                try { n = fs.readSync(0, buf, 0, 1, null); } catch { }
                regs[a] = n === 1 ? buf[0] : 0;
                break;
            }

            case "HALT": {
                halted = true;
                break;
            };
        }
    }
}

export { assemble, disAssemble, run };