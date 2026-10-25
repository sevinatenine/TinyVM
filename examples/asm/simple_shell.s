%include "lib/io.s"
%include "lib/syscalls.s"

    PRINTLN_LIT "Simple shell (v1.0)"

cmd_loop:
    LOAD R5, #0
    LOAD R0, #&cmd
    STORB $0 + R0, R5
    LOAD R0, #&arg0
    STORB $0 + R0, R5
    LOAD R0, #&arg1
    STORB $0 + R0, R5
    LOAD R0, #&arg2
    STORB $0 + R0, R5
    LOAD R0, #&arg3
    STORB $0 + R0, R5
    PRINT_LIT "> "
    READ_LINE cmd_buffer, #FF

split:
    LOAD R0, #&cmd_buffer
    LOAD R4, #&cmd
    MOVE R1, R4
    LOAD R5, #0

tok_loop:
    LOADB R2, $0 + R0
    CMP R2, #0
    JCON Z, $tok_done
    CMP R2, #20
    JCON Z, $tok_space

    STORB $0 + R1, R2
    ADD R1, #1
    ADD R0, #1
    JUMP $tok_loop

tok_space:
    STORB $0 + R1, R5
    ADD R4, #40
    MOVE R1, R4
    ADD R0, #1
    JUMP $tok_loop

tok_done:
    STORB $0 + R1, R5

    ; PRINT_LIT "Command: "
    ; PRINTLN cmd

    ; PRINT_LIT "Arg 0: "
    ; PRINTLN arg0

    ; PRINT_LIT "Arg 1: "
    ; PRINTLN arg1

    ; PRINT_LIT "Arg 2: "
    ; PRINTLN arg2

    ; PRINT_LIT "Arg 3: "
    ; PRINTLN arg3

    LOAD R0, #&cmd
    LOADB R2, $0 + R0
    CMP R2, #0
    JCON Z, $cmd_loop       ; empty line

    STRCMP cmd, str_help
    CMP R0, #0
    JCON Z, $do_help

    STRCMP cmd, str_ls
    CMP R0, #0
    JCON Z, $do_ls

    STRCMP cmd, str_pwd
    CMP R0, #0
    JCON Z, $do_pwd

    STRCMP cmd, str_echo
    CMP R0, #0
    JCON Z, $do_echo

    STRCMP cmd, str_quit
    CMP R0, #0
    JCON Z, $exit

    PRINT_LIT "Unknown command: "
    PRINTLN cmd
    JUMP $cmd_loop

str_echo: .string "echo"
str_help: .string "help"
str_quit: .string "quit"
str_ls: .string "ls"
str_pwd: .string "pwd"

do_help:
    PRINTLN_LIT "Commands: help, quit, ls, pwd, echo"
    JUMP $cmd_loop

do_ls:
    SYS_OPEN_DIR ls_dot
    JCON C, $ls_fail
    MOVE R3, R0             ; keep the handle
ls_loop:
    SYS_READ R3, ls_buf, #40   ; R0 = name length, 0 at end (#40 = 64 bytes)
    JCON C, $ls_fail
    CMP R0, #0
    JCON Z, $ls_done
    MOVE R2, R0             ; name length
    LOAD R0, #1             ; stdout
    LOAD R1, #&ls_buf
    CALL $sys_write
    OUT #A                  ; newline
    JUMP $ls_loop
ls_done:
    SYS_CLOSE R3
    JUMP $cmd_loop
ls_fail:
    LOAD R0, #&ls_error
    JUMP $error
ls_dot:    .string "."
ls_buf:    .space 64
ls_error:  .string "ls: failed to read dir"

do_echo:
    PRINT arg0
    PRINT_CHAR #20
    PRINT arg1
    PRINT_CHAR #20
    PRINT arg2
    PRINT_CHAR #20
    PRINT arg3
    OUT #A
    JUMP $cmd_loop

do_pwd:
    SYS_GETCWD pwd_buf, #FF
    PRINTLN pwd_buf
    JCON C, $pwd_fail

    JUMP $cmd_loop
pwd_fail:
    LOAD R0, #&pwd_error
    JUMP $error
pwd_buf:    .space 255
pwd_error: .string "pwd: failed to get cwd"

error:
    PRINT_LIT "\nFatal error: "
    CALL $puts
    PRINT_LIT "\nExiting.\n"
exit:
    HALT

cmd_buffer: .space 256
output: .space 514
_zero: .string ""
cmd: .space 64
arg0: .space 64
arg1: .space 64
arg2: .space 64
arg3: .space 64