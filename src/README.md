# Notes on GameBoy Emulation

## The CPU

### The Model

- The modified Zilog Z80 is an 8-bit chip, so all the internal workings operate on one byte at a time.
- The memory interface can address up to 65,536 bytes (a 16-bit address bus).
- Programs are accessed through the same address bus as normal memory.
- An instruction can be anywhere between one and three bytes.

In addition to the Program Counter, other numbers are held inside the CPU for calculation: registers A, B, C, D, E, H, and L. Each is one byte.

- [GameBoy Z80 Opcode Map](http://imrannazar.com/Gameboy-Z80-Opcode-Map)

There are other registers in the Z80, that deal with holding status:

- the flags register (F)
- the stack pointer (SP) which is used alongside PUSH and POP instructions for basic LIFO handling of values.

The basic model of the Z80 emulation would therefore require the following components:

- An internal state:
  - A structure for retaining the current state of the registers.
  - The amount of time used to execute the last instruction.
  - The amount of time that the CPU has run in total.
- Functions to simulate each instruction.
- A table mapping said functions onto the opcode map.
- A known interface to talk to the simulated memory.

The flags register (F) automatically calculates certain bits, or flags, based on the result of the last operation. There are four flags in the Z80:

- Zero (0x80): Set if the last operation produced a result of 0.
- Operation (0x40): Set if the last operation was a subtraction.
- Half-carry (0x20): Set if, in the result of the last operation, the lower half of the byte overflowed past 15.
- Carry (0x10): Set if the last operation produced a result over 255 (for additions) or under 0 (for subtractions).

#### Structure

- **clock**:
  - **m**
  - **t**
- **registers**:
  - **a, b, c, d, e, h, l, f** (8-bit)
  - **pc, sp** (16 bit)
  - **m, t** (clock for last instruction)

### Memory Interfacing

The details of how the Gameboy maps banks of memory and hardware onto the address bus are inconsequential to the processor's operation. Four operations are required by the CPU.

#### Structure

- **rb(addr)** (read 8-bit byte from addr)
- **rw(addr)** (read 16-bit word from addr)
- **wb(addr, val)** (write 8-bit byte to addr)
- **ww(addr, val)** (write 16-bit word to addr)

### Dispatch and Reset

Having a reset routine allows for the CPU to be stopped and "rewound" to the start of the execution. (Set all registers to 0).
