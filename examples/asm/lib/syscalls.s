%include "files.s"

    JUMP $_syscalls_end

    %define SYSNO_RAND #1
    %define SYSNO_TIME #2
    %define SYSNO_SLEEP #3
    %define SYSNO_TICKS #4
    %define SYSNO_DATETIME #5
    %define SYSNO_MEM_INFO #6

    %define SYSNO_OPEN_FILE #10
    %define SYSNO_OPEN_DIR #11
    %define SYSNO_OPEN_SOCKET #12
    %define SYSNO_OPEN_SERIAL #13
    %define SYSNO_SOCKET_ACCEPT #14

    %define SYSNO_READ #1A
    %define SYSNO_WRITE #1B
    %define SYSNO_CLOSE #1C
    %define SYSNO_SEEK #1D
    %define SYSNO_CTL #1E
    %define SYSNO_FSTAT #1F

    %define SYSNO_RENAME #20
    %define SYSNO_UNLINK #21
    %define SYSNO_MKDIR  #22
    %define SYSNO_RMDIR  #23
    %define SYSNO_STAT   #24
    %define SYSNO_CHDIR  #25
    %define SYSNO_GETCWD #26

    %define SYS_MEM_TOTAL   #0
    %define SYS_MEM_FREE    #1
    %define SYS_MEM_PROCESS #2

sys_rand:
    SYS SYSNO_RAND
    RET

%macro SYS_RAND
    CALL $sys_rand
%endmacro

sys_time:
    SYS SYSNO_TIME
    RET

%macro SYS_TIME
    CALL $sys_time
%endmacro

sys_sleep:
    SYS SYSNO_SLEEP
    RET

%macro SYS_SLEEP ms
    PUSH R0
    LOAD R0, ms
    CALL $sys_sleep
    POP R0
%endmacro

%macro SYS_R_SLEEP reg
    PUSH R0
    MOVE R0, reg
    CALL $sys_sleep
    POP R0
%endmacro

sys_ticks:
    SYS SYSNO_TICKS
    RET

%macro SYS_TICKS
    CALL $sys_ticks
%endmacro

sys_mem_info:
    SYS SYSNO_MEM_INFO
    RET

%macro SYS_MEM_INFO type
    PUSH R1
    LOAD R1, type
    CALL $sys_mem_info
    POP R1
%endmacro

sys_open_file:
    SYS SYSNO_OPEN_FILE
    RET

%macro SYS_OPEN_FILE path, options
    PUSH R1
    LOAD R0, #&path
    LOAD R1, options
    CALL $sys_open_file
    POP R1
%endmacro

sys_read:
    SYS SYSNO_READ
    RET

%macro SYS_READ handle, buffer, length
    PUSH R1
    PUSH R2
    MOVE R0, handle
    LOAD R1, #&buffer
    LOAD R2, length
    CALL $sys_read
    POP R2
    POP R1
%endmacro

; sys_write(R0=handle, R1=buffer, R2=length) -> R0=bytes written
sys_write:
    SYS SYSNO_WRITE
    RET

%macro SYS_WRITE handle, buffer, length
    PUSH R1
    PUSH R2
    MOVE R0, handle
    LOAD R1, #&buffer
    LOAD R2, length
    CALL $sys_write
    POP R2
    POP R1
%endmacro

%macro SYS_WRITE_IMM handle, data, length
    PUSH R1
    PUSH R2
    LOAD R0, handle
    LOAD R1, #&data
    LOAD R2, length
    CALL $sys_write
    POP R2
    POP R1
%endmacro

; sys_close(R0=handle)
sys_close:
    SYS SYSNO_CLOSE
    RET

%macro SYS_CLOSE handle
    MOVE R0, handle
    CALL $sys_close
%endmacro

; sys_seek(R0=handle, R1=offset, R2=whence) -> R0=new position
sys_seek:
    SYS SYSNO_SEEK
    RET

%macro SYS_SEEK handle, offset, whence
    PUSH R1
    PUSH R2
    MOVE R0, handle
    LOAD R1, offset
    LOAD R2, whence
    CALL $sys_seek
    POP R2
    POP R1
%endmacro

; sys_ctl(R0=handle, R1=request, R2=arg)
sys_ctl:
    SYS SYSNO_CTL
    RET

%macro SYS_CTL handle, request, arg
    PUSH R1
    PUSH R2
    MOVE R0, handle
    LOAD R1, request
    LOAD R2, arg
    CALL $sys_ctl
    POP R2
    POP R1
%endmacro

; sys_fstat(R0=handle) -> R0=size, R1=type, R2=mtime
sys_fstat:
    SYS SYSNO_FSTAT
    RET

%macro SYS_FSTAT handle
    MOVE R0, handle
    CALL $sys_fstat
%endmacro

; sys_datetime(R0=buffer, R1=0 local / 1 UTC) -> R0=8 on success, carry set on failure
sys_datetime:
    SYS SYSNO_DATETIME
    RET

%macro SYS_DATETIME buffer, utc
    PUSH R1
    LOAD R0, #&buffer
    LOAD R1, utc
    CALL $sys_datetime
    POP R1
%endmacro

; sys_open_dir(R0=path) -> R0=handle
sys_open_dir:
    SYS SYSNO_OPEN_DIR
    RET

%macro SYS_OPEN_DIR path
    LOAD R0, #&path
    CALL $sys_open_dir
%endmacro

; sys_open_socket(R0=kind, R1=options) -> R0=handle  (currently ENOSYS)
sys_open_socket:
    SYS SYSNO_OPEN_SOCKET
    RET

%macro SYS_OPEN_SOCKET kind, options
    PUSH R1
    LOAD R0, kind
    LOAD R1, options
    CALL $sys_open_socket
    POP R1
%endmacro

; sys_open_serial(R0=path, R1=baud) -> R0=handle  (currently ENOSYS)
sys_open_serial:
    SYS SYSNO_OPEN_SERIAL
    RET

%macro SYS_OPEN_SERIAL path, baud
    PUSH R1
    LOAD R0, #&path
    LOAD R1, baud
    CALL $sys_open_serial
    POP R1
%endmacro

; sys_socket_accept(R0=listening socket) -> R0=new handle  (currently ENOSYS)
sys_socket_accept:
    SYS SYSNO_SOCKET_ACCEPT
    RET

%macro SYS_SOCKET_ACCEPT handle
    MOVE R0, handle
    CALL $sys_socket_accept
%endmacro

; sys_rename(R0=old path, R1=new path)
sys_rename:
    SYS SYSNO_RENAME
    RET

%macro SYS_RENAME old, new
    PUSH R1
    LOAD R0, #&old
    LOAD R1, #&new
    CALL $sys_rename
    POP R1
%endmacro

; sys_unlink(R0=path)
sys_unlink:
    SYS SYSNO_UNLINK
    RET

%macro SYS_UNLINK path
    LOAD R0, #&path
    CALL $sys_unlink
%endmacro

; sys_mkdir(R0=path)
sys_mkdir:
    SYS SYSNO_MKDIR
    RET

%macro SYS_MKDIR path
    LOAD R0, #&path
    CALL $sys_mkdir
%endmacro

; sys_rmdir(R0=path)
sys_rmdir:
    SYS SYSNO_RMDIR
    RET

%macro SYS_RMDIR path
    LOAD R0, #&path
    CALL $sys_rmdir
%endmacro

; sys_stat(R0=path) -> R0=size, R1=type, R2=mtime
; NOTE: clobbers R1 and R2 on purpose, since they're return values
sys_stat:
    SYS SYSNO_STAT
    RET

%macro SYS_STAT path
    LOAD R0, #&path
    CALL $sys_stat
%endmacro

; sys_chdir(R0=path)
sys_chdir:
    SYS SYSNO_CHDIR
    RET

%macro SYS_CHDIR path
    LOAD R0, #&path
    CALL $sys_chdir
%endmacro

; sys_getcwd(R0=buffer, R1=max length) -> R0=length (without the NUL)
sys_getcwd:
    SYS SYSNO_GETCWD
    RET

%macro SYS_GETCWD buffer, max
    PUSH R1
    LOAD R0, #&buffer
    LOAD R1, max
    CALL $sys_getcwd
    POP R1
%endmacro

_syscalls_end: