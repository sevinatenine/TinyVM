; ============================================================
;  lib/io.s: console I/O, strings and number conversion
; ============================================================
;
;  "uses" lists the registers the caller should expect to be
;  changed. Every other register is saved and restored.
;  Flags (Z/N/C) are NOT preserved by anything in here.
;
;  puts        Print a null-terminated string (no newline).
;      in:     R0  = pointer to string
;      out:    (none)
;      uses:   R0
;
;  printchar   Print a single character.
;      in:     R0  = character
;      out:    (none)
;      uses:   (none)
;
;  println     Print a null-terminated string, then a newline.
;      in:     R0  = pointer to string
;      out:    (none)
;      uses:   R0
;
;  printhex    Print a value as 0xXXXXXXXX (8 lowercase digits,
;              no newline).
;      in:     R0  = 32-bit value
;      out:    (none)
;      uses:   (none)
;
;  printdec    Print a value as unsigned decimal (no newline).
;      in:     R0  = 32-bit value
;      out:    (none)
;      uses:   (none)
;
;  getc        Read one character (blocks until available).
;      in:     (none)
;      out:    R0  = character, or 0 on EOF
;      uses:   R0
;
;  readline    Read a line into a buffer; stops at newline,
;              EOF, or when the limit is reached. NUL-terminates.
;              The newline is consumed but not stored. CR is ignored.
;              If the limit is hit first, the rest of the line is
;              left unread. EOF with no input returns 0, same as
;              an empty line.
;      in:     R0  = pointer to buffer (needs R1 + 1 bytes)
;              R1  = max characters to read
;      out:    R0  = number of characters read
;      uses:   R0, R1
;
;  strlen      Count the characters in a null-terminated string.
;      in:     R0  = pointer to string
;      out:    R0  = length (excluding the NUL)
;      uses:   R0
;
;  strcmp      Compare two null-terminated strings.
;      in:     R0  = pointer to str0
;              R1  = pointer to str1
;      out:    R0  = 0 if equal, nonzero if different
;                    (the difference of the first mismatching bytes)
;      uses:   R0, R1
;
;  atoi        Parse an unsigned decimal number. Stops at the
;              first non-digit. No sign, no leading spaces,
;              overflow wraps.
;      in:     R0  = pointer to string
;      out:    R0  = value
;      uses:   R0
;
;  divmod10    Divide by 10 (32 step shift-subtract).
;      in:     R0  = n
;      out:    R0  = n / 10
;              R1  = n % 10
;      uses:   R0, R1
;
;  itoa        Write an unsigned decimal number as a string.
;      in:     R0  = value
;              R1  = pointer to buffer (needs 11 bytes)
;      out:    R0  = number of digits (excluding the NUL)
;      uses:   R0, R1
;
; ------------------------------------------------------------
;  Macros (arguments named "label" are labels, not registers)
;
;  PRINT label           print string at label        (preserves R0)
;  PRINTLN label         print string + newline       (preserves R0)
;  PRINT_LIT "text"      print an inline string       (preserves R0)
;  PRINTLN_LIT "text"    inline string + newline      (preserves R0)
;  PRINT_CHAR #c         print a character            (preserves R0)
;  PRINT_HEX #n          print a number in hex        (preserves R0)
;  PRINT_R_HEX reg       print a register in hex      (preserves R0)
;  PRINT_DEC #n          print a number in decimal    (preserves R0)
;  PRINT_R_DEC reg       print a register in decimal  (preserves R0)
;  GET_CHAR              R0 = next character
;  READ_LINE label, #max R0 = chars read              (preserves R1)
;  STRLEN label          R0 = length of string        (R0 clobbered)
;  STRCMP label, label   R0 = 0 if equal              (preserves R1)
;
;  atoi, divmod10 and itoa have no macros: load the registers
;  and CALL them.
; ============================================================

    JUMP $_io_end

puts:
    PUSH R2
    MOVE R2, R0
_io_puts_loop:
    LOADB R0, $0 + R2
    CMP R0, #0
    JCON Z, $_io_end_puts
    OUT R0
    ADD R2, #1
    JUMP $_io_puts_loop
_io_end_puts:
    POP R2
    RET

%macro PRINT str
    PUSH R0
    LOAD R0, #&str
    CALL $puts
    POP R0
%endmacro

printchar:
    OUT R0
    RET

%macro PRINT_CHAR char
    PUSH R0
    LOAD R0, char
    CALL $printchar
    POP R0
%endmacro

println:
    CALL $puts
    OUT #a
    RET

%macro PRINTLN str
    PUSH R0
    LOAD R0, #&str
    CALL $println
    POP R0
%endmacro

%macro PRINT_LIT text
    PUSH R0
    JUMP $@skip
@str:
    .string text
@skip:
    LOAD R0, #&@str
    CALL $puts
    POP R0
%endmacro

%macro PRINTLN_LIT text
    PRINT_LIT text
    PRINT_CHAR #a
%endmacro

printhex:
    PUSH R1
    PUSH R2
    PUSH R3
    MOVE R3, R0
    OUT #30
    OUT #78
    LOAD R1, #8
_io_printhex_loop:
    MOVE R2, R3
    SHR R2, #1c
    SHL R3, #4
    CMP R2, #a
    JCON C, $_io_printhex_digit
    ADD R2, #27
_io_printhex_digit:
    ADD R2, #30
    OUT R2
    SUB R1, #1
    JCON NZ, $_io_printhex_loop
    POP R3
    POP R2
    POP R1
    RET

%macro PRINT_R_HEX register
    PUSH R0
    MOVE R0, register
    CALL $printhex
    POP R0
%endmacro

%macro PRINT_HEX number
    PUSH R0
    LOAD R0, number
    CALL $printhex
    POP R0
%endmacro

printdec:
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    MOVE R3, R0
    LOAD R4, #0
    LOAD R2, #3B9ACA00
    CALL $_io_printdec_digit
    LOAD R2, #5F5E100
    CALL $_io_printdec_digit
    LOAD R2, #989680
    CALL $_io_printdec_digit
    LOAD R2, #F4240
    CALL $_io_printdec_digit
    LOAD R2, #186A0
    CALL $_io_printdec_digit
    LOAD R2, #2710
    CALL $_io_printdec_digit
    LOAD R2, #3E8
    CALL $_io_printdec_digit
    LOAD R2, #64
    CALL $_io_printdec_digit
    LOAD R2, #A
    CALL $_io_printdec_digit
    LOAD R4, #1
    LOAD R2, #1
    CALL $_io_printdec_digit
    POP R4
    POP R3
    POP R2
    POP R1
    RET

_io_printdec_digit:
    LOAD R1, #0
_io_printdec_sub:
    CMP R3, R2
    JCON C, $_io_printdec_emit
    SUB R3, R2
    ADD R1, #1
    JUMP $_io_printdec_sub
_io_printdec_emit:
    CMP R1, #0
    JCON NZ, $_io_printdec_show
    CMP R4, #0
    JCON Z, $_io_printdec_skip
_io_printdec_show:
    LOAD R4, #1
    ADD R1, #30
    OUT R1
_io_printdec_skip:
    RET

%macro PRINT_DEC number
    PUSH R0
    LOAD R0, number
    CALL $printdec
    POP R0
%endmacro

%macro PRINT_R_DEC register
    PUSH R0
    MOVE R0, register
    CALL $printdec
    POP R0
%endmacro

getc:
    IN R0
    RET

%macro GET_CHAR
    CALL $getc
%endmacro

readline:
    PUSH R2
    PUSH R3
    MOVE R2, R0
    MOVE R3, R0
_io_readline_loop:
    CMP R1, #0
    JCON Z, $_io_readline_done
    CALL $getc
    CMP R0, #0
    JCON Z, $_io_readline_done
    CMP R0, #a
    JCON Z, $_io_readline_done
    CMP R0, #d
    JCON Z, $_io_readline_loop
    STORB $0 + R2, R0
    ADD R2, #1
    SUB R1, #1
    JUMP $_io_readline_loop
_io_readline_done:
    LOAD R0, #0
    STORB $0 + R2, R0
    MOVE R0, R2
    SUB R0, R3
    POP R3
    POP R2
    RET

%macro READ_LINE buffer, max_length
    PUSH R1
    LOAD R0, #&buffer
    LOAD R1, max_length
    CALL $readline
    POP R1
%endmacro

strlen:
    PUSH R1
    PUSH R2
    MOVE R1, R0
    LOAD R0, #0
_io_strlen_loop:
    LOADB R2, $0 + R1
    CMP R2, #0
    JCON Z, $_io_strlen_done
    ADD R0, #1
    ADD R1, #1
    JUMP $_io_strlen_loop
_io_strlen_done:
    POP R2
    POP R1
    RET

%macro STRLEN str
    LOAD R0, #&str
    CALL $strlen
%endmacro

strcmp:
    PUSH R2
    PUSH R3
_io_strcmp_loop:
    LOADB R2, $0 + R0
    LOADB R3, $0 + R1
    CMP R2, R3
    JCON NZ, $_io_strcmp_diff
    CMP R2, #0
    JCON Z, $_io_strcmp_equal
    ADD R0, #1
    ADD R1, #1
    JUMP $_io_strcmp_loop
_io_strcmp_equal:
    LOAD R0, #0
    JUMP $_io_strcmp_done
_io_strcmp_diff:
    MOVE R0, R2
    SUB R0, R3
_io_strcmp_done:
    POP R3
    POP R2
    RET

%macro STRCMP a, b
    PUSH R1
    LOAD R0, #&a
    LOAD R1, #&b
    CALL $strcmp
    POP R1
%endmacro

atoi:
    PUSH R1
    PUSH R2
    MOVE R1, R0
    LOAD R0, #0
_io_atoi_loop:
    LOADB R2, $0 + R1
    SUB R2, #30              ; hex 30 = '0'
    CMP R2, #a
    JCON NC, $_io_atoi_done  ; >= 10: not a digit (chars below '0' wrap to huge values, so they stop too)
    MUL R0, #a               ; value = value * 10 + digit
    ADD R0, R2
    ADD R1, #1
    JUMP $_io_atoi_loop
_io_atoi_done:
    POP R2
    POP R1
    RET

; divmod10(R0=n) -> R0=n/10, R1=n%10   (shift-subtract long division, 32 steps)
; uses: R0, R1
divmod10:
    PUSH R2
    PUSH R3
    PUSH R4
    MOVE R4, R0              ; R4 = n, shifted left each step
    LOAD R0, #0              ; quotient
    LOAD R1, #0              ; remainder
    LOAD R2, #20             ; 32 iterations (hex 20)
_io_divmod10_loop:
    SHL R1, #1
    MOVE R3, R4
    SHR R3, #1f              ; top bit of n
    OR R1, R3                ; remainder = remainder*2 + that bit
    SHL R4, #1
    SHL R0, #1
    CMP R1, #a
    JCON C, $_io_divmod10_next   ; remainder < 10: quotient bit stays 0
    SUB R1, #a
    OR R0, #1
_io_divmod10_next:
    SUB R2, #1
    JCON NZ, $_io_divmod10_loop
    POP R4
    POP R3
    POP R2
    RET

; itoa(R0=value, R1=buffer) -> R0=digit count   (NUL-terminated; buffer needs 11 bytes)
; uses: R0, R1
itoa:
    PUSH R2
    PUSH R3
    PUSH R4
    MOVE R3, R1              ; write pointer
    LOAD R2, #0              ; digit count
_io_itoa_div:                ; do-while, so 0 produces "0"
    CALL $divmod10           ; R0 = quotient, R1 = remainder
    ADD R1, #30              ; to ASCII
    PUSH R1                  ; digits come out backwards, so stack them
    ADD R2, #1
    CMP R0, #0
    JCON NZ, $_io_itoa_div
    MOVE R4, R2              ; remember the count to return
_io_itoa_pop:                ; popping reverses them into the right order
    POP R1
    STORB $0 + R3, R1
    ADD R3, #1
    SUB R2, #1
    JCON NZ, $_io_itoa_pop
    LOAD R1, #0
    STORB $0 + R3, R1        ; NUL terminator
    MOVE R0, R4
    POP R4
    POP R3
    POP R2
    RET

_io_end: