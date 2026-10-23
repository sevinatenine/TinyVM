%macro REPEAT count, body
    LOAD R5, count
@again:
    CALL body
    SUB R5, #1
    JCON NZ, $@again
%endmacro
