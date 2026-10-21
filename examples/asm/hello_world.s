    CALL $print
    HALT
    
print:
    LOAD R1, #0 ; Init index with zero
loop:
    LOADB R0, $message + R1 ; Load R0 with the char
    CMP R0, #0 ; If its zero
    JCON Z, $end_print ; Then exit
    OUT R0 ; Print the char
    ADD R1, #1 ; Incriment the index
    JUMP $loop ; Loop
end_print:
    RET ; Return

message: .string "Hello, World!\n"