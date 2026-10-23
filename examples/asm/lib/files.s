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