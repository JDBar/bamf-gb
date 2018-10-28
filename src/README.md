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

## The Memory

- **[0000 - 3FFF] Cartridge ROM, bank 0**
  - The first 16,384 bytes of the cartridge program are always available at this point in the memory map. Special circumstances apply:
    - **[0000-00FF] BIOS**
      - When the CPU starts up, PC starts at 0000, which is the start of the 256-byte GameBoy BIOS code. Once the BIOS has run, it is removed from the memory map, and this area of the cartridge rom becomes addressable.
    - **[0100-014F] Cartridge Header**
      - This section of the cartridge contains data about its name and manufacturer, and must be written in a specific format.
- **[4000-7FFF] Cartridge ROM, other banks**
  - Any subsequent 16k "banks" of the cartridge program can be made available to the CPU here, one by one. A chip on the cartridge is generally used to switch between banks, and make a particular area accessible. The smallest programs are 32k, which means no bank-selection chip is required.
- **[8000-9FFF] Graphics RAM**
  - Data required for the backgrounds and sprites used by the graphics subsystem is held here, and can be changed by the cartridge program.
- **[A000-BFFF] Cartridge (External) RAM**
  - There is a small amount of writeable memory available in the GameBoy. If a game is produced that requires more RAM than is available in the hardware, additional 8k chunks of RAM can be made addressable here.
- **[C000-DFFF] Working RAM**
  - The Gameboy's internal 8k of RAM, can be read from or written to by the CPU.
- **[E000-FDFF] Working RAM (shadow)**
  - Due to the wiring of the GameBoy hardware, an exact copy of the working RAM is available 8k higher in the memory map. This copy is available up until the last 512 bytes of the map, where other areas are brought into access.
- **[FE00-FE9F] Graphics Sprite Information**
  - Data about the sprites rendered by the graphics chip are held here, including the sprites'
- **[FF00-FF7F] Memory-mapped I/O**
  - Each of the GameBoy's subsystems (graphics, sound, etc.) has control values, to allow programs to create effects and use the hardware. These values are available to the CPU directly on the address bus, in this area.
- **[FF80-FFFF] Zero-page RAM**
  - A high-speed area of 128 bytes of RAM is available at the top of memory. Oddly, though this is "page" 255 of the memory, it is referred to as page zero, since most of the interaction between the program and the GameBoy hardware occurs through use of this page of memory.
