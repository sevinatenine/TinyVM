# TinyVM

TinyVM is a small virtual machine byte code executer, similar to JVM, written in NodeJS.
There is an ASM compiler to byte code and a C compiler. The C compiler is still under development and is incomplete and buggy.
ASM development is recommended over C development.

> NOTE: This section assumes that the command for TinyVM is `tinyvm`. You may need to subsitute or alias this to `node src/main.js` if you have not installed this from the NPM package and are instead running it just using NodeJS. 

If you clone this repo, you will need to `npm install`.

## Using the VM

The VM runs a special bytecode language. However, the NodeJS program can run TinyVM assembly and C directly.

### ASM programs

Assembly programs have their own language defined in the spec below.

#### Assembling

Assemble an assembly program to bytecode with:

```bash
tinyvm assemble program.s
```

By default, the program will drop the `.s` and add a `.tv` to show it is TinyVM bytecode.

You can run the program with:

```bash
tinyvm run program.tv
```

#### Testing

You can also run an assembly program without assembling it with:

```bash
tinyvm exec program.s
```

## C programs

You can compile C programs directly into byte code or you can turn them into assembly.

**NOTE:** The c compiler is still under development and lacks multiple C features. It is not a final version and will be modified to be more reliable in the future. It also produces very innefficient code and it is reccomended to make your programs in assembly over C.

### C Features

#### Supported
- [x] `int`, `char` (unsigned), `unsigned int`, `const`, and pointers to them (all 4 bytes except `char`)
- [x] Integer constants (decimal or `0x`), char constants (`\n \t \r \0 \\ \'`), string literals
- [x] `+ - * & | ^ << >>`, with `>>` always logical
- [x] Comparisons `== != < <= > >=`, **unsigned only**
- [x] `&&` / `||` with short-circuiting, returning 0 or 1
- [x] Unary `+ - ~ ! & *`, prefix and postfix `++` / `--`
- [x] `=` and compound assignment (`+= -= *= &= |= ^= <<= >>=`), including chained `a = b = c`
- [x] `if` / `else`, `while`, `do-while`, `for` (including `for (int i = 0; ...)`), `break`, `continue`, `return`
- [x] Local variables, scalar initialisers
- [x] Local arrays, with the size inferred from the initialiser (`char s[] = "hi"`)
- [x] Pointers, `p[i]`, and pointer arithmetic scaled by element size (`p + n`, `p - n`, `p += n`)
- [x] Functions: recursion, forward calls, any number of `int`/`char`/pointer params (cdecl, return in R0)
- [x] Array params (decay to pointers)
- [x] `char *s = "..."` string pointers
- [x] Runtime: `putchar`, `puts`, `println`, `getchar`, plus the `out(c)` intrinsic
- [x] `#include` / `#define` lines are stripped before parsing

#### Partial or buggy
- [ ] Scoping: locals are hoisted to function scope by name. Two `int i` in sibling blocks share one slot, and a same-named variable with a different type silently overwrites the first.
- [ ] Uninitialised locals contain stack garbage (this is standard C, but the stack is not zeroed)
- [ ] Pointer difference (`p - q`) scales the wrong operand, so it gives wrong results
- [ ] String escapes: `.string` uses `JSON.parse`, so `"\0"`, `"\'"` and `"\x41"` fail to assemble
- [ ] Integer suffixes (`10u`, `5L`) give `NaN`, and octal (`017`) is read as decimal
- [ ] A bare `unsigned x` fails with "unknown type" (`unsigned int x` works)
- [ ] Non-variable compound assignment (`a[i++] += 1`) evaluates the lvalue twice, so side effects happen twice
- [ ] User function calls don't check argument count (runtime functions do)
- [ ] Brace initialisers (`int a[] = {1,2,3}`) are sized correctly but then rejected in codegen

#### Not supported
- [ ] `/` and `%` (no DIV/MOD opcodes, so they need a runtime routine)
- [ ] `?:` ternary and the comma operator
- [ ] `switch` / `case` / `default` (throws "switch is not supported")
- [ ] `goto` and labels
- [ ] Casts and `sizeof`
- [ ] Global variables (any non-function top-level declaration is ignored, so uses give "undeclared identifier")
- [ ] `struct`, `union`, `enum`, `typedef`, `->` and `.`
- [ ] `short`, `long`, `long long`, `float`, `double`, signed `char`
- [ ] Function pointers (calls are always `CALL $_name`)
- [ ] Signed semantics: signed comparison, arithmetic `>>`, signed division
- [ ] Macro expansion (`#define` is dropped, not expanded), `#include`, `#ifdef`
- [ ] `printf` and variadics, `malloc` / `free`, `argc` / `argv`, `exit`
- [ ] Adjacent string literal concatenation
- [ ] Multiple translation units or linking
- [ ] More than 64 KB of code, data and stack combined (there is no stack overflow check)

### Compiling

To compile a c program to byte code, run:

```bash
tinyvm compile program.c
```

To run it, run:

```bash
tinyvm run program.tv
```

> To view the generated assembly, run `tinyvm compile --asm program.c`

### For testing

To run a program without assembling, you can run it with:

```bash
tinyvm exec-c program.c
```

## Examples

There are a few examples provided in the `/examples` folder that can be run from the NodeJS program.

To try the hello world assembly program run:

```bash
tinyvm exec examples/asm/hello_world.s
```

## VM Specs

### Registers

All registers are 32 bits (unsigned). Registers are encoded as 1 byte.

| Name | Encoding | Notes                                   |
|------|----------|-----------------------------------------|
| R0   | 0        | general purpose                         |
| R1   | 1        | general purpose                         |
| R2   | 2        | general purpose                         |
| R3   | 3        | general purpose                         |
| R4   | 4        | general purpose                         |
| R5   | 5        | general purpose                         |
| SP   | 6        | stack pointer, starts at 10000          |

SP is a normal register operand, so `ADD SP, #4` and `MOVE R5, SP` work.

Not addressable as operands:
- `PC`: program counter, 16 bits (execution errors if it runs past FFFF)
- Flags: `Z` (zero), `N` (negative), `C` (carry/borrow), tested with `JCON`

### Instructions

> Instructions have a 1 byte opcode followed by variable length operand(s)

All values hex, multi-byte values big-endian.

#### Operand encoding

| Kind            | Syntax                         | Size                     |
|-----------------|--------------------------------|--------------------------|
| Register        | R0-R5, SP                      | 1 byte                   |
| Immediate       | #<value>, #-<value>, #&<label> | 4 bytes                  |
| Address         | $<addr>                        | 2 bytes                  |
| Indexed address | $<addr> + <reg>                | 3 bytes (addr, then reg) |
| Condition       | Z, NZ, C, NC, N                | 1 byte                   |

Immediates are 32-bit (negatives are two's complement).
`#&label` loads the address of a label as a 32-bit immediate.
Indexed address = (addr + reg) & FFFF. Addresses can be hex or a label.

#### Machine

- Memory: 64 KB (0000-FFFF), program loaded at 0000.
- Word accesses (LOAD, STOR, PUSH, POP, CALL, RET) are 32-bit big-endian.
- Stack: SP starts at 10000 (wraps to 0000 on access), grows down, 4 bytes per entry.
- CALL pushes the address of the next instruction.
- Execution errors: invalid opcode, pc running past FFFF, cycle limit (50M default).

#### Flags

ADD, SUB, MUL, CMP, AND, OR, XOR, NOT, SHL, SHR set Z/N/C.
LOAD, LOADB, STOR, STORB, MOVE, SWAP, jumps, stack ops, and I/O leave them alone.

- Z = result is 0
- N = bit 31 of result

C by instruction:

| Instruction     | C is set when                                  |
|-----------------|------------------------------------------------|
| ADD             | carry out                                      |
| SUB, CMP        | borrow (a < b, unsigned)                       |
| MUL             | result overflowed 32 bits                      |
| AND/OR/XOR/NOT  | never (cleared)                                |
| SHL             | last bit shifted out the top (0 if count is 0) |
| SHR             | last bit shifted out the bottom (0 if count is 0) |

SHL/SHR with count >= 32 give 0.
CMP computes a - b, sets flags, and discards the result.

JCON cond: 0=Z, 1=NZ, 2=C, 3=NC, 4=N

#### Opcodes

##### Data movement
```
00: LOAD <reg>, #<value>
01: LOAD <reg>, $<addr>          ; 32-bit read
02: LOAD <reg>, $<addr> + <reg>
03: STOR $<addr>, <reg>          ; 32-bit write
04: STOR $<addr> + <reg>, <reg>
05: STOR $<addr>, #<value>
06: MOVE <dst reg>, <src reg>
07: SWAP <reg a>, <reg b>
```

##### Arithmetic
```
08: ADD <reg>, #<value>
09: ADD <reg>, <reg b>
0A: ADD <reg>, $<addr>
0B: SUB <reg>, #<value>
0C: SUB <reg>, <reg b>
0D: SUB <reg>, $<addr>
0E: MUL <reg>, #<value>
0F: MUL <reg>, <reg b>
10: MUL <reg>, $<addr>
```

##### Compare
```
11: CMP <reg>, #<value>
12: CMP <reg>, $<addr>
13: CMP <reg a>, <reg b>
```

##### Byte access
```
14: LOADB <reg>, $<addr>          ; zero-extended byte
15: LOADB <reg>, $<addr> + <reg>
16: STORB $<addr>, <reg>          ; stores low byte
17: STORB $<addr> + <reg>, <reg>

18-19: reserved (For the future)
```

##### Jumps
```
1A: JUMP $<addr>
1B: JUMP $<addr> + <reg>
1C: JUMP <reg>                    ; uses low 16 bits
1D: reserved
1E: JCON <cond>, $<addr>
```

##### Stack / calls
```
1F: PUSH <reg>
20: PUSH #<value>
21: POP <reg>
22: CALL $<addr>
23: CALL <reg>                    ; uses low 16 bits
24: RET
```

##### Control
```
25: HALT
26: NOP
```

##### Logic
```
27: AND <reg>, #<value>
28: AND <reg>, <reg b>
29: AND <reg>, $<addr>
2A: OR  <reg>, #<value>
2B: OR  <reg>, <reg b>
2C: OR  <reg>, $<addr>
2D: XOR <reg>, #<value>
2E: XOR <reg>, <reg b>
2F: XOR <reg>, $<addr>
30: NOT <reg>
```

##### Shifts
```
31: SHL <reg>, #<count>
32: SHL <reg>, <reg b>
33: SHR <reg>, #<count>
34: SHR <reg>, <reg b>
```

##### I/O
```
35: OUT <reg>                     ; writes low byte as a character to stdout
36: OUT #<value>                  ; same, low byte of immediate
37: IN <reg>                      ; reads 1 byte from stdin, 0 on EOF
```

38-FF: invalid

### Assembler syntax

- `;` starts a comment.
- `label:` defines a label (can share a line with an instruction).
- `.string "text"` emits UTF-8 bytes plus a 0 terminator (JSON string escapes allowed).
- Mnemonics and register/condition names are case-insensitive.
- Numbers are always hex, with no prefix (`#FF`, `#-1`, `$1F00`).
- A name that matches a label is resolved as the label first, so a label like `ABC` shadows the hex value ABC.