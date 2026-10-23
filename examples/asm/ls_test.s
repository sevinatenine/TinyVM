%include "lib/io.s"
%include "lib/syscalls.s"

        PRINT_LIT "File listing:\n\n"

        SYS_OPEN_DIR dot
        JCON C, $fail
        MOVE R3, R0             ; keep the handle
loop:
        SYS_READ R3, buf, #40   ; R0 = name length, 0 at end (#40 = 64 bytes)
        JCON C, $fail
        CMP R0, #0
        JCON Z, $done
        MOVE R2, R0             ; name length
        LOAD R0, #1             ; stdout
        LOAD R1, #&buf
        CALL $sys_write
        OUT #A                  ; newline
        JUMP $loop
done:
        SYS_CLOSE R3
fail:
        HALT
dot:    .string "."
buf:    .space 64