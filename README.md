# TinyVM

TinyVM is a small virtual machine byte code executer, similar to JVM, written in NodeJS.
There is an ASM compiler to byte code and a C compiler. The C compiler is still under development and is incomplete and buggy.
ASM development is recommended over C development.

> NOTE: This section assumes that the command for TinyVM is `tinyvm`. You may need to substitute or alias this to `node src/main.js` if you have not installed this from the NPM package and are instead running it just using NodeJS.

If you clone this repo, you will need to `npm install`.

## Installing

### From npm

Run it without installing anything:

```bash
npx tinyvm example asm/hello_world
```

Or install it globally to get the `tinyvm` command:

```bash
npm install -g tinyvm
tinyvm examples                     # list bundled examples
tinyvm example asm/hello_world
```

### From GitHub

```bash
git clone https://github.com/sevinatenine/TinyVM
cd TinyVM
npm install
node src/main.js example asm/hello_world
```

To get the `tinyvm` command from your clone, run `npm link` once.

## Using the VM

The VM runs a special bytecode language. However, the NodeJS program can run TinyVM assembly and C directly.

| Command | What it does |
|---|---|
| `tinyvm assemble <file.s>` | assemble to bytecode |
| `tinyvm examples` | lists examples |
| `tinyvm example <example_name>` | runs an example |
| `tinyvm compile <file.c>` | compile C to bytecode (`-a` / `--asm` writes assembly instead) |
| `tinyvm run <file.tv>` | run a bytecode file |
| `tinyvm exec <file.s>` | assemble and run in one step |
| `tinyvm exec-c <file.c>` | compile, assemble and run in one step |
| `tinyvm dis <file.tv>` | disassemble a bytecode file (`-n` / `--no-addr` hides addresses) |

`assemble` and `compile` accept `-o <file.tv>` to choose the output name. By default the input extension is dropped and `.tv` is added.

### ASM programs

Assembly programs have their own language defined in the spec below. There is a standard library for ASM programs but it is still work in progress as well.

#### Assembling

Assemble an assembly program to bytecode with:

```bash
tinyvm assemble program.s
```

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

You can compile C programs directly into byte code or you can turn them into assembly. I used AI to help me with some of the C compiler because it was very confusing and complicated. (Someone pls make GCC).

**NOTE:** The C compiler is still under development and lacks multiple C features. It is not a final version and will be modified to be more reliable in the future. It also produces very inefficient code and it is recommended to make your programs in assembly over C.

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
- [ ] Very small standard library
- [ ] Multiple files

### Compiling

To compile a C program to byte code, run:

```bash
tinyvm compile program.c
```

To run it, run:

```bash
tinyvm run program.tv
```

> To view the generated assembly, run `tinyvm compile --asm program.c`. The assembly is written to `program.tv` unless you pass `-o program.s`.

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
`#a|#b|...` ORs several immediates together at assembly time (used for flags, e.g. `O_WRITE|O_CREATE`).
Indexed address = (addr + reg) & FFFF. Addresses can be hex or a label.

#### Machine

- Memory: 64 KB (0000-FFFF), program loaded at 0000.
- Word accesses (LOAD, STOR, PUSH, POP, CALL, RET) are 32-bit big-endian.
- Stack: SP starts at 10000 (wraps to 0000 on access), grows down, 4 bytes per entry.
- CALL pushes the address of the next instruction.
- Execution errors: invalid opcode, unknown syscall number, pc running past FFFF, cycle limit (50M default).

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
38: SYS #<value>                  ; makes a syscall of type value
                                  ; R0 - R5 are the inputs and outputs of the syscall
```

39-FF: invalid

### Syscalls

Programs call into the host with `SYS #n`. The `lib/syscalls.s` library wraps each call in a function (`sys_*`) and a macro (`SYS_*`), so you rarely write the number yourself.

#### Calling convention

- **Arguments** go in `R0`, `R1` and `R2`, in the order listed for each call below.
- **Success:** carry flag clear, result in `R0` (some calls also return values in `R1` and `R2`).
- **Failure:** carry flag set, error code in `R0`. Check with `JCON C, $label` straight after the call, before any instruction that changes the flags or `R0`.
- **Strings** are NUL-terminated. A path argument is a pointer to one.
- **Pointers** are 16 bit. A buffer that runs past the end of memory fails with `E_FAULT`.
- **Numbers** in assembly are hex: `#a` is 10, `#64` is 100.
- **Unknown syscall numbers** stop the VM with a runtime error.

#### System

| No. | Name | In | Out |
|---|---|---|---|
| `0x01` | `rand` | | `R0` = 32-bit random number |
| `0x02` | `time` | | `R0` = Unix time in seconds |
| `0x03` | `sleep` | `R0` = milliseconds (capped at 10 000) | `R0` = 0 |
| `0x04` | `ticks` | | `R0` = milliseconds since the VM started (wraps at 2^32) |
| `0x05` | `datetime` | `R0` = pointer to an 8-byte buffer, `R1` = 0 local / 1 UTC | `R0` = 8 |
| `0x06` | `meminfo` | `R1` = type (see below) | `R0` = MiB |

**`datetime` buffer layout:** year (u16, big-endian), month (1-12), day (1-31), hour, minute, second, weekday (0 = Sunday). Fails with `E_FAULT` if the buffer runs past the end of memory.

**`meminfo` types:** `0` total system memory, `1` free system memory, `2` memory used by the VM's host process (resident set). The type goes in `R1`, not `R0`. Any other value fails with `E_INVAL`.

#### Opening handles

Every open call returns a **handle** (a small number) in `R0`. Handles `0`, `1` and `2` are always open as stdin, stdout and stderr, and new handles are numbered from 3 (handles go up to 63, so at most 61 can be open at once).

| No. | Name | In | Out |
|---|---|---|---|
| `0x10` | `openfile` | `R0` = path, `R1` = flags | `R0` = handle |
| `0x11` | `opendir` | `R0` = path | `R0` = handle |
| `0x12` | `opensocket` | `R0` = kind, `R1` = options | not implemented |
| `0x13` | `openserial` | `R0` = path, `R1` = baud | not implemented |
| `0x14` | `accept` | `R0` = listening socket | not implemented |

Calls marked "not implemented" always fail with `E_NOSYS`.

**`openfile` errors:** `E_ACCES` (path outside the sandbox), `E_NOENT`, `E_ISDIR` (the path is a directory), `E_MFILE` (too many open handles), plus `E_IO` for anything else.

**`opendir` errors:** `E_ACCES`, `E_NOENT`, `E_NOTDIR` (the path isn't a directory), `E_MFILE`.

**Open flags** are bits, combined with `|`. For example, `O_WRITE|O_CREATE|O_TRUNC` is assembled into one immediate.

| Flag | Value | Meaning |
|---|---|---|
| `O_READ` | `#1` | open for reading |
| `O_WRITE` | `#2` | open for writing |
| `O_CREATE` | `#4` | create the file if it doesn't exist |
| `O_TRUNC` | `#8` | empty the file when opening |
| `O_APPEND` | `#10` | every write goes to the end of the file (implies write) |
| `O_WRITE_NEW` | `#e` | shortcut for `O_WRITE\|O_CREATE\|O_TRUNC` |
| `O_WRITE_ADD` | `#16` | shortcut for `O_WRITE\|O_CREATE\|O_APPEND` |

With neither `O_READ` nor `O_WRITE`, the file opens read-only. Newly created files get mode `0666` (before the host's umask).

#### Operations on handles

| No. | Name | In | Out |
|---|---|---|---|
| `0x1A` | `read` | `R0` = handle, `R1` = buffer, `R2` = length | `R0` = bytes read (0 = end of file) |
| `0x1B` | `write` | `R0` = handle, `R1` = buffer, `R2` = length | `R0` = bytes written |
| `0x1C` | `close` | `R0` = handle | `R0` = 0 |
| `0x1D` | `seek` | `R0` = handle, `R1` = offset (signed), `R2` = whence | `R0` = new position |
| `0x1E` | `ctl` | `R0` = handle, `R1` = request, `R2` = argument | always fails with `E_INVAL` for now |
| `0x1F` | `fstat` | `R0` = handle | `R0` = size, `R1` = type, `R2` = modified time (seconds) |

- **`read` may return fewer bytes than asked for.** Reading stdin gives you one line at a time, so loop until you get 0. Handles 1 and 2 can't be read, and handle 0 can't be written (`E_BADF`).
- **Each file handle keeps its own position,** shared by `read`, `write` and `seek`. Append handles always write at the end.
- **Directory handles:** each `read` returns one entry name as a NUL-terminated string, with `R0` = the name's length (0 when there are no more entries). `R2` must be at least the name length plus 1, otherwise `E_RANGE`. The list is a snapshot taken when the directory was opened and doesn't include `.` or `..`. `write` fails with `E_ISDIR`. `seek` only supports rewinding (offset `#0`, `SEEK_SET`).
- **`seek` whence:** `SEEK_SET` (`#0`) from the start, `SEEK_CUR` (`#1`) from the current position, `SEEK_END` (`#2`) from the end. Seeking a terminal fails with `E_SPIPE`. A bad whence or a negative result fails with `E_INVAL`.
- **`fstat` types:** `FTYPE_FILE` (`#0`), `FTYPE_DIR` (`#1`), `FTYPE_CHAR` (`#2`, anything else, such as a terminal). Directories and terminals report size 0; terminals also report time 0.
- **`close` frees the handle** even if the underlying close reports an error. Files left open when the VM stops are closed automatically.

#### Filesystem

| No. | Name | In | Out |
|---|---|---|---|
| `0x20` | `rename` | `R0` = old path, `R1` = new path | |
| `0x21` | `unlink` | `R0` = path | |
| `0x22` | `mkdir` | `R0` = path | |
| `0x23` | `rmdir` | `R0` = path | |
| `0x24` | `stat` | `R0` = path | `R0` = size, `R1` = type (as `fstat`), `R2` = modified time |
| `0x25` | `chdir` | `R0` = path | |
| `0x26` | `getcwd` | `R0` = buffer, `R1` = max length | `R0` = length (without the NUL) |

- `unlink` removes files, `rmdir` removes empty directories (`E_NOTEMPTY` otherwise), and `mkdir` creates one directory (it does not create parents). `mkdir` fails with `E_EXIST` if the path exists.
- `getcwd` fails with `E_RANGE` if the path plus its NUL doesn't fit in `R1` bytes. **It returns the real host path,** not a path relative to the sandbox root.
- `chdir` changes the directory that relative paths are resolved against, and it must stay inside the sandbox.

#### Paths

Paths are resolved against the VM's current directory and kept inside a sandbox root (the directory `node` was started from). A path that leaves the root, such as `../../etc/passwd`, fails with `E_ACCES`. Symlinks are not resolved, so a symlink inside the root can still point outside it.

#### Error codes

| Name | Value | Meaning |
|---|---|---|
| `E_NOENT` | 2 | no such file or directory |
| `E_IO` | 5 | I/O error |
| `E_BADF` | 9 | bad or closed handle, or the operation isn't allowed on it |
| `E_ACCES` | 13 | permission denied, or path outside the sandbox |
| `E_FAULT` | 14 | pointer outside memory |
| `E_EXIST` | 17 | already exists |
| `E_NOTDIR` | 20 | not a directory |
| `E_ISDIR` | 21 | is a directory |
| `E_INVAL` | 22 | invalid argument |
| `E_MFILE` | 24 | too many open handles |
| `E_SPIPE` | 29 | can't seek on this handle |
| `E_RANGE` | 34 | buffer too small |
| `E_NOSYS` | 38 | not implemented |
| `E_NOTEMPTY` | 39 | directory not empty |

Error codes are plain numbers in `R0`, so `PRINT_R_DEC` shows them in decimal. `lib/syscalls.s` defines each name above as a constant (written in hex, e.g. `E_RANGE` is `#22`), so you can compare against them: `CMP R0, E_NOENT`. Errors the host reports that aren't in this list show up as `E_IO`.

#### Assembly wrappers

Each syscall has a function (`sys_name`, registers as in the tables above) and a macro (`SYS_NAME`).

| Macro | Notes |
|---|---|
| `SYS_RAND`, `SYS_TIME`, `SYS_TICKS` | no arguments, result in `R0` |
| `SYS_SLEEP ms` / `SYS_R_SLEEP reg` | milliseconds as an immediate / from a register. These restore `R0` afterwards. |
| `SYS_DATETIME buffer, utc` | `utc` is `TZ_LOCAL` or `TZ_UTC` |
| `SYS_MEM_INFO type` | `SYS_MEM_TOTAL`, `SYS_MEM_FREE` or `SYS_MEM_PROCESS` |
| `SYS_OPEN_FILE path, flags` | `path` is a label, `flags` an immediate |
| `SYS_OPEN_DIR path` | `path` is a label |
| `SYS_OPEN_SOCKET kind, options`, `SYS_OPEN_SERIAL path, baud`, `SYS_SOCKET_ACCEPT handle` | not implemented, always fail with `E_NOSYS` |
| `SYS_READ handle, buffer, length` | `handle` is a register, `buffer` a label, `length` an immediate |
| `SYS_WRITE handle, buffer, length` | same as `SYS_READ` |
| `SYS_WRITE_IMM handle, data, length` | like `SYS_WRITE`, but `handle` is an immediate such as `STDOUT` |
| `SYS_CLOSE handle` | `handle` is a register |
| `SYS_SEEK handle, offset, whence` | `handle` is a register, the others immediates |
| `SYS_CTL handle, request, arg` | `handle` is a register, the others immediates |
| `SYS_FSTAT handle` | `handle` is a register; results in `R0`, `R1`, `R2` |
| `SYS_RENAME old, new` | both are labels |
| `SYS_UNLINK path`, `SYS_MKDIR path`, `SYS_RMDIR path`, `SYS_CHDIR path` | `path` is a label |
| `SYS_STAT path` | `path` is a label; results in `R0`, `R1`, `R2` |
| `SYS_GETCWD buffer, max` | `buffer` is a label, `max` an immediate |

The macros save and restore the argument registers they overwrite, but leave `R0` alone since that holds the result. The exceptions are `SYS_STAT` and `SYS_FSTAT`, which overwrite `R1` and `R2` because those hold return values. The flags survive, so `JCON C` works straight after a macro. If a length or offset is in a register, set up the registers yourself and call the `sys_*` function instead.

#### Example

```asm
%include "lib/syscalls.s"
%include "lib/io.s"

    SYS_OPEN_FILE filename, O_WRITE_NEW
    JCON C, $fail              ; carry set: R0 = error code
    MOVE R4, R0                ; keep the handle

    SYS_WRITE R4, message, #5
    JCON C, $fail

    SYS_CLOSE R4
    HALT

fail:
    MOVE R4, R0
    PRINT_LIT "Failed, error "
    PRINT_R_DEC R4
    OUT #a
    HALT

filename: .string "out.txt"
message: .string "hello"
```

### Standard library

All of these live in `lib/`. Each file starts with a header listing every function and macro, what goes in and out, and which registers it changes.

| File | Contents |
|---|---|
| `syscalls.s` | `sys_*` functions and `SYS_*` macros, error codes (`E_*`), `TZ_LOCAL` / `TZ_UTC`, memory types (`SYS_MEM_*`). Includes `files.s`. |
| `files.s` | open flags (`O_*`), standard handles (`STDIN`, `STDOUT`, `STDERR`), `SEEK_*`, `FTYPE_*` |
| `io.s` | `puts`, `println`, `printchar`, `printhex`, `printdec`, `getc`, `readline`, `strlen`, `strcmp`, `atoi`, `itoa`, `divmod10`, and the `PRINT*` / `READ_LINE` / `STRLEN` / `STRCMP` macros |
| `datetime.s` | `PRINT_DATETIME` macro. Include `syscalls.s` and `io.s` first. On failure it jumps to a label called `fail`, which your program must define. |
| `util.s` | `REPEAT` macro (uses `R5`) |

Libraries have no include guards. Include each file once only (`syscalls.s` already includes `files.s`), otherwise the assembler reports a duplicate definition.

### Assembler syntax

- `;` starts a comment.
- `label:` defines a label (can share a line with an instruction).
- `.string "text"` emits UTF-8 bytes plus a 0 terminator (JSON string escapes allowed). A `;` inside the string is treated as the start of a comment, so avoid it.
- `.space n` emits `n` zero bytes (`n` is decimal).
- `%include "filename"` inserts the contents of the file wherever the include statement is. The path is relative to the file that contains the include, and circular includes are an error.
- `%define NAME value` replaces `NAME` with `value` everywhere after it (not inside strings). A name can only be defined once, and register, condition and instruction names are reserved.
- `%macro NAME param1, param2` ... `%endmacro` defines a macro, used like an instruction: `NAME arg1, arg2`. Parameters are replaced by the arguments as text. A name starting with `@` inside the body (such as `@loop`) becomes a label that is unique for each use. Macros can call other macros, but can't be nested inside each other.
- Includes are expanded first, then macros, then defines.
- Mnemonics and register/condition names are case-insensitive.
- Numbers are always hex, with no prefix (`#FF`, `#-1`, `$1F00`).
- A name that matches a label is resolved as the label first, so a label like `ABC` shadows the hex value ABC.