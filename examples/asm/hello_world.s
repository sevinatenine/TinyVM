; Simple example of printing hello world with a null terminated string loop

    CALL $print
    HALT
    
print:
    LOAD R1, #0
loop:
    LOADB R0, $message + R1
    CMP R0, #0
    JCON Z, $end_print
    OUT R0
    ADD R1, #1
    JUMP $loop
end_print:
    RET

message: .string "Hello, World!\n"