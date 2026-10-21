    LOAD R0, #0A ; Load 10

loop:   
    MOVE R1, R0 ; Load R1 with the numer
    ADD  R1, #2F ; Add the amount so it prints as ASCII chars
    OUT  R1 ; Print it
    OUT  #A ; Newline
    SUB  R0, #1 ; Decrement R1
    JCON NZ, $loop ; If its not zero, loop
	
    HALT