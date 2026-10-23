%include "lib/io.s"
%include "lib/syscalls.s"
%include "lib/datetime.s"



    ; LOAD R0, #&message
    ; CALL $puts

    ; LOAD R0, #&buffer
    ; LOAD R1, #14
    ; CALL $readline
    ; MOVE R4, R0

    ; LOAD R0, #&message2
    ; CALL $puts
    ; LOAD R0, #&buffer
    ; CALL $puts

    ; LOAD R0, #&buffer
    ; LOAD R1, #&expected
    ; CALL $strcmp
    ; CMP R0, #0
    ; JCON NZ, $not_equal

;     LOAD R0, #&message3
;     CALL $println
;     JUMP $done

; not_equal:
;     LOAD R0, #&message4
;     CALL $println

; done:
    ; MOVE R0, R4
    ; CALL $printhex

    ; LOAD R0, #&message5
    ; CALL $println

    ; CALL $rand
    ; CALL $printhex

    ; HALT

; buffer: .space 21
; expected: .string "hello\n"
; message: .string "Hello, World!\nType \"hello\"\n> "
; message2: .string "You typed: "
; message3: .string "Equal!"
; message4: .string "Not equal :("
; message5: .string "Random test"

    PRINT_LIT "Syscall test\n\n"

    PRINT_LIT "0x01 Rand: "
    SYS_RAND
    PRINT_R_HEX R0
    OUT #a

    PRINT_LIT "0x02 Time: "
    SYS_TIME
    PRINT_R_DEC R0
    OUT #a

    PRINT_LIT "0x03 Sleep (100 ms): "
    SYS_TICKS
    MOVE R4, R0
    SYS_SLEEP #64
    SYS_TICKS
    SUB R0, R4
    PRINT_LIT "Took "
    PRINT_R_DEC R0
    PRINT_LIT " ms"
    OUT #a

    PRINT_LIT "0x04 Ticks: "
    SYS_TICKS
    PRINT_R_DEC R0
    PRINT_LIT " ms since vm start"
    OUT #a

    PRINT_LIT "0x05 Datetime: "
    PRINT_DATETIME
    OUT #a

    PRINT_LIT "0x06 Memory: "
    SYS_MEM_INFO SYS_MEM_FREE
    PRINT_R_DEC R0
    PRINT_LIT " MB free / "
    SYS_MEM_INFO SYS_MEM_TOTAL
    PRINT_R_DEC R0
    PRINT_LIT " MB total (VM process: "
    SYS_MEM_INFO SYS_MEM_PROCESS
    PRINT_R_DEC R0
    PRINT_LIT " MB)\n"

        PRINT_LIT "0x10 Open a file ("
    PRINT filename
    PRINT_LIT "): "
    SYS_OPEN_FILE filename, O_WRITE|O_CREATE|O_TRUNC
    JCON C, $fail
    MOVE R4, R0
    PRINT_LIT "Handle "
    PRINT_R_DEC R4
    OUT #a

    PRINT_LIT "0x1B Write to STDOUT: "
    SYS_WRITE_IMM STDOUT, message, #5
    JCON C, $fail
    OUT #a

    PRINT_LIT "0x1B Write to file: "
    SYS_WRITE R4, message, #5
    JCON C, $fail
    PRINT_R_DEC R0
    OUT #a

    PRINT_LIT "0x10 Open in append ("
    PRINT filename2
    PRINT_LIT "): "
    SYS_OPEN_FILE filename2, O_WRITE|O_CREATE|O_APPEND
    JCON C, $fail
    MOVE R5, R0
    PRINT_LIT "Handle "
    PRINT_R_DEC R5
    OUT #a

    PRINT_LIT "0x1B Append write: "
    SYS_WRITE R5, message, #5
    JCON C, $fail
    PRINT_R_DEC R0
    OUT #a

    SYS_CLOSE R4
    JCON C, $fail
    SYS_CLOSE R5
    JCON C, $fail

    PRINT_LIT "0x1A Read back: "
    SYS_OPEN_FILE filename, O_READ
    JCON C, $fail
    MOVE R4, R0
    SYS_READ R4, buffer, #5
    JCON C, $fail
    PRINT buffer
    OUT #a

    SYS_CLOSE R4

    PRINT_LIT "Incrementing counting file ("
    PRINT filename3
    PRINT_LIT "): "
    SYS_OPEN_FILE filename3, O_READ|O_CREATE
    JCON C, $fail
    MOVE R4, R0
    SYS_READ R4, buffer2, #a 
    JCON C, $fail
    SYS_CLOSE R4

    LOAD R0, #&buffer2
    CALL $atoi
    ADD R0, #1

    LOAD R1, #&out
    CALL $itoa
    MOVE R5, R0

    PRINT_LIT "New value: "
    PRINT out
    OUT #a

    SYS_OPEN_FILE filename3, O_WRITE|O_TRUNC
    JCON C, $fail
    MOVE R4, R0
    MOVE R0, R4
    LOAD R1, #&out
    MOVE R2, R5
    CALL $sys_write
    JCON C, $fail
    SYS_CLOSE R4
    HALT

    HALT

fail:
    MOVE R4, R0
    PRINT_LIT "Failed, error "
    PRINT_R_DEC R4
    OUT #a
    HALT

buffer: .space 8
buffer2: .space 12
out: .space 12
message: .string "hello"
filename: .string "test.txt"
filename3: .string "count.txt"
filename2: .string "append_test.txt"