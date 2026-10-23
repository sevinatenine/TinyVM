JUMP $_datetime_end

%define TZ_LOCAL  #0
%define TZ_UTC    #1

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