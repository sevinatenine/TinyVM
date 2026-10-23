%include "lib/io.s"
%include "lib/syscalls.s"

    PRINTLN_LIT "Guess a number 0-127!"
    SYS_RAND
    AND R0, #7F
    MOVE R5, R0
loop:
    PRINT_LIT "> "
    READ_LINE buffer, #10
    LOAD R0, #&buffer
    CALL $atoi

    CMP R0, R5
    JCON Z, $equal      ; guess == target
    JCON C, $less       ; guess < target (too low)
    PRINTLN_LIT "Too high!"
    JUMP $loop

less:
    PRINTLN_LIT "Too low!"
    JUMP $loop

equal:
    PRINTLN_LIT "You got it!"
    HALT

    HALT

buffer: .space 18
buffer2: .space 8