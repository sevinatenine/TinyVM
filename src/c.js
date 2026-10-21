import parser from "node-c-parser";

const RUNTIME = {
    putchar: { params: 1, asm: `
_putchar:
PUSH R5
MOVE R5, SP
LOAD R0, $8 + R5
OUT R0
POP R5
RET` },

    puts: { params: 1, asm: `
_puts:
PUSH R5
MOVE R5, SP
LOAD R1, $8 + R5
_puts_loop:
LOADB R0, $0 + R1
CMP R0, #0
JCON Z, $_puts_done
OUT R0
ADD R1, #1
JUMP $_puts_loop
_puts_done:
POP R5
RET` },

    println: { params: 1, deps: ['puts'], asm: `
_println:
PUSH R5
MOVE R5, SP
LOAD R0, $8 + R5
PUSH R0
CALL $_puts
ADD SP, #4
OUT #A
POP R5
RET` },

    getchar: { params: 0, asm: `
_getchar:
IN R0
RET` },
};

const usedRuntime = new Set();

function parseC(code) {
    const clean = code.replace(/^\s*#.*$/gm, "");
    var tokens = parser.lexer.lexUnit.tokenize(clean);
    var parse_tree = parser.parse(tokens);

    return parse_tree;
}

function walk(node, visit) {
    if (!node) return;
    visit(node);
    if (Array.isArray(node.children)) {
        for (const child of node.children) walk(child, visit);
    }
}

function findIdentifier(node) {
    let found = null;
    walk(node, (n) => {
        if (!found && n.tokenClass === "IDENTIFIER") found = n.lexeme;
    });
    return found;
}

function stringLiteralLength(lexeme) {
    const inner = lexeme.slice(1, -1);
    return inner.replace(/\\(x[0-9a-fA-F]{2}|.)/g, "_").length + 1;
}

function findInitializer(node, name) {
    let result = null;
    walk(node, (n) => {
        if (result || n.title !== "init_declarator") return;
        if (findIdentifier(n.children[0]) !== name) return;
        const k = real(n);                       // drops EPSILON tails
        if (k.length > 1) result = k[k.length - 1];   // [declarator, ..., initializer]
        // console.log(n.children.map(c => c.title ?? c.lexeme));
    });
    return result;
}

function lexemes(node, out = []) {
    if (!node) return out;
    if (node.lexeme !== undefined) out.push(node.lexeme);
    if (Array.isArray(node.children)) node.children.forEach((c) => lexemes(c, out));
    return out;
}

function collectDeclarators(node, out = []) {
    if (!node || !Array.isArray(node.children)) return out;

    if (node.title === "init_declarator") {
        collectDeclarators(node.children[0], out);
        return out;
    }

    if (node.title === "declarator") {
        out.push(node);
        return out;
    }

    node.children.forEach((c) => collectDeclarators(c, out));
    return out;
}

function typeOfDeclarator(base, declarator) {
    const toks = lexemes(declarator);
    const nameIdx = toks.findIndex((t) => /^[A-Za-z_]\w*$/.test(t));
    const stars = toks.slice(0, nameIdx).filter((t) => t === "*").length;

    const dims = [];
    const after = toks.slice(nameIdx + 1);
    for (let i = 0; i < after.length; i++) {
        if (after[i] === "[") dims.push(after[i + 1] === "]" ? "" : after[i + 1]);
    }

    return base + "*".repeat(stars) + dims.map((d) => `[${d}]`).join("");
}

function findParams(declarator) {
    const params = {};
    walk(declarator, (node) => {
        if (node.title !== "parameter_declaration") return;

        const declIdx = node.children.findIndex((c) => collectDeclarators(c).length > 0);
        if (declIdx === -1) return;

        const base = node.children.slice(0, declIdx).flatMap((c) => lexemes(c)).join(" ");
        const decl = collectDeclarators(node)[0];

        let type = typeOfDeclarator(base, decl);
        type = type.replace(/\[\d*\]$/, "*");

        params[findIdentifier(decl)] = type;
    });
    return params;
}

function findLocals(body) {
    const locals = {};
    walk(body, (node) => {
        if (node.title !== "declaration") return;

        const declIdx = node.children.findIndex((c) => collectDeclarators(c).length > 0);
        if (declIdx === -1) return;

        const base = node.children
            .slice(0, declIdx)
            .flatMap((c) => lexemes(c))
            .join(" ");

        for (const decl of collectDeclarators(node)) {
            let type = typeOfDeclarator(base, decl);

            if (type.endsWith("[]")) {
                const name = findIdentifier(decl);
                const init = findInitializer(node, name);
                const toks = lexemes(init);
                if (toks.length === 1 && toks[0].startsWith('"')) {
                    type = type.slice(0, -2) + `[${stringLiteralLength(toks[0])}]`;
                } else if (toks[0] === "{") {
                    let depth = 0, count = 1;
                    for (const t of toks) {
                        if (t === "{") depth++;
                        else if (t === "}") depth--;
                        else if (t === "," && depth === 1) count++;
                    }
                    type = type.slice(0, -2) + `[${count}]`;
                } else {
                    throw new Error(`can't infer size of ${name} (init tokens: ${JSON.stringify(toks)})`);
                }
            }

            locals[findIdentifier(decl)] = type;
        }
    });
    return locals;
}

const TYPE_SIZES = {
    char: 1,
    int: 4,
    ptr: 4,
};

function sizeOf(type) {
    const arr = type.match(/^(.*?)((?:\[\d*\])+)$/);
    if (arr) {
        const count = [...arr[2].matchAll(/\[(\d*)\]/g)]
            .reduce((n, m) => n * Number(m[1] || 0), 1);
        return sizeOf(arr[1]) * count;
    }

    if (type.endsWith("*")) return TYPE_SIZES.ptr;

    const base = type.split(" ").filter((t) => !["const", "unsigned", "signed"].includes(t)).pop();
    if (!(base in TYPE_SIZES)) throw new Error(`unknown type: ${type}`);
    return TYPE_SIZES[base];
}

function calculateOffsets(functions) {
    for (const [functionName, f] of Object.entries(functions)) {
        f.offsets = {};

        let p = 8;
        for (const n of Object.keys(f.params)) {
            f.offsets[n] = p;
            p += 4;
        }

        let offset = 0;
        for (const [variableName, type] of Object.entries(f.locals)) {
            offset += sizeOf(type);
            f.offsets[variableName] = -offset;
        }

        f.frameSize = offset;
    }
}

const imm = (n) => (n < 0 ? `#-${n.toString(16).toUpperCase().slice(1)}` : `#${n.toString(16).toUpperCase()}`);

function genFunctionDef(f, bodyLines) {
    return [
        `_${f.name}:`,
        `PUSH R5`,
        `MOVE R5, SP`,
        f.frameSize ? `SUB SP, ${imm(f.frameSize)}` : null,
        ...bodyLines,
        `_${f.name}_end:`,
        `MOVE SP, R5`,
        `POP R5`,
        `RET`,
    ].filter(Boolean).join("\n");
}

function genFunctionCall(functionName, argCodes) {
    if (!functions[functionName] && RUNTIME[functionName]) {
        if (argCodes.length !== RUNTIME[functionName].params) throw new Error(`${functionName}: wrong number of arguments`);
        usedRuntime.add(functionName);
    } else if (!functions[functionName]) {
        throw new Error(`call to undefined function ${functionName}`);
    }

    const lines = [];
    for (const code of [...argCodes].reverse()) lines.push(...code, "PUSH R0");
    lines.push(`CALL $_${functionName}`);
    if (argCodes.length) lines.push(`ADD SP, ${imm(4 * argCodes.length)}`);
    return lines;
}

const dataSection = [];

const isEmpty = (n) =>
    n.title === "EPSILON" ||
    (Array.isArray(n.children) && n.children.length > 0 && n.children.every(isEmpty));

const real = (n) => (n.children ?? []).filter((c) => !isEmpty(c));

const hex = (n) => n.toString(16).toUpperCase();
const local = (off) => `$${hex((0x10000 + off) & 0xFFFF)} + R5`;

const BINARY = new Set([
    "multiplicative_expr", "additive_expr", "shift_expr",
    "and_expr", "exclusive_or_expr", "inclusive_or_expr",
    "logical_and_expr", "logical_or_expr",,
    "relational_expr", "equality_expr",
]);

const BINOPS = { "+": "ADD", "-": "SUB", "*": "MUL", "&": "AND", "|": "OR", "^": "XOR", "<<": "SHL", ">>": "SHR" };

function constValue(lex) {
    if (lex.startsWith("'")) {
        const s = lex.slice(1, -1);
        return s[0] === "\\" ? { n: 10, t: 9, r: 13, "0": 0, "\\": 92, "'": 39 }[s[1]] : s.charCodeAt(0);
    }
    return Number(lex);
}

function flattenArgs(list) {
    const args = [];
    let cur = list;
    while (cur && !isEmpty(cur)) {
        const k = real(cur);
        const expr = k.find((c) => c.title === "assignment_expr");
        if (expr) args.push(expr);
        cur = k.find((c) => c.title === "argument_expr_list_p");
    }
    return args;
}

let labelId = 0;

function genIdentifier(name, f) {
    const type = f.params[name] ?? f.locals[name];
    if (!type) throw new Error(`undeclared identifier ${name}`);
    const off = f.offsets[name];

    if (type.endsWith("]")) return ["MOVE R0, R5", `ADD R0, ${imm(off)}`];
    if (type === "char" || type.endsWith(" char")) {
        return [`LOADB R0, ${local(name in f.params ? off + 3 : off)}`];
    }
    return [`LOAD R0, ${local(off)}`];
}

const flat = (n) => real(n).flatMap((c) => (c.title?.endsWith("_p") ? flat(c) : [c]));

function chain(node) {
    const [first, tail] = real(node);
    const rest = [];
    for (let t = tail; t && !isEmpty(t); ) {
        const [op, rhs, next] = real(t);
        rest.push({ op: op.lexeme, rhs });
        t = next;
    }
    return { first, rest };
}

const newLabel = (f, kind) => `_${f.name}_${kind}${labelId++}`;
const isByte = (t) => t === "char" || t.endsWith(" char");
const loadOp = (t) => (isByte(t) ? "LOADB" : "LOAD");
const storeOp = (t) => (isByte(t) ? "STORB" : "STOR");
const isPtr = (t) => t.endsWith("*") || t.endsWith("]");

function elemType(t) {
    if (t.endsWith("]")) return t.replace(/\[\d*\]/, "");
    if (t.endsWith("*")) return t.slice(0, -1);
    throw new Error(`cannot index or dereference ${t}`);
}
const decay = (t) => (t.endsWith("]") ? elemType(t) + "*" : t);

function scale(n) {
    if (n === 1) return [];
    if ((n & (n - 1)) === 0) return [`SHL R0, ${imm(Math.log2(n))}`];
    return [`MUL R0, ${imm(n)}`];
}

function asIdentifier(node) {
    while (!node.tokenClass && real(node).length === 1) node = real(node)[0];
    return node.tokenClass === "IDENTIFIER" ? node.lexeme : null;
}

function slot(name, f) {
    const t = f.params[name] ?? f.locals[name];
    return local(f.offsets[name] + (name in f.params && isByte(t) ? 3 : 0));
}

function flagsToBool(cond, f) {
    const end = newLabel(f, "bool");
    return ["LOAD R0, #1", `JCON ${cond}, $${end}`, "LOAD R0, #0", `${end}:`];
}

function typeOf(node, f) {
    const name = asIdentifier(node);
    if (name) {
        const t = f.params[name] ?? f.locals[name];
        if (!t) throw new Error(`undeclared identifier ${name}`);
        return t;
    }
    if (node.tokenClass === "STRING_LITERAL") return "char*";
    if (node.tokenClass === "CONSTANT") return node.lexeme.startsWith("'") ? "char" : "int";

    const kids = real(node);
    if (kids.length === 1) return typeOf(kids[0], f);

    switch (node.title) {
        case "primary_expr": return typeOf(kids.find((c) => c.title === "expr"), f);
        case "additive_expr": {
            const t = typeOf(chain(node).first, f);
            return isPtr(t) ? decay(t) : "int";
        }
        case "assignment_expr": return typeOf(flat(node)[0], f);
        case "unary_expr": {
            const [opNode, operand] = flat(node);
            const op = lexemes(opNode).join("");
            if (op === "*") return elemType(typeOf(operand, f));
            if (op === "&") return typeOf(operand, f) + "*";
            if (op === "++" || op === "--") return typeOf(operand, f);
            return "int";
        }
        case "postfix_expr": {
            const [prim, tail] = kids;
            return flat(tail)[0].lexeme === "[" ? elemType(typeOf(prim, f)) : "int";
        }
    }
    return "int";
}

function genIndexAddr(prim, idx, f) {
    const size = sizeOf(elemType(typeOf(prim, f)));
    return [
        ...genExpr(idx, f), ...scale(size), "PUSH R0",
        ...genExpr(prim, f),
        "POP R1", "ADD R0, R1",
    ];
}

function genAddr(node, f) {
    const name = asIdentifier(node);
    if (name) {
        const t = f.params[name] ?? f.locals[name];
        const off = f.offsets[name] + (name in f.params && isByte(t) ? 3 : 0);
        return ["MOVE R0, R5", `ADD R0, ${imm(off)}`];
    }
    const kids = real(node);
    if (kids.length === 1) return genAddr(kids[0], f);

    if (node.title === "primary_expr") return genAddr(kids.find((c) => c.title === "expr"), f);
    if (node.title === "unary_expr") {
        const [opNode, operand] = flat(node);
        if (lexemes(opNode).join("") === "*") return genExpr(operand, f);
    }
    if (node.title === "postfix_expr") {
        const [prim, tail] = kids;
        const tk = flat(tail);
        if (tk[0].lexeme === "[") return genIndexAddr(prim, tk[1], f);
    }
    throw new Error(`not an lvalue: ${node.title}`);
}

const ASSIGN_OPS = { "+=": "+", "-=": "-", "*=": "*", "&=": "&", "|=": "|", "^=": "^", "<<=": "<<", ">>=": ">>" };

function genAssign(node, f) {
    const [lhs, opNode, rhs] = flat(node);
    const op = lexemes(opNode).join("");
    const t = typeOf(lhs, f);
    if (t.endsWith("]")) throw new Error("cannot assign to an array");

    let value;
    if (op === "=") {
        value = genExpr(rhs, f);
    } else {
        const bin = ASSIGN_OPS[op];
        if (!bin) throw new Error(`unsupported assignment operator ${op}`);
        const sz = isPtr(t) && (bin === "+" || bin === "-") ? sizeOf(elemType(t)) : 1;
        value = [...genExpr(lhs, f), "PUSH R0", ...genExpr(rhs, f), ...scale(sz),
                 "POP R1", "SWAP R0, R1", `${BINOPS[bin]} R0, R1`];
    }

    const name = asIdentifier(lhs);
    if (name) return [...value, `${storeOp(t)} ${slot(name, f)}, R0`];     // fast path: plain variable
    return [...value, "PUSH R0", ...genAddr(lhs, f), "MOVE R1, R0", "POP R0", `${storeOp(t)} $0 + R1, R0`];
}

const strings = new Map();
function stringLabel(lexeme) {
    if (!strings.has(lexeme)) {
        const label = `str${strings.size}`;
        strings.set(lexeme, label);
        dataSection.push(`${label}: .string ${lexeme}`);
    }
    return strings.get(lexeme);
}

const CMP_OPS = { "==": ["Z", false], "!=": ["NZ", false], "<": ["C", false],
                  ">=": ["NC", false], ">": ["C", true], "<=": ["NC", true] };

function genBinary(node, f) {
    const { first, rest } = chain(node);

    if (node.title === "logical_and_expr" || node.title === "logical_or_expr") {
        const isAnd = node.title === "logical_and_expr";
        const short = newLabel(f, isAnd ? "false" : "true"), end = newLabel(f, "end");
        const lines = [];
        for (const operand of [first, ...rest.map((r) => r.rhs)]) {
            lines.push(...genExpr(operand, f), "CMP R0, #0", `JCON ${isAnd ? "Z" : "NZ"}, $${short}`);
        }
        lines.push(`LOAD R0, #${isAnd ? 1 : 0}`, `JUMP $${end}`, `${short}:`, `LOAD R0, #${isAnd ? 0 : 1}`, `${end}:`);
        return lines;
    }

    const lines = genExpr(first, f);
    let lhsType = typeOf(first, f);
    for (const { op, rhs } of rest) {
        const rhsLines = genExpr(rhs, f);
        const ptrMath = isPtr(lhsType) && (op === "+" || op === "-");
        if (ptrMath) rhsLines.push(...scale(sizeOf(elemType(lhsType))));
        lines.push("PUSH R0", ...rhsLines, "POP R1", "SWAP R0, R1");

        if (op in CMP_OPS) {
            const [cond, swap] = CMP_OPS[op];
            lines.push(swap ? "CMP R1, R0" : "CMP R0, R1", ...flagsToBool(cond, f));
        } else if (BINOPS[op]) {
            lines.push(`${BINOPS[op]} R0, R1`);
        } else {
            throw new Error(`unsupported operator ${op}`);
        }
        lhsType = ptrMath ? decay(lhsType) : "int";
    }
    return lines;
}


function genIncDec(lv, op, f, prefix) {
    const t = typeOf(lv, f);
    const step = isPtr(t) ? sizeOf(elemType(t)) : 1;
    return [
        ...genAddr(lv, f), "MOVE R2, R0",
        `${loadOp(t)} R0, $0 + R2`, "MOVE R1, R0",
        `${op === "++" ? "ADD" : "SUB"} R0, ${imm(step)}`,
        `${storeOp(t)} $0 + R2, R0`,
        ...(prefix ? [] : ["MOVE R0, R1"]),
    ];
}

function genUnary(node, f) {
    const [opNode, operand] = flat(node);
    const op = lexemes(opNode).join("");
    switch (op) {
        case "+": return genExpr(operand, f);
        case "-": return [...genExpr(operand, f), "MOVE R1, R0", "LOAD R0, #0", "SUB R0, R1"];
        case "~": return [...genExpr(operand, f), "NOT R0"];
        case "!": return [...genExpr(operand, f), "CMP R0, #0", ...flagsToBool("Z", f)];
        case "&": return genAddr(operand, f);
        case "*": return [...genExpr(operand, f), `${loadOp(typeOf(node, f))} R0, $0 + R0`];
        case "++": case "--": return genIncDec(operand, op, f, true);
    }
    throw new Error(`unsupported unary ${op}`);
}

function genPostfix(node, f) {
    const [prim, tail] = real(node);
    const tk = flat(tail);
    switch (tk[0].lexeme) {
        case "(": {
            const name = findIdentifier(prim);
            const list = tk.find((c) => c.title === "argument_expr_list");
            const args = list ? flattenArgs(list) : [];
            if (name === "out") return [...genExpr(args[0], f), "OUT R0"];
            return genFunctionCall(name, args.map((a) => genExpr(a, f)));
        }
        case "[": {
            const t = elemType(typeOf(prim, f));
            return [...genIndexAddr(prim, tk[1], f), `${loadOp(t)} R0, $0 + R0`];
        }
        case "++": case "--": return genIncDec(prim, tk[0].lexeme, f, false);
    }
    throw new Error(`unsupported postfix ${tk[0].lexeme}`);
}

function genString(lexeme) {
    return [`LOAD R0, #&${stringLabel(lexeme)}`];
}

function genExpr(node, f) {
    switch (node.tokenClass) {
        case "CONSTANT":       return [`LOAD R0, ${imm(constValue(node.lexeme))}`];
        case "STRING_LITERAL": return genString(node.lexeme);
        case "IDENTIFIER":     return genIdentifier(node.lexeme, f);
    }

    const kids = real(node);
    if (kids.length === 1) return genExpr(kids[0], f);
    if (BINARY.has(node.title)) return genBinary(node, f);

    switch (node.title) {
        case "primary_expr":
            return genExpr(kids.find((c) => c.title === "expr"), f);

        case "assignment_expr": return genAssign(node, f);
        case "unary_expr":      return genUnary(node, f);
        case "postfix_expr":    return genPostfix(node, f);

        case "postfix_expr": {
            const [prim, tail] = kids;
            const tk = real(tail);
            if (tk[0]?.lexeme === "(") {
                const name = findIdentifier(prim);
                const list = tk.find((c) => c.title === "argument_expr_list");
                const args = list ? flattenArgs(list) : [];
                if (name === "out") {
                    return [...genExpr(args[0], f), "OUT R0"];
                }
                return genFunctionCall(name, args.map((a) => genExpr(a, f)));
            }
            throw new Error(`unsupported postfix ${tk[0]?.lexeme}`);
        }
    }
    throw new Error(`genExpr: unhandled ${node.title}`);
}

function genStatement(node, f) {
    if (node.tokenClass) return [];
    const kids = real(node);

    switch (node.title) {
        case "compound_stmt":
        case "block_item_list":
        case "block_item_list_p":
        case "block_item":
        case "stmt":
            return kids.flatMap((k) => genStatement(k, f));

        case "expression_stmt": {
            const e = kids.find((k) => k.title === "expr");
            return e ? genExpr(e, f) : [];
        }

        case "selection_stmt": {
            const k = flat(node);
            if (k[0].lexeme !== "if") throw new Error("switch is not supported");
            const cond = k.find((c) => c.title === "expr");
            const stmts = k.filter((c) => c.title === "stmt");
            const elseL = newLabel(f, "else"), endL = newLabel(f, "endif");
            const out = [...genExpr(cond, f), "CMP R0, #0", `JCON Z, $${stmts[1] ? elseL : endL}`,
                        ...genStatement(stmts[0], f)];
            if (stmts[1]) out.push(`JUMP $${endL}`, `${elseL}:`, ...genStatement(stmts[1], f));
            out.push(`${endL}:`);
            return out;
        }

        case "iteration_stmt": {
            const k = flat(node);
            const kw = k[0].lexeme;
            const top = newLabel(f, "loop"), cont = newLabel(f, "cont"), end = newLabel(f, "end");
            const exprOf = (n) => real(n).find((c) => c.title === "expr");
            const test = (e, jumpIf, target) =>
                e ? [...genExpr(e, f), "CMP R0, #0", `JCON ${jumpIf}, $${target}`] : [];

            f.loops.push({ brk: end, cont });
            let out;
            if (kw === "while") {
                out = [`${cont}:`, ...test(k.find((c) => c.title === "expr"), "Z", end),
                    ...genStatement(k.find((c) => c.title === "stmt"), f), `JUMP $${cont}`, `${end}:`];
            } else if (kw === "do") {
                out = [`${top}:`, ...genStatement(k.find((c) => c.title === "stmt"), f), `${cont}:`,
                    ...test(k.find((c) => c.title === "expr"), "NZ", top), `${end}:`];
            } else if (kw === "for") {
                const open = k.findIndex((t) => t.lexeme === "(");
                const close = k.findIndex((t, i) => i > open && t.lexeme === ")");
                const [init, cond, step] = k.slice(open + 1, close);      // init: declaration or expression_stmt
                out = [...genStatement(init, f), `${top}:`, ...test(exprOf(cond), "Z", end),
                    ...genStatement(k.at(-1), f), `${cont}:`, ...(step ? genExpr(step, f) : []),
                    `JUMP $${top}`, `${end}:`];
            } else {
                throw new Error(`unsupported loop ${kw}`);
            }
            f.loops.pop();
            return out;
        }

        case "declaration": {
            const lines = [];
            for (const decl of collectDeclarators(node)) {
                const name = findIdentifier(decl);
                const init = findInitializer(node, name);
                if (!init) continue;

                const type = f.locals[name];
                const off = f.offsets[name];
                const toks = lexemes(init);

                if (type.endsWith("]")) {
                    if (!(toks.length === 1 && toks[0].startsWith('"')))
                        throw new Error(`${name}: only string initializers are supported for arrays`);

                    const src = stringLabel(toks[0]);
                    const loop = `_${f.name}_copy${labelId++}`;
                    lines.push(
                        "LOAD R1, #0",
                        "MOVE R2, R5",
                        `ADD R2, ${imm(off)}`,
                        `${loop}:`,
                        `LOADB R0, $${src} + R1`,
                        "STORB $0 + R2, R0",
                        "ADD R1, #1",
                        "ADD R2, #1",
                        "CMP R0, #0",
                        `JCON NZ, $${loop}`,
                    );
                } else {
                    const store = type === "char" || type.endsWith(" char") ? "STORB" : "STOR";
                    lines.push(...genExpr(init, f), `${store} ${local(off)}, R0`);
                }
            }
            return lines;
        }

        case "jump_stmt": {
            const kw = kids[0].lexeme;
            if (kw === "break")    return [`JUMP $${f.loops.at(-1).brk}`];
            if (kw === "continue") return [`JUMP $${f.loops.at(-1).cont}`];
            if (kw !== "return") throw new Error(`unsupported jump ${kw}`);
            const e = kids.find((k) => k.title === "expr");
            return [...(e ? genExpr(e, f) : []), `JUMP $_${f.name}_end`];
        }
    }
    throw new Error(`genStatement: unhandled ${node.title}`);
}


var functions = {};

function dump(node, depth = 0) {
    const label = node.title ?? `${node.tokenClass} ${JSON.stringify(node.lexeme)}`;
    node.children?.forEach((c) => dump(c, depth + 1));
}

function generateAssembly(code) {
    usedRuntime.clear();
    dataSection.length = 0;
    strings.clear();
    labelId = 0;
    const parsed = parseC(code);

    functions = {};
    walk(parsed, (node) => {
        if (node.title !== "function_definition") return;

        const declarator = node.children.find((c) => c.title === "declarator");
        const body = node.children.find((c) => c.title === "compound_stmt");
        const name = findIdentifier(declarator);
        const locals = findLocals(body);
        const params = findParams(declarator);
        functions[name] = { name, declarator, body, node, params, locals, loops: [] };

    });

    calculateOffsets(functions);

    const lines = ["CALL $_main", "HALT"];
    for (const f of Object.values(functions)) {
        lines.push(genFunctionDef(f, genStatement(f.body, f)));
    }

    for (const n of usedRuntime) lines.push(RUNTIME[n].asm.trim());

    lines.push(...dataSection);
    return lines.join("\n");
}

export { generateAssembly };