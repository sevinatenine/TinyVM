; Printing with the standard library

%include "lib/io.s"

; Method 1 - macros from the standard library
PRINT_LIT "Hello"

; Method 2 - a function from the standard library
LOAD R0, $space
CALL $puts

; Method 3 - macros but printing a label instead of an inline value
PRINT world

HALT

space: .string " "
world: .string " world!\n"