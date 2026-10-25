%include "lib/io.s"
%include "lib/syscalls.s"

    PRINTLN_LIT "First 15 fibonacci numbers:"
    LOAD R0, #1
    LOAD R1, #1
    LOAD R2, #0

loop:
    ADD R0, R1
    SWAP R0, R1
    PRINT_R_DEC R0
    OUT #a

    ADD R2, #1
    CMP R2, #F
    JCON Z, $done

    JUMP $loop
done:
    HALT