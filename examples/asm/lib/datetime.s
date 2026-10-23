; ============================================================
;  lib/datetime.s: print the current date and time
; ============================================================
;
;  Needs syscalls.s and io.s to be included BEFORE this file.
;
;  PRINT_DATETIME    print the local time as Y-M-D h:m:s
;
;      out:    carry set on failure, carry clear on success
;      uses:   R0, R1, flags
;      note:   on failure it JUMPs to a label called "fail", so
;              your program must define one (no zero padding:
;              2026-10-5 9:3:7)
;
;  The raw fields are left in memory for you to read with LOADB:
;
;      dt_year_hi, dt_year_lo (u16, big-endian), dt_month,
;      dt_day, dt_hour, dt_minute, dt_second, dt_weekday
;      (0 = Sunday). "dt" is the address of the whole 8 byte buffer.
;
;  Use SYS_DATETIME dt, TZ_UTC (or TZ_LOCAL) to fill it yourself.
; ============================================================

JUMP $_datetime_end

%macro PRINT_DATETIME

    SYS_DATETIME dt, TZ_LOCAL
    JCON C, $fail

    LOADB R0, $dt_year_hi
    SHL R0, #8
    LOADB R1, $dt_year_lo
    OR R0, R1                  ; year = (hi << 8) | lo
    PRINT_R_DEC R0
    OUT #2d                    ; '-'
    LOADB R0, $dt_month
    PRINT_R_DEC R0
    OUT #2d
    LOADB R0, $dt_day
    PRINT_R_DEC R0
    OUT #20                    ; ' '
    LOADB R0, $dt_hour
    PRINT_R_DEC R0
    OUT #3a                    ; ':'
    LOADB R0, $dt_minute
    PRINT_R_DEC R0
    OUT #3a
    LOADB R0, $dt_second
    PRINT_R_DEC R0

%endmacro

dt:
dt_year_hi: .space 1
dt_year_lo: .space 1
dt_month:   .space 1
dt_day:     .space 1
dt_hour:    .space 1
dt_minute:  .space 1
dt_second:  .space 1
dt_weekday: .space 1

_datetime_end: