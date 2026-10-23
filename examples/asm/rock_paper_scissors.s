%include "lib/io.s"
%include "lib/syscalls.s"

    PRINTLN_LIT "Rock paper scissors!"
    PRINTLN_LIT "Type R, P or S (Q to quit)."

    PUSH #0                 ; player score
    PUSH #0                 ; computer score (top of stack)

start:
    PRINT_LIT "> "
    READ_LINE buffer, #9

    LOADB R0, $buffer
    CMP R0, #61
    JCON C, $_upper
    SUB R0, #20
_upper:
    CMP R0, #51             ; 'Q'
    JCON Z, $quit

    LOAD R4, #0
    CMP R0, #50
    JCON NZ, $_not_p
    LOAD R4, #1
_not_p:
    CMP R0, #53
    JCON NZ, $_not_s
    LOAD R4, #2
_not_s:
    CALL $gen_number
    MOVE R5, R0

    PRINT_LIT "Computer: "
    CALL $print_type
    PRINT_CHAR #a

    MOVE R1, R4
    ADD R1, #3
    SUB R1, R5
    CMP R1, #3
    JCON C, $_reduced
    SUB R1, #3
_reduced:

    CMP R1, #0
    JCON NZ, $_not_tie
    PRINTLN_LIT "Tie!"
    JUMP $_done
_not_tie:
    CMP R1, #1
    JCON NZ, $_lose
    PRINTLN_LIT "You win!"
    POP R0                  ; computer
    POP R1                  ; player
    ADD R1, #1
    PUSH R1
    PUSH R0
    JUMP $_done
_lose:
    PRINTLN_LIT "You lose!"
    POP R0
    POP R1
    ADD R0, #1
    PUSH R1
    PUSH R0
_done:
    POP R0                  ; peek at the scores and print them
    POP R1
    PUSH R1
    PUSH R0
    PRINT_LIT "You: "
    PRINT_R_DEC R1
    PRINT_LIT "  Computer: "
    PRINT_R_DEC R0
    PRINT_CHAR #a
    JUMP $start

quit:
    HALT

gen_number:
    SYS_RAND
    AND R0, #3
    CMP R0, #3
    JCON Z, $gen_number
    RET

print_type:
    CMP R5, #0
    JCON NZ, $_pt_not_r
    PRINT r_message
    RET
_pt_not_r:
    CMP R5, #1
    JCON NZ, $_pt_s
    PRINT p_message
    RET
_pt_s:
    PRINT s_message
    RET

r_message: .string "Rock"
p_message: .string "Paper"
s_message: .string "Scissors"
buffer: .space 10