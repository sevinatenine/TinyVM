; ============================================================
;  lib/files.s: constants for the file syscalls
; ============================================================
;
;  Included by syscalls.s, so you normally don't include it
;  yourself. There are no include guards: a second include
;  fails with "already defined".
;
;  Open flags (SYS_OPEN_FILE options; all values hex; combine with |)
;
;  O_READ        #1
;  O_WRITE       #2
;  O_CREATE      #4    create the file if it doesn't exist
;  O_TRUNC       #8    empty the file when opening
;  O_APPEND      #10   every write goes to the end (implies write)
;  O_WRITE_NEW   #e    write | create | truncate
;  O_WRITE_ADD   #16   write | create | append
;
;  With neither O_READ nor O_WRITE the file opens read-only.
;  Example:  O_READ|O_WRITE
;
;  Standard handles (always open)
;
;  STDIN #0     STDOUT #1     STDERR #2
;
;  Seek origin (SYS_SEEK whence)
;
;  SEEK_SET #0  from the start
;  SEEK_CUR #1  from the current position
;  SEEK_END #2  from the end
;
;  File type (R1 after SYS_STAT / SYS_FSTAT)
;
;  FTYPE_FILE #0    regular file
;  FTYPE_DIR  #1    directory
;  FTYPE_CHAR #2    anything else (e.g. the console)
; ============================================================

JUMP $_files_end

%define O_READ       #1
%define O_WRITE      #2
%define O_CREATE     #4
%define O_TRUNC      #8
%define O_APPEND     #10
%define O_WRITE_NEW  #e        ; write | create | truncate
%define O_WRITE_ADD  #16       ; write | create | append (hex 16 = 0x10 + 4 + 2)

%define STDIN   #0
%define STDOUT  #1
%define STDERR  #2

%define SEEK_SET  #0
%define SEEK_CUR  #1
%define SEEK_END  #2

%define FTYPE_FILE  #0
%define FTYPE_DIR   #1
%define FTYPE_CHAR  #2

_files_end: