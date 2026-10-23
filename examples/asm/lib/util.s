; ============================================================
;  lib/util.s: small helper macros
; ============================================================
;
;  REPEAT sub, #n    CALL the subroutine at label "sub", n times
;
;      in:     sub = label of a subroutine that ends in RET
;              n   = repeat count, an immediate, at least 1
;                    (0 would loop 2^32 times)
;      uses:   R5 and the flags
;
;  The subroutine must not change R5, and REPEAT can't be
;  nested because every use needs R5.
; ============================================================

%macro REPEAT count, body
    LOAD R5, count
@again:
    CALL body
    SUB R5, #1
    JCON NZ, $@again
%endmacro