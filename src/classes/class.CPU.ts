import CPURegister16 from "./class.CPURegister16";
import CPURegister8 from "./class.CPURegister8";
import CPURegisterSet, {ICPURegisterSet} from "./class.CPURegisterSet";
import MMU from "./class.MMU";

/**
 * The CPU of the Gameboy.
 * Most information regarding the CPU has been drawn from the following sources:
 *
 * * https://ia601906.us.archive.org/19/items/GameBoyProgManVer1.1/GameBoyProgManVer1.1.pdf
 * * http://www.pastraiser.com/cpu/gameboy/gameboy_opcodes.html
 * * http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-The-CPU
 */
export default class CPU {
  /**
   * The CPU clock.
   * Uses the "CYCL" value in Gameboy Programming Manual.
   */
  protected readonly clock: CPURegister8;

  /**
   * The set of registers on the CPU.
   * A register can hold 8 or 16 bits (1-2 bytes).
   */
  protected readonly registers: CPURegisterSet;

  /**
   * The memory mapping unit of the Gameboy.
   * Check out README.md and class.MMU.ts for more information.
   * http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-Memory
   */
  protected readonly mmu: MMU;

  /**
   * The main instruction set of the Gameboy CPU.
   * Contains operations for opcodes 0x00 - 0xff.
   */
  protected readonly operations: IOperationMap;

  /**
   * The CB-prefixed instruction set of the Gameboy CPU.
   * 0xcb is an opcode to fetch an additional byte to use
   * with an alternate instruction mapping.
   */
  protected readonly cbOperations: IOperationMap;

  constructor() {
    this.mmu = new MMU();
    this.clock = new CPURegister8();
    this.registers = new CPURegisterSet();

    this.operations = {
      0x00: {
        mnemonic: "NOP",
        description: "No operation.",
        fn: () => {
          return 1;
        },
      },
      0x01: {
        mnemonic: "LD BC, nn",
        description: "Load 16-bit immediate into BC.",
        fn: () => {
          this.loadImmediateWordToRegister(this.registers.bc);
          return 3;
        },
      },
      0x02: {
        mnemonic: "LD (BC), A",
        description: "Save A to address (BC).",
        fn: () => {
          this.mmu.writeByte(this.registers.bc.Value, this.registers.a.Value);
          return 2;
        },
      },
      0x03: {
        mnemonic: "INC BC",
        description: "Increment 16-bit BC",
        fn: () => {
          this.registers.bc.Value++;
          return 2;
        },
      },
      0x04: {
        mnemonic: "INC B",
        description: "Increment B",
        fn: () => {
          this.incrementRegister(this.registers.b);
          return 1;
        },
      },
      0x05: {
        mnemonic: "DEC B",
        description: "Decrement B",
        fn: () => {
          this.decrementRegister(this.registers.b);
          return 1;
        },
      },
      0x06: {
        mnemonic: "LD B, n",
        description: "Load 8-bit immediate into register B.",
        fn: () => {
          this.registers.b.Value = this.mmu.readByte(this.registers.pc.Value++);
          return 2;
        },
      },
      0x07: {
        mnemonic: "RLCA",
        description: "Rotate A left, store old bit7 in Carry Flag.",
        fn: () => {
          this.HalfCarryFlag = false;
          this.SubtractFlag = false;
          this.ZeroFlag = false;
          this.CarryFlag = (this.registers.a.Value & 0x80) > 0;
          this.registers.a.Value =
            (this.registers.a.Value << 1) | (this.CarryFlag ? 1 : 0);
          return 1;
        },
      },
      0x08: {
        mnemonic: "LD (nn), SP",
        description:
          "Stores the lower byte of SP at address (nn) and the upper byte of SP at address (nn + 1)",
        fn: () => {
          const address = this.mmu.readWord(this.registers.pc.Value);
          this.registers.pc.Value += 2;
          this.mmu.writeWord(address, this.registers.sp.Value);
          return 5;
        },
      },
      0x09: {
        mnemonic: "ADD HL, BC",
        description:
          "Adds the contents of BC to the contents of HL and stores results in HL.",
        fn: () => {
          this.addWordToHL(this.registers.bc.Value);
          return 2;
        },
      },
      0x0a: {
        mnemonic: "LD A, (BC)",
        description: "Loads the byte at address (BC) into A.",
        fn: () => {
          this.registers.a.Value = this.mmu.readByte(this.registers.bc.Value);
          return 2;
        },
      },
      0x0b: {
        mnemonic: "DEC BC",
        description: "Decrement the contents of BC by 1.",
        fn: () => {
          this.registers.bc.Value--;
          return 2;
        },
      },
      0x0c: {
        mnemonic: "INC C",
        description: "Increment C",
        fn: () => {
          this.incrementRegister(this.registers.c);
          return 1;
        },
      },
      0x0d: {
        mnemonic: "DEC C",
        description: "Decrement C",
        fn: () => {
          this.decrementRegister(this.registers.c);
          return 1;
        },
      },
      0x0e: {
        mnemonic: "LD C, n",
        description: "Loads 8-bit immediate into C.",
        fn: () => {
          this.registers.c.Value = this.mmu.readByte(this.registers.pc.Value++);
          return 2;
        },
      },
      0x0f: {
        mnemonic: "RRCA",
        description:
          "Rotates the contents of register A to the right. Store old bit0 in Carry Flag.",
        fn: () => {
          this.HalfCarryFlag = false;
          this.SubtractFlag = false;
          this.ZeroFlag = false;
          this.CarryFlag = (this.registers.a.Value & 0x1) > 0;
          this.registers.a.Value =
            (this.registers.a.Value >> 1) | (this.CarryFlag ? 0x80 : 0);
          return 1;
        },
      },
      0x10: {
        mnemonic: "STOP",
        description:
          "Stops the system clock. STOP mode is entered, and LCD controller also stops.",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x11: {
        mnemonic: "LD DE, nn",
        description: "Load 16-bit immediate into DE",
        fn: () => {
          this.loadImmediateWordToRegister(this.registers.de);
          return 3;
        },
      },
      0x12: {
        mnemonic: "LD (DE), A",
        description: "Save A to address (DE).",
        fn: () => {
          this.mmu.writeByte(this.registers.de.Value, this.registers.a.Value);
          return 2;
        },
      },
      0x13: {
        mnemonic: "INC DE",
        description: "Increment 16-bit DE",
        fn: () => {
          this.registers.de.Value++;
          return 2;
        },
      },
      0x14: {
        mnemonic: "INC D",
        description: "Increment D",
        fn: () => {
          this.incrementRegister(this.registers.d);
          return 1;
        },
      },
      0x15: {
        mnemonic: "DEC D",
        description: "Decrement D",
        fn: () => {
          this.decrementRegister(this.registers.d);
          return 1;
        },
      },
      0x16: {
        mnemonic: "LD D, n",
        description: "Load 8-bit immediate into register D.",
        fn: () => {
          this.registers.d.Value = this.mmu.readByte(this.registers.pc.Value++);
          return 2;
        },
      },
      0x17: {
        mnemonic: "RLA",
        description:
          "Rotate A left through Carry Flag. Store old bit7 in Carry Flag. Old Carry Flag value becomes bit0.",
        fn: () => {
          this.HalfCarryFlag = false;
          this.SubtractFlag = false;
          this.ZeroFlag = false;

          const oldCarryFlag = this.CarryFlag;
          this.CarryFlag = (this.registers.a.Value & 0x80) > 0;

          this.registers.a.Value =
            (this.registers.a.Value << 1) | (oldCarryFlag ? 1 : 0);

          return 1;
        },
      },
      0x18: {
        mnemonic: "JR n",
        description:
          "Jumps n steps from the current address, where n is a signed byte.",
        fn: () => {
          const steps = this.byteToSigned(
            this.mmu.readByte(this.registers.pc.Value++)
          );
          this.registers.pc.Value += steps;
          return 3;
        },
      },
      0x19: {
        mnemonic: "ADD HL, DE",
        description:
          "Adds the contents of DE to the contents of HL and stores results in HL.",
        fn: () => {
          this.addWordToHL(this.registers.de.Value);
          return 2;
        },
      },
      0x1a: {
        mnemonic: "LD A, (DE)",
        description: "Loads the byte at address (DE) into A.",
        fn: () => {
          this.registers.a.Value = this.mmu.readByte(this.registers.de.Value);
          return 2;
        },
      },
      0x1b: {
        mnemonic: "DEC DE",
        description: "Decrement the contents of DE by 1.",
        fn: () => {
          this.registers.de.Value--;
          return 2;
        },
      },
      0x1c: {
        mnemonic: "INC E",
        description: "Increment E",
        fn: () => {
          this.incrementRegister(this.registers.e);
          return 1;
        },
      },
      0x1d: {
        mnemonic: "DEC E",
        description: "Decrement E",
        fn: () => {
          this.decrementRegister(this.registers.e);
          return 1;
        },
      },
      0x1e: {
        mnemonic: "LD E, n",
        description: "Load 8-bit immediate into register E.",
        fn: () => {
          this.registers.e.Value = this.mmu.readByte(this.registers.pc.Value++);
          return 2;
        },
      },
      0x1f: {
        mnemonic: "RRA",
        description:
          "Rotate A right through Carry Flag. Store old bit0 in Carry Flag. Old Carry Flag value becomes bit7.",
        fn: () => {
          this.HalfCarryFlag = false;
          this.SubtractFlag = false;
          this.ZeroFlag = false;

          const oldCarryFlag = this.CarryFlag;
          this.CarryFlag = (this.registers.a.Value & 0x1) > 0;

          this.registers.a.Value =
            (this.registers.a.Value >> 1) | (oldCarryFlag ? 0x80 : 0);

          return 1;
        },
      },
      0x20: {
        mnemonic: "JR NZ, n",
        description:
          "Jumps n steps from the current address, where n is a signed byte, if the Zero Flag is not set.",
        fn: () => {
          if (!this.ZeroFlag) {
            const steps = this.byteToSigned(
              this.mmu.readByte(this.registers.pc.Value++)
            );
            this.registers.pc.Value += steps;
            return 3;
          } else {
            this.registers.pc.Value++;
            return 2;
          }
        },
      },
      0x21: {
        mnemonic: "LD HL, nn",
        description: "Load 16-bit immediate into HL",
        fn: () => {
          this.loadImmediateWordToRegister(this.registers.hl);
          return 3;
        },
      },
      0x22: {
        mnemonic: "LD (HLI), A",
        description: "Save A to address (HL) then increment HL.",
        fn: () => {
          this.mmu.writeByte(this.registers.hl.Value++, this.registers.a.Value);
          return 2;
        },
      },
      0x23: {
        mnemonic: "INC HL",
        description: "Increment 16-bit HL",
        fn: () => {
          this.registers.hl.Value++;
          return 2;
        },
      },
      0x24: {
        mnemonic: "INC H",
        description: "Increment H",
        fn: () => {
          this.incrementRegister(this.registers.h);
          return 1;
        },
      },
      0x25: {
        mnemonic: "DEC H",
        description: "Decrement H",
        fn: () => {
          this.decrementRegister(this.registers.h);
          return 1;
        },
      },
      0x26: {
        mnemonic: "LD H, n",
        description: "Load 8-bit immediate into register H.",
        fn: () => {
          this.registers.h.Value = this.mmu.readByte(this.registers.pc.Value++);
          return 2;
        },
      },
      0x27: {
        mnemonic: "DAA",
        description:
          "Adjust register A to correctly represent a Binary Coded Decimal.",
        fn: () => {
          /**
           * Interprets the upper and lower nybbles (a nybble is 4 bits or 1 hex digit)
           * of a byte as two individual decimal digits, rather than the whole byte as one
           * binary number.
           *
           * The DAA instruction adjusts the results of a binary addition or subtraction
           * by adding or subtracting 6 from the result's upper nybble, lower nybble, or both.
           *
           * In order to work it has to know whether the last operation was an addition or a
           * subtraction (the Subtract flag), and whether a carry and/or a half-carry occurred
           * (the Carry and HalfCarry flags).
           *
           * The Carry flag indicates that a result does need to be adjusted even if it looks
           * like a valid BCD number.
           *
           * The same logic applies to the ones digit and the half-carry flag, except that the
           * CPU doesn't bother setting the HalfCarry flag after a DAA, because only DAA uses
           * the HalfCarry flag and doing two DAAs in a row makes no sense.
           *
           * Source: https://forums.nesdev.com/viewtopic.php?p=196282#p196282
           */
          const sign = this.SubtractFlag ? -1 : 1;
          let correction = 0;

          if (
            this.CarryFlag ||
            (!this.SubtractFlag && this.registers.a.Value > 0x99)
          ) {
            correction |= 0x60;
            this.CarryFlag = true;
          }
          if (
            this.HalfCarryFlag ||
            (!this.SubtractFlag && (this.registers.a.Value & 0x0f) > 0x09)
          ) {
            correction |= 0x06;
          }

          this.registers.a.Value += correction * sign;

          this.HalfCarryFlag = false;
          this.ZeroFlag = this.registers.a.Value === 0;

          return 1;
        },
      },
      0x28: {
        mnemonic: "JR Z, n",
        description:
          "Jumps n steps from the current address, where n is a signed byte, if the Zero Flag is set.",
        fn: () => {
          if (this.ZeroFlag) {
            const steps = this.byteToSigned(
              this.mmu.readByte(this.registers.pc.Value++)
            );
            this.registers.pc.Value += steps;
            return 3;
          } else {
            this.registers.pc.Value++;
            return 2;
          }
        },
      },
      0x29: {
        mnemonic: "ADD HL, HL",
        description:
          "Adds the contents of HL to the contents of HL and stores results in HL.",
        fn: () => {
          this.addWordToHL(this.registers.hl.Value);
          return 2;
        },
      },
      0x2a: {
        mnemonic: "LD A, (HLI)",
        description:
          "Loads the byte at address (HL) into A then increments HL.",
        fn: () => {
          this.registers.a.Value = this.mmu.readByte(this.registers.hl.Value++);
          return 2;
        },
      },
      0x2b: {
        mnemonic: "DEC HL",
        description: "Decrement the contents of HL by 1.",
        fn: () => {
          this.registers.hl.Value--;
          return 2;
        },
      },
      0x2c: {
        mnemonic: "INC L",
        description: "Increment L",
        fn: () => {
          this.incrementRegister(this.registers.l);
          return 1;
        },
      },
      0x2d: {
        mnemonic: "DEC L",
        description: "Decrement L",
        fn: () => {
          this.decrementRegister(this.registers.l);
          return 1;
        },
      },
      0x2e: {
        mnemonic: "LD L, n",
        description: "Load 8-bit immediate into register L.",
        fn: () => {
          this.registers.l.Value = this.mmu.readByte(this.registers.pc.Value++);
          return 2;
        },
      },
      0x2f: {
        mnemonic: "CPL",
        description: "Take the one's complement of the contents of register A.",
        fn: () => {
          // To find the one's complement of a number, flip all the bits.
          // e.g. 0b1011 ^ 0b1111 = 0b0100
          this.HalfCarryFlag = false;
          this.SubtractFlag = false;
          this.registers.a.Value ^= 0xff;
          return 1;
        },
      },
      0x30: {
        mnemonic: "JR NC, n",
        description:
          "Jumps n steps from the current address, where n is a signed byte, if the Carry Flag is not set.",
        fn: () => {
          if (!this.CarryFlag) {
            const steps = this.byteToSigned(
              this.mmu.readByte(this.registers.pc.Value++)
            );
            this.registers.pc.Value += steps;
            return 3;
          } else {
            this.registers.pc.Value++;
            return 2;
          }
        },
      },
      0x31: {
        mnemonic: "LD SP, nn",
        description: "Load 16-bit immediate into SP",
        fn: () => {
          this.loadImmediateWordToRegister(this.registers.sp);
          return 3;
        },
      },
      0x32: {
        mnemonic: "LD (HLD), A",
        description: "Save A to address (HL) then decrement HL.",
        fn: () => {
          this.mmu.writeByte(this.registers.hl.Value--, this.registers.a.Value);
          return 2;
        },
      },
      0x33: {
        mnemonic: "INC SP",
        description: "Increment 16-bit SP",
        fn: () => {
          this.registers.sp.Value++;
          return 2;
        },
      },
      0x34: {
        mnemonic: "INC (HL)",
        description:
          "Increments by 1 the contents of memory specified by register pair HL.",
        fn: () => {
          let value = this.mmu.readByte(this.registers.hl.Value);
          this.HalfCarryFlag = (value++ & 0xf) + 1 > 0xf;
          this.SubtractFlag = false;
          this.ZeroFlag = value ? false : true;
          this.mmu.writeByte(this.registers.hl.Value, value);
          return 3;
        },
      },
      0x35: {
        mnemonic: "DEC (HL)",
        description:
          "Decrements by 1 the contents of memory specified by register pair HL.",
        fn: () => {
          let value = this.mmu.readByte(this.registers.hl.Value);
          this.HalfCarryFlag = (value-- & 0xf) - 1 < 0;
          this.SubtractFlag = true;
          this.ZeroFlag = value ? false : true;
          this.mmu.writeByte(this.registers.hl.Value, value);
          return 3;
        },
      },
      0x36: {
        mnemonic: "LD (HL), n",
        description:
          "Load 8-bit immediate into memory specified by register pair HL.",
        fn: () => {
          const address = this.registers.hl.Value;
          const value = this.mmu.readByte(this.registers.pc.Value++);
          this.mmu.writeByte(address, value);
          return 3;
        },
      },
      0x37: {
        mnemonic: "SCF",
        description: "Sets the carry flag.",
        fn: () => {
          this.CarryFlag = true;
          return 1;
        },
      },
      0x38: {
        mnemonic: "JR C, n",
        description:
          "Jumps n steps from the current address, where n is a signed byte, if the Carry Flag is set.",
        fn: () => {
          if (this.CarryFlag) {
            const steps = this.byteToSigned(
              this.mmu.readByte(this.registers.pc.Value++)
            );
            this.registers.pc.Value += steps;
            return 3;
          } else {
            this.registers.pc.Value++;
            return 2;
          }
        },
      },
      0x39: {
        mnemonic: "ADD HL, SP",
        description:
          "Adds the contents of SP to the contents of HL and stores results in HL.",
        fn: () => {
          this.addWordToHL(this.registers.sp.Value);
          return 2;
        },
      },
      0x3a: {
        mnemonic: "LD A, (HLD)",
        description:
          "Loads the byte at address (HL) into A then decrements HL.",
        fn: () => {
          this.registers.a.Value = this.mmu.readByte(this.registers.hl.Value--);
          return 2;
        },
      },
      0x3b: {
        mnemonic: "DEC SP",
        description: "Decrement the contents of SP by 1.",
        fn: () => {
          this.registers.sp.Value--;
          return 2;
        },
      },
      0x3c: {
        mnemonic: "INC A",
        description: "Increment A",
        fn: () => {
          this.incrementRegister(this.registers.a);
          return 1;
        },
      },
      0x3d: {
        mnemonic: "DEC A",
        description: "Decrement A",
        fn: () => {
          this.decrementRegister(this.registers.a);
          return 1;
        },
      },
      0x3e: {
        mnemonic: "LD A, n",
        description: "Load 8-bit immediate into register A.",
        fn: () => {
          this.registers.a.Value = this.mmu.readByte(this.registers.pc.Value++);
          return 2;
        },
      },
      0x3f: {
        mnemonic: "CCF",
        description: "Flips the Carry Flag.",
        fn: () => {
          this.HalfCarryFlag = false;
          this.SubtractFlag = false;
          this.CarryFlag = !this.CarryFlag;
          return 1;
        },
      },
      0x40: {
        mnemonic: "LD B, B",
        description: "Loads the contents of register B into register B.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.b, this.registers.b);
          return 1;
        },
      },
      0x41: {
        mnemonic: "LD B, C",
        description: "Loads the contents of register C into register B.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.c, this.registers.b);
          return 1;
        },
      },
      0x42: {
        mnemonic: "LD B, D",
        description: "Loads the contents of register D into register B.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.d, this.registers.b);
          return 1;
        },
      },
      0x43: {
        mnemonic: "LD B, E",
        description: "Loads the contents of register E into register B.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.e, this.registers.b);
          return 1;
        },
      },
      0x44: {
        mnemonic: "LD B, H",
        description: "Loads the contents of register H into register B.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.h, this.registers.b);
          return 1;
        },
      },
      0x45: {
        mnemonic: "LD B, L",
        description: "Loads the contents of register L into register B.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.l, this.registers.b);
          return 1;
        },
      },
      0x46: {
        mnemonic: "LD B, (HL)",
        description:
          "Loads the contents of memory specified by register pair HL into register B.",
        fn: () => {
          this.registers.b.Value = this.mmu.readByte(this.registers.hl.Value);
          return 2;
        },
      },
      0x47: {
        mnemonic: "LD B, A",
        description: "Loads the contents of register A into register B.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.a, this.registers.b);
          return 1;
        },
      },
      0x48: {
        mnemonic: "LD C, B",
        description: "Loads the contents of register B into register C.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.b, this.registers.c);
          return 1;
        },
      },
      0x49: {
        mnemonic: "LD C, C",
        description: "Loads the contents of register C into register C.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.c, this.registers.c);
          return 1;
        },
      },
      0x4a: {
        mnemonic: "LD C, D",
        description: "Loads the contents of register D into register C.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.d, this.registers.c);
          return 1;
        },
      },
      0x4b: {
        mnemonic: "LD C, E",
        description: "Loads the contents of register E into register C.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.e, this.registers.c);
          return 1;
        },
      },
      0x4c: {
        mnemonic: "LD C, H",
        description: "Loads the contents of register H into register C.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.h, this.registers.c);
          return 1;
        },
      },
      0x4d: {
        mnemonic: "LD C, L",
        description: "Loads the contents of register L into register C.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.l, this.registers.c);
          return 1;
        },
      },
      0x4e: {
        mnemonic: "LD C, (HL)",
        description:
          "Loads the contents of memory specified by register pair HL into register C.",
        fn: () => {
          this.registers.c.Value = this.mmu.readByte(this.registers.hl.Value);
          return 2;
        },
      },
      0x4f: {
        mnemonic: "LD C, A",
        description: "Loads the contents of register A into register C.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.a, this.registers.c);
          return 1;
        },
      },
      0x50: {
        mnemonic: "LD D, B",
        description: "Loads the contents of register B into register D.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.b, this.registers.d);
          return 1;
        },
      },
      0x51: {
        mnemonic: "LD D, C",
        description: "Loads the contents of register C into register D.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.c, this.registers.d);
          return 1;
        },
      },
      0x52: {
        mnemonic: "LD D, D",
        description: "Loads the contents of register D into register D.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.d, this.registers.d);
          return 1;
        },
      },
      0x53: {
        mnemonic: "LD D, E",
        description: "Loads the contents of register E into register D.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.e, this.registers.d);
          return 1;
        },
      },
      0x54: {
        mnemonic: "LD D, H",
        description: "Loads the contents of register H into register D.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.h, this.registers.d);
          return 1;
        },
      },
      0x55: {
        mnemonic: "LD D, L",
        description: "Loads the contents of register L into register D.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.l, this.registers.d);
          return 1;
        },
      },
      0x56: {
        mnemonic: "LD D, (HL)",
        description:
          "Loads the contents of memory specified by register pair HL into register D.",
        fn: () => {
          this.registers.d.Value = this.mmu.readByte(this.registers.hl.Value);
          return 2;
        },
      },
      0x57: {
        mnemonic: "LD D, A",
        description: "Loads the contents of register A into register D.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.a, this.registers.d);
          return 1;
        },
      },
      0x58: {
        mnemonic: "LD E, B",
        description: "Loads the contents of register B into register E.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.b, this.registers.e);
          return 1;
        },
      },
      0x59: {
        mnemonic: "LD E, C",
        description: "Loads the contents of register C into register E.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.c, this.registers.e);
          return 1;
        },
      },
      0x5a: {
        mnemonic: "LD E, D",
        description: "Loads the contents of register D into register E.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.d, this.registers.e);
          return 1;
        },
      },
      0x5b: {
        mnemonic: "LD E, E",
        description: "Loads the contents of register E into register E.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.e, this.registers.e);
          return 1;
        },
      },
      0x5c: {
        mnemonic: "LD E, H",
        description: "Loads the contents of register H into register E.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.h, this.registers.e);
          return 1;
        },
      },
      0x5d: {
        mnemonic: "LD E, L",
        description: "Loads the contents of register L into register E.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.l, this.registers.e);
          return 1;
        },
      },
      0x5e: {
        mnemonic: "LD E, (HL)",
        description:
          "Loads the contents of memory specified by register pair HL into register E.",
        fn: () => {
          this.registers.e.Value = this.mmu.readByte(this.registers.hl.Value);
          return 2;
        },
      },
      0x5f: {
        mnemonic: "LD E, A",
        description: "Loads the contents of register A into register E.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.a, this.registers.e);
          return 1;
        },
      },
      0x60: {
        mnemonic: "LD H, B",
        description: "Loads the contents of register B into register H.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.b, this.registers.h);
          return 1;
        },
      },
      0x61: {
        mnemonic: "LD H, C",
        description: "Loads the contents of register C into register H.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.c, this.registers.h);
          return 1;
        },
      },
      0x62: {
        mnemonic: "LD H, D",
        description: "Loads the contents of register D into register H.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.d, this.registers.h);
          return 1;
        },
      },
      0x63: {
        mnemonic: "LD H, E",
        description: "Loads the contents of register E into register H.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.e, this.registers.h);
          return 1;
        },
      },
      0x64: {
        mnemonic: "LD H, H",
        description: "Loads the contents of register H into register H.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.h, this.registers.h);
          return 1;
        },
      },
      0x65: {
        mnemonic: "LD H, L",
        description: "Loads the contents of register L into register H.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.l, this.registers.h);
          return 1;
        },
      },
      0x66: {
        mnemonic: "LD H, (HL)",
        description:
          "Loads the contents of memory specified by register pair HL into register H.",
        fn: () => {
          this.registers.h.Value = this.mmu.readByte(this.registers.hl.Value);
          return 2;
        },
      },
      0x67: {
        mnemonic: "LD H, A",
        description: "Loads the contents of register A into register H.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.a, this.registers.h);
          return 1;
        },
      },
      0x68: {
        mnemonic: "LD L, B",
        description: "Loads the contents of register B into register L.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.b, this.registers.l);
          return 1;
        },
      },
      0x69: {
        mnemonic: "LD L, C",
        description: "Loads the contents of register C into register L.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.c, this.registers.l);
          return 1;
        },
      },
      0x6a: {
        mnemonic: "LD L, D",
        description: "Loads the contents of register D into register L.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.d, this.registers.l);
          return 1;
        },
      },
      0x6b: {
        mnemonic: "LD L, E",
        description: "Loads the contents of register E into register L.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.e, this.registers.l);
          return 1;
        },
      },
      0x6c: {
        mnemonic: "LD L, H",
        description: "Loads the contents of register H into register L.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.h, this.registers.l);
          return 1;
        },
      },
      0x6d: {
        mnemonic: "LD L, L",
        description: "Loads the contents of register L into register L.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.l, this.registers.l);
          return 1;
        },
      },
      0x6e: {
        mnemonic: "LD L, (HL)",
        description:
          "Loads the contents of memory specified by register pair HL into register L.",
        fn: () => {
          this.registers.l.Value = this.mmu.readByte(this.registers.hl.Value);
          return 2;
        },
      },
      0x6f: {
        mnemonic: "LD L, A",
        description: "Loads the contents of register A into register L.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.a, this.registers.l);
          return 1;
        },
      },
      0x70: {
        mnemonic: "LD (HL), B",
        description:
          "Stores the contents of register B in memory specified by register pair HL.",
        fn: () => {
          this.mmu.writeByte(this.registers.hl.Value, this.registers.b.Value);
          return 2;
        },
      },
      0x71: {
        mnemonic: "LD (HL), C",
        description:
          "Stores the contents of register C in memory specified by register pair HL.",
        fn: () => {
          this.mmu.writeByte(this.registers.hl.Value, this.registers.c.Value);
          return 2;
        },
      },
      0x72: {
        mnemonic: "LD (HL), D",
        description:
          "Stores the contents of register D in memory specified by register pair HL.",
        fn: () => {
          this.mmu.writeByte(this.registers.hl.Value, this.registers.d.Value);
          return 2;
        },
      },
      0x73: {
        mnemonic: "LD (HL), E",
        description:
          "Stores the contents of register E in memory specified by register pair HL.",
        fn: () => {
          this.mmu.writeByte(this.registers.hl.Value, this.registers.e.Value);
          return 2;
        },
      },
      0x74: {
        mnemonic: "LD (HL), H",
        description:
          "Stores the contents of register H in memory specified by register pair HL.",
        fn: () => {
          this.mmu.writeByte(this.registers.hl.Value, this.registers.h.Value);
          return 2;
        },
      },
      0x75: {
        mnemonic: "LD (HL), L",
        description:
          "Stores the contents of register L in memory specified by register pair HL.",
        fn: () => {
          this.mmu.writeByte(this.registers.hl.Value, this.registers.l.Value);
          return 2;
        },
      },
      0x76: {
        mnemonic: "HALT",
        description:
          "After a HALT instruction is executed, the system clock is stopped and HALT mode is entered.  Althoughthe system clock is stopped in this status, the oscillator circuit and LCD controller continue to operate.",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x77: {
        mnemonic: "LD (HL), A",
        description:
          "Stores the contents of register A in memory specified by register pair HL.",
        fn: () => {
          this.mmu.writeByte(this.registers.hl.Value, this.registers.a.Value);
          return 2;
        },
      },
      0x78: {
        mnemonic: "LD A, B",
        description: "Loads the contents of register B into register A.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.b, this.registers.a);
          return 1;
        },
      },
      0x79: {
        mnemonic: "LD A, C",
        description: "Loads the contents of register C into register A.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.c, this.registers.a);
          return 1;
        },
      },
      0x7a: {
        mnemonic: "LD A, D",
        description: "Loads the contents of register D into register A.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.d, this.registers.a);
          return 1;
        },
      },
      0x7b: {
        mnemonic: "LD A, E",
        description: "Loads the contents of register E into register A.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.e, this.registers.a);
          return 1;
        },
      },
      0x7c: {
        mnemonic: "LD A, H",
        description: "Loads the contents of register H into register A.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.h, this.registers.a);
          return 1;
        },
      },
      0x7d: {
        mnemonic: "LD A, L",
        description: "Loads the contents of register L into register A.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.l, this.registers.a);
          return 1;
        },
      },
      0x7e: {
        mnemonic: "LD A, (HL)",
        description:
          "Loads the contents of memory specified by register pair HL into register A.",
        fn: () => {
          this.registers.a.Value = this.mmu.readByte(this.registers.hl.Value);
          return 2;
        },
      },
      0x7f: {
        mnemonic: "LD A, A",
        description: "Loads the contents of register A into register A.",
        fn: () => {
          this.loadRegisterToRegister(this.registers.a, this.registers.a);
          return 1;
        },
      },
      0x80: {
        mnemonic: "ADD A, B",
        description: "Adds the contents of register B to those of register A.",
        fn: () => {
          this.addByteToA(this.registers.b.Value);
          return 1;
        },
      },
      0x81: {
        mnemonic: "ADD A, C",
        description: "Adds the contents of register C to those of register A.",
        fn: () => {
          this.addByteToA(this.registers.c.Value);
          return 1;
        },
      },
      0x82: {
        mnemonic: "ADD A, D",
        description: "Adds the contents of register D to those of register A.",
        fn: () => {
          this.addByteToA(this.registers.d.Value);
          return 1;
        },
      },
      0x83: {
        mnemonic: "ADD A, E",
        description: "Adds the contents of register E to those of register A.",
        fn: () => {
          this.addByteToA(this.registers.e.Value);
          return 1;
        },
      },
      0x84: {
        mnemonic: "ADD A, H",
        description: "Adds the contents of register H to those of register A.",
        fn: () => {
          this.addByteToA(this.registers.h.Value);
          return 1;
        },
      },
      0x85: {
        mnemonic: "ADD A, L",
        description: "Adds the contents of register L to those of register A.",
        fn: () => {
          this.addByteToA(this.registers.l.Value);
          return 1;
        },
      },
      0x86: {
        mnemonic: "ADD A, (HL)",
        description:
          "Adds the contents of memory specified by the contents of register pair HL to the contents of register A.",
        fn: () => {
          this.addByteToA(this.mmu.readByte(this.registers.hl.Value));
          return 2;
        },
      },
      0x87: {
        mnemonic: "ADD A, A",
        description: "Adds the contents of register A to those of register A.",
        fn: () => {
          this.addByteToA(this.registers.a.Value);
          return 1;
        },
      },
      0x88: {
        mnemonic: "ADC A, B",
        description:
          "Adds the contents of register B and Carry Flag to the contents of register A.",
        fn: () => {
          this.addByteAndCarryIntoA(this.registers.b.Value);
          return 1;
        },
      },
      0x89: {
        mnemonic: "ADC A, C",
        description:
          "Adds the contents of register C and Carry Flag to the contents of register A.",
        fn: () => {
          this.addByteAndCarryIntoA(this.registers.c.Value);
          return 1;
        },
      },
      0x8a: {
        mnemonic: "ADC A, D",
        description:
          "Adds the contents of register D and Carry Flag to the contents of register A.",
        fn: () => {
          this.addByteAndCarryIntoA(this.registers.d.Value);
          return 1;
        },
      },
      0x8b: {
        mnemonic: "ADC A, E",
        description:
          "Adds the contents of register E and Carry Flag to the contents of register A.",
        fn: () => {
          this.addByteAndCarryIntoA(this.registers.e.Value);
          return 1;
        },
      },
      0x8c: {
        mnemonic: "ADC A, H",
        description:
          "Adds the contents of register H and Carry Flag to the contents of register A.",
        fn: () => {
          this.addByteAndCarryIntoA(this.registers.h.Value);
          return 1;
        },
      },
      0x8d: {
        mnemonic: "ADC A, L",
        description:
          "Adds the contents of register L and Carry Flag to the contents of register A.",
        fn: () => {
          this.addByteAndCarryIntoA(this.registers.l.Value);
          return 1;
        },
      },
      0x8e: {
        mnemonic: "ADC A, (HL)",
        description:
          "Adds the contents of memory specified by the contents of register pair HL and Carry Flag to register A and stores the results in register A.",
        fn: () => {
          this.addByteAndCarryIntoA(this.mmu.readByte(this.registers.hl.Value));
          return 2;
        },
      },
      0x8f: {
        mnemonic: "ADC A, A",
        description:
          "Adds the contents of register A and Carry Flag to the contents of register A.",
        fn: () => {
          this.addByteAndCarryIntoA(this.registers.a.Value);
          return 1;
        },
      },
      0x90: {
        mnemonic: "SUB B",
        description:
          "Subtracts the contents of register B from those of register A and stores the results in register A.",
        fn: () => {
          this.subtractByteFromA(this.registers.b.Value);
          return 1;
        },
      },
      0x91: {
        mnemonic: "SUB C",
        description:
          "Subtracts the contents of register C from those of register A and stores the results in register A.",
        fn: () => {
          this.subtractByteFromA(this.registers.c.Value);
          return 1;
        },
      },
      0x92: {
        mnemonic: "SUB D",
        description:
          "Subtracts the contents of register D from those of register A and stores the results in register A.",
        fn: () => {
          this.subtractByteFromA(this.registers.d.Value);
          return 1;
        },
      },
      0x93: {
        mnemonic: "SUB E",
        description:
          "Subtracts the contents of register E from those of register A and stores the results in register A.",
        fn: () => {
          this.subtractByteFromA(this.registers.e.Value);
          return 1;
        },
      },
      0x94: {
        mnemonic: "SUB H",
        description:
          "Subtracts the contents of register H from those of register A and stores the results in register A.",
        fn: () => {
          this.subtractByteFromA(this.registers.h.Value);
          return 1;
        },
      },
      0x95: {
        mnemonic: "SUB L",
        description:
          "Subtracts the contents of register L from those of register A and stores the results in register A.",
        fn: () => {
          this.subtractByteFromA(this.registers.l.Value);
          return 1;
        },
      },
      0x96: {
        mnemonic: "SUB (HL)",
        description:
          "Subtracts the contents of memory specified by the contents of register pair HL from the contents of Register A and stores the results in register A.",
        fn: () => {
          this.subtractByteFromA(this.mmu.readByte(this.registers.hl.Value));
          return 2;
        },
      },
      0x97: {
        mnemonic: "SUB A",
        description:
          "Subtracts the contents of register A from those of register A and stores the results in register A.",
        fn: () => {
          this.subtractByteFromA(this.registers.a.Value);
          return 1;
        },
      },
      0x98: {
        mnemonic: "SBC A, B",
        description:
          "Subtracts the contents of B and CarryFlag from the contents of register A and stores the results in A.",
        fn: () => {
          this.subtractByteAndCarryFromA(this.registers.b.Value);
          return 1;
        },
      },
      0x99: {
        mnemonic: "SBC A, C",
        description:
          "Subtracts the contents of C and CarryFlag from the contents of register A and stores the results in A.",
        fn: () => {
          this.subtractByteAndCarryFromA(this.registers.c.Value);
          return 1;
        },
      },
      0x9a: {
        mnemonic: "SBC A, D",
        description:
          "Subtracts the contents of D and CarryFlag from the contents of register A and stores the results in A.",
        fn: () => {
          this.subtractByteAndCarryFromA(this.registers.d.Value);
          return 1;
        },
      },
      0x9b: {
        mnemonic: "SBC A, E",
        description:
          "Subtracts the contents of E and CarryFlag from the contents of register A and stores the results in A.",
        fn: () => {
          this.subtractByteAndCarryFromA(this.registers.e.Value);
          return 1;
        },
      },
      0x9c: {
        mnemonic: "SBC A, H",
        description:
          "Subtracts the contents of H and CarryFlag from the contents of register A and stores the results in A.",
        fn: () => {
          this.subtractByteAndCarryFromA(this.registers.h.Value);
          return 1;
        },
      },
      0x9d: {
        mnemonic: "SBC A, L",
        description:
          "Subtracts the contents of L and CarryFlag from the contents of register A and stores the results in A.",
        fn: () => {
          this.subtractByteAndCarryFromA(this.registers.l.Value);
          return 1;
        },
      },
      0x9e: {
        mnemonic: "SBC A, (HL)",
        description:
          "Subtracts the contents of memory specified by HL and CarryFlag from the contents of register A and stores the results in A.",
        fn: () => {
          this.subtractByteAndCarryFromA(
            this.mmu.readByte(this.registers.hl.Value)
          );
          return 2;
        },
      },
      0x9f: {
        mnemonic: "SBC A, A",
        description:
          "Subtracts the contents of A and CarryFlag from the contents of register A and stores the results in A.",
        fn: () => {
          this.subtractByteAndCarryFromA(this.registers.a.Value);
          return 1;
        },
      },
      0xa0: {
        mnemonic: "AND B",
        description:
          "Takes the logical-AND for each bit of the contents of B and A, and stores the results in A.",
        fn: () => {
          this.logicalAndByteWithA(this.registers.b.Value);
          return 1;
        },
      },
      0xa1: {
        mnemonic: "AND C",
        description:
          "Takes the logical-AND for each bit of the contents of C and A, and stores the results in A.",
        fn: () => {
          this.logicalAndByteWithA(this.registers.c.Value);
          return 1;
        },
      },
      0xa2: {
        mnemonic: "AND D",
        description:
          "Takes the logical-AND for each bit of the contents of D and A, and stores the results in A.",
        fn: () => {
          this.logicalAndByteWithA(this.registers.d.Value);
          return 1;
        },
      },
      0xa3: {
        mnemonic: "AND E",
        description:
          "Takes the logical-AND for each bit of the contents of E and A, and stores the results in A.",
        fn: () => {
          this.logicalAndByteWithA(this.registers.e.Value);
          return 1;
        },
      },
      0xa4: {
        mnemonic: "AND H",
        description:
          "Takes the logical-AND for each bit of the contents of H and A, and stores the results in A.",
        fn: () => {
          this.logicalAndByteWithA(this.registers.h.Value);
          return 1;
        },
      },
      0xa5: {
        mnemonic: "AND L",
        description:
          "Takes the logical-AND for each bit of the contents of L and A, and stores the results in A.",
        fn: () => {
          this.logicalAndByteWithA(this.registers.l.Value);
          return 1;
        },
      },
      0xa6: {
        mnemonic: "AND (HL)",
        description:
          "Takes the logical-AND for each bit of the contents of memory specified by the contents of HL and A, and stores the results in A.",
        fn: () => {
          this.logicalAndByteWithA(this.mmu.readByte(this.registers.hl.Value));
          return 2;
        },
      },
      0xa7: {
        mnemonic: "AND A",
        description:
          "Takes the logical-AND for each bit of the contents of A and A, and stores the results in A.",
        fn: () => {
          this.logicalAndByteWithA(this.registers.a.Value);
          return 1;
        },
      },
      0xa8: {
        mnemonic: "XOR B",
        description:
          "Takes the logical exclusive-OR for each bit of the contents of B and A, and stores the results in A.",
        fn: () => {
          this.logicalXorByteWithA(this.registers.b.Value);
          return 1;
        },
      },
      0xa9: {
        mnemonic: "XOR C",
        description:
          "Takes the logical exclusive-OR for each bit of the contents of C and A, and stores the results in A.",
        fn: () => {
          this.logicalXorByteWithA(this.registers.c.Value);
          return 1;
        },
      },
      0xaa: {
        mnemonic: "XOR D",
        description:
          "Takes the logical exclusive-OR for each bit of the contents of D and A, and stores the results in A.",
        fn: () => {
          this.logicalXorByteWithA(this.registers.d.Value);
          return 1;
        },
      },
      0xab: {
        mnemonic: "XOR E",
        description:
          "Takes the logical exclusive-OR for each bit of the contents of E and A, and stores the results in A.",
        fn: () => {
          this.logicalXorByteWithA(this.registers.e.Value);
          return 1;
        },
      },
      0xac: {
        mnemonic: "XOR H",
        description:
          "Takes the logical exclusive-OR for each bit of the contents of H and A, and stores the results in A.",
        fn: () => {
          this.logicalXorByteWithA(this.registers.h.Value);
          return 1;
        },
      },
      0xad: {
        mnemonic: "XOR L",
        description:
          "Takes the logical exclusive-OR for each bit of the contents of L and A, and stores the results in A.",
        fn: () => {
          this.logicalXorByteWithA(this.registers.l.Value);
          return 1;
        },
      },
      0xae: {
        mnemonic: "XOR (HL)",
        description:
          "Takes the logical exclusive-OR for each bit of the contents of memory specified by HL and A, and stores the results in A.",
        fn: () => {
          this.logicalXorByteWithA(this.mmu.readByte(this.registers.hl.Value));
          return 2;
        },
      },
      0xaf: {
        mnemonic: "XOR A",
        description:
          "Takes the logical exclusive-OR for each bit of the contents of A and A, and stores the results in A.",
        fn: () => {
          this.logicalXorByteWithA(this.registers.a.Value);
          return 1;
        },
      },
      0xb0: {
        mnemonic: "OR B",
        description:
          "Takes the logical-OR for each bit of the contents of B and A, and stores the results in A.",
        fn: () => {
          this.logicalOrByteWithA(this.registers.b.Value);
          return 1;
        },
      },
      0xb1: {
        mnemonic: "OR C",
        description:
          "Takes the logical-OR for each bit of the contents of C and A, and stores the results in A.",
        fn: () => {
          this.logicalOrByteWithA(this.registers.c.Value);
          return 1;
        },
      },
      0xb2: {
        mnemonic: "OR D",
        description:
          "Takes the logical-OR for each bit of the contents of D and A, and stores the results in A.",
        fn: () => {
          this.logicalOrByteWithA(this.registers.d.Value);
          return 1;
        },
      },
      0xb3: {
        mnemonic: "OR E",
        description:
          "Takes the logical-OR for each bit of the contents of E and A, and stores the results in A.",
        fn: () => {
          this.logicalOrByteWithA(this.registers.e.Value);
          return 1;
        },
      },
      0xb4: {
        mnemonic: "OR H",
        description:
          "Takes the logical-OR for each bit of the contents of H and A, and stores the results in A.",
        fn: () => {
          this.logicalOrByteWithA(this.registers.h.Value);
          return 1;
        },
      },
      0xb5: {
        mnemonic: "OR L",
        description:
          "Takes the logical-OR for each bit of the contents of L and A, and stores the results in A.",
        fn: () => {
          this.logicalOrByteWithA(this.registers.l.Value);
          return 1;
        },
      },
      0xb6: {
        mnemonic: "OR (HL)",
        description:
          "Takes the logical-OR for each bit of the contents of memory specified by HL and A, and stores the results in A.",
        fn: () => {
          this.logicalOrByteWithA(this.registers.hl.Value);
          return 1;
        },
      },
      0xb7: {
        mnemonic: "OR A",
        description:
          "Takes the logical-OR for each bit of the contents of A and A, and stores the results in A.",
        fn: () => {
          this.logicalOrByteWithA(this.registers.a.Value);
          return 1;
        },
      },
      0xb8: {
        mnemonic: "CP B",
        description:
          "Subtracts the contents of B from those of A and does not store the results.",
        fn: () => {
          this.compareByteWithA(this.registers.b.Value);
          return 1;
        },
      },
      0xb9: {
        mnemonic: "CP C",
        description:
          "Subtracts the contents of C from those of A and does not store the results.",
        fn: () => {
          this.compareByteWithA(this.registers.c.Value);
          return 1;
        },
      },
      0xba: {
        mnemonic: "CP D",
        description:
          "Subtracts the contents of D from those of A and does not store the results.",
        fn: () => {
          this.compareByteWithA(this.registers.d.Value);
          return 1;
        },
      },
      0xbb: {
        mnemonic: "CP E",
        description:
          "Subtracts the contents of E from those of A and does not store the results.",
        fn: () => {
          this.compareByteWithA(this.registers.e.Value);
          return 1;
        },
      },
      0xbc: {
        mnemonic: "CP H",
        description:
          "Subtracts the contents of H from those of A and does not store the results.",
        fn: () => {
          this.compareByteWithA(this.registers.h.Value);
          return 1;
        },
      },
      0xbd: {
        mnemonic: "CP L",
        description:
          "Subtracts the contents of L from those of A and does not store the results.",
        fn: () => {
          this.compareByteWithA(this.registers.l.Value);
          return 1;
        },
      },
      0xbe: {
        mnemonic: "CP (HL)",
        description:
          "Subtracts the contents of memory specified by HL from those of A and does not store the results.",
        fn: () => {
          this.compareByteWithA(this.mmu.readByte(this.registers.hl.Value));
          return 2;
        },
      },
      0xbf: {
        mnemonic: "CP A",
        description:
          "Subtracts the contents of A from those of A and does not store the results.",
        fn: () => {
          this.compareByteWithA(this.registers.a.Value);
          return 1;
        },
      },
      0xc0: {
        mnemonic: "RET NZ",
        description:
          "If the Zero Flag is not set, control is returned to the source program by popping from memory the PC value pushed to the stack when the subroutine was called.",
        fn: () => {
          if (!this.ZeroFlag) {
            this.popFromStackIntoRegister(this.registers.pc);
            return 5;
          }
          return 2;
        },
      },
      0xc1: {
        mnemonic: "POP BC",
        description: "Pops contents from the memory stack and into BC.",
        fn: () => {
          this.popFromStackIntoRegister(this.registers.bc);
          return 3;
        },
      },
      0xc2: {
        mnemonic: "JP NZ, nn",
        description:
          "If the Zero Flag is not set, loads the operand nn to the program counter PC, where nn specifies the address of the subsequently executed instruction.",
        fn: () => {
          if (!this.ZeroFlag) {
            this.registers.pc.Value = this.mmu.readWord(
              this.registers.pc.Value
            );
            return 4;
          }
          this.registers.pc.Value += 2;
          return 3;
        },
      },
      0xc3: {
        mnemonic: "JP nn",
        description:
          "Loads the operand nn to the program counter PC, where nn specifies the address of the subsequently executed instruction.",
        fn: () => {
          this.registers.pc.Value = this.mmu.readWord(this.registers.pc.Value);
          return 4;
        },
      },
      0xc4: {
        mnemonic: "CALL NZ, nn",
        description:
          "If the Zero Flag is not set, pushes the PC value (after reading nn) to the memory specified by the current Stack Pointer. Then, nn is loaded into the PC, and SP is decremented by 2.",
        fn: () => {
          if (!this.ZeroFlag) {
            this.callSubroutine();
            return 6;
          } else {
            return 3;
          }
        },
      },
      0xc5: {
        mnemonic: "PUSH BC",
        description: "Pushes the contents of BC onto the memory stack.",
        fn: () => {
          this.pushWordToStack(this.registers.bc.Value);
          return 4;
        },
      },
      0xc6: {
        mnemonic: "ADD A, n",
        description:
          "Adds 8-bit immediate n to the contents of A and stores the results in A.",
        fn: () => {
          this.addByteToA(this.mmu.readByte(this.registers.pc.Value++));
          return 2;
        },
      },
      0xc7: {
        mnemonic: "RST 00H",
        description: "Performs a CALL to 0x00.",
        fn: () => {
          this.callSubroutine(0);
          return 4;
        },
      },
      0xc8: {
        mnemonic: "RET Z",
        description:
          "If the Zero Flag is set, control is returned to the source program by popping from memory the PC value pushed to the stack when the subroutine was called.",
        fn: () => {
          if (this.ZeroFlag) {
            this.popFromStackIntoRegister(this.registers.pc);
            return 5;
          }
          return 2;
        },
      },
      0xc9: {
        mnemonic: "RET",
        description:
          "Pops from the memory stack the PC value pushed when the subroutine was called, returning control to the source program.",
        fn: () => {
          this.popFromStackIntoRegister(this.registers.pc);
          return 4;
        },
      },
      0xca: {
        mnemonic: "JP Z, nn",
        description:
          "If the Zero Flag is set, loads the operand nn to the program counter PC, where nn specifies the address of the subsequently executed instruction.",
        fn: () => {
          if (this.ZeroFlag) {
            this.registers.pc.Value = this.mmu.readWord(
              this.registers.pc.Value
            );
            return 4;
          }
          this.registers.pc.Value += 2;
          return 3;
        },
      },
      0xcb: {
        mnemonic: "PREFIX CB",
        description:
          "Tells the CPU to fetch an additional byte to be decoded with an alternate instruction mapping.",
        fn: () => {
          throw new Error("0xCB is not an executable instruction.");
        },
      },
      0xcc: {
        mnemonic: "CALL Z, nn",
        description:
          "If the Zero Flag is set, pushes the PC value (after reading nn) to the memory specified by the current Stack Pointer. Then, nn is loaded into the PC, and SP is decremented by 2.",
        fn: () => {
          if (this.ZeroFlag) {
            this.callSubroutine();
            return 6;
          } else {
            return 3;
          }
        },
      },
      0xcd: {
        mnemonic: "CALL nn",
        description:
          "Pushes the PC value (after reading nn) to the memory specified by the current Stack Pointer. Then, nn is loaded into the PC, and SP is decremented by 2.",
        fn: () => {
          this.callSubroutine();
          return 6;
        },
      },
      0xce: {
        mnemonic: "ADC A, n",
        description:
          "Adds the contents of 8-bit immediate n and Carry Flag to A and stores the results in A.",
        fn: () => {
          this.addByteAndCarryIntoA(
            this.mmu.readByte(this.registers.pc.Value++)
          );
          return 2;
        },
      },
      0xcf: {
        mnemonic: "RST 08H",
        description: "Performs a CALL to 0x08.",
        fn: () => {
          this.callSubroutine(1);
          return 4;
        },
      },
      0xd0: {
        mnemonic: "RET NC",
        description:
          "If the Carry Flag is not set, control is returned to the source program by popping from memory the PC value pushed to the stack when the subroutine was called.",
        fn: () => {
          if (!this.CarryFlag) {
            this.popFromStackIntoRegister(this.registers.pc);
            return 5;
          }
          return 2;
        },
      },
      0xd1: {
        mnemonic: "POP DE",
        description: "Pops contents from the memory stack and into DE.",
        fn: () => {
          this.popFromStackIntoRegister(this.registers.de);
          return 3;
        },
      },
      0xd2: {
        mnemonic: "JP NC, nn",
        description:
          "If the Carry Flag is not set, loads the operand nn to the program counter PC, where nn specifies the address of the subsequently executed instruction.",
        fn: () => {
          if (!this.CarryFlag) {
            this.registers.pc.Value = this.mmu.readWord(
              this.registers.pc.Value
            );
            return 4;
          }
          this.registers.pc.Value += 2;
          return 3;
        },
      },
      0xd3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xd4: {
        mnemonic: "CALL NC, nn",
        description:
          "If the Carry Flag is not set, pushes the PC value (after reading nn) to the memory specified by the current Stack Pointer. Then, nn is loaded into the PC, and SP is decremented by 2.",
        fn: () => {
          if (!this.CarryFlag) {
            this.callSubroutine();
            return 6;
          } else {
            return 3;
          }
        },
      },
      0xd5: {
        mnemonic: "PUSH DE",
        description: "Pushes the contents of DE onto the memory stack.",
        fn: () => {
          this.pushWordToStack(this.registers.de.Value);
          return 4;
        },
      },
      0xd6: {
        mnemonic: "SUB n",
        description:
          "Subtracts 8-bit immediate n from the contents of A and stores the result in A.",
        fn: () => {
          this.subtractByteFromA(this.mmu.readByte(this.registers.pc.Value++));
          return 2;
        },
      },
      0xd7: {
        mnemonic: "RST 10H",
        description: "Performs a CALL to 0x10.",
        fn: () => {
          this.callSubroutine(2);
          return 4;
        },
      },
      0xd8: {
        mnemonic: "RET C",
        description:
          "If the Carry Flag is set, control is returned to the source program by popping from memory the PC value pushed to the stack when the subroutine was called.",
        fn: () => {
          if (this.CarryFlag) {
            this.popFromStackIntoRegister(this.registers.pc);
            return 5;
          }
          return 2;
        },
      },
      0xd9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xda: {
        mnemonic: "JP C, nn",
        description:
          "If the Carry Flag is set, loads the operand nn to the program counter PC, where nn specifies the address of the subsequently executed instruction.",
        fn: () => {
          if (this.CarryFlag) {
            this.registers.pc.Value = this.mmu.readWord(
              this.registers.pc.Value
            );
            return 4;
          }
          this.registers.pc.Value += 2;
          return 3;
        },
      },
      0xdb: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xdc: {
        mnemonic: "CALL C, nn",
        description:
          "If the Carry Flag is set, pushes the PC value (after reading nn) to the memory specified by the current Stack Pointer. Then, nn is loaded into the PC, and SP is decremented by 2.",
        fn: () => {
          if (this.CarryFlag) {
            this.callSubroutine();
            return 6;
          } else {
            return 3;
          }
        },
      },
      0xdd: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xde: {
        mnemonic: "SBC A, n",
        description: "",
        fn: () => {
          this.subtractByteAndCarryFromA(
            this.mmu.readByte(this.registers.pc.Value++)
          );
          return 2;
        },
      },
      0xdf: {
        mnemonic: "RST 18H",
        description: "Performs a CALL to 0x18.",
        fn: () => {
          this.callSubroutine(3);
          return 4;
        },
      },
      0xe0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xe1: {
        mnemonic: "POP HL",
        description: "Pops contents from the memory stack and into HL.",
        fn: () => {
          this.popFromStackIntoRegister(this.registers.hl);
          return 3;
        },
      },
      0xe2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xe3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xe4: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xe5: {
        mnemonic: "PUSH HL",
        description: "Pushes the contents of HL onto the memory stack.",
        fn: () => {
          this.pushWordToStack(this.registers.hl.Value);
          return 4;
        },
      },
      0xe6: {
        mnemonic: "AND n",
        description:
          "Takes the logical AND for each bit of 8-bit immediate n and A, and stores the results in A.",
        fn: () => {
          this.logicalAndByteWithA(
            this.mmu.readByte(this.registers.pc.Value++)
          );
          return 2;
        },
      },
      0xe7: {
        mnemonic: "RST 20H",
        description: "Performs a CALL to 0x20.",
        fn: () => {
          this.callSubroutine(4);
          return 4;
        },
      },
      0xe8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xe9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xea: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xeb: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xec: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xed: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xee: {
        mnemonic: "XOR n",
        description:
          "Takes the logical exclusive-OR for each bit of the contents of 8-bit immediate n and A, and stores the results in A.",
        fn: () => {
          this.logicalXorByteWithA(
            this.mmu.readByte(this.registers.pc.Value++)
          );
          return 2;
        },
      },
      0xef: {
        mnemonic: "RST 28H",
        description: "Performs a CALL to 0x28.",
        fn: () => {
          this.callSubroutine(5);
          return 4;
        },
      },
      0xf0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xf1: {
        mnemonic: "POP AF",
        description: "Pops contents from the memory stack and into AF.",
        fn: () => {
          this.popFromStackIntoRegister(this.registers.af);
          return 3;
        },
      },
      0xf2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xf3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xf4: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xf5: {
        mnemonic: "PUSH AF",
        description: "Pushes the contents of AF onto the memory stack.",
        fn: () => {
          this.pushWordToStack(this.registers.af.Value);
          return 4;
        },
      },
      0xf6: {
        mnemonic: "OR n",
        description:
          "Takes the logical-OR for each bit of 8-bit immediate n and A and stores the results in A.",
        fn: () => {
          this.logicalOrByteWithA(this.mmu.readByte(this.registers.pc.Value++));
          return 2;
        },
      },
      0xf7: {
        mnemonic: "RST 30H",
        description: "Performs a CALL to 0x30.",
        fn: () => {
          this.callSubroutine(6);
          return 4;
        },
      },
      0xf8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xf9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xfa: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xfb: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xfc: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xfd: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xfe: {
        mnemonic: "CP n",
        description:
          "Subtracts the contents of 8-bit immediate from those of A and does not store the results.",
        fn: () => {
          this.compareByteWithA(this.mmu.readByte(this.registers.pc.Value++));
          return 2;
        },
      },
      0xff: {
        mnemonic: "RST 38H",
        description: "Performs a CALL to 0x38.",
        fn: () => {
          this.callSubroutine(7);
          return 4;
        },
      },
    };

    this.cbOperations = {};
  }

  /**
   * Resets the CPU.
   */
  protected reset() {
    for (const k of Object.keys(this.registers)) {
      this.registers[k as keyof ICPURegisterSet].Value = 0;
    }
    this.clock.Value = 0;
  }

  /**
   * Fetches the next byte and increments the program counter.
   */
  protected fetch(): number {
    return this.mmu.readByte(this.registers.pc.Value++);
  }

  /**
   * Decodes an opcode and returns an operation.
   */
  protected decode(byte: number): IOperation {
    if (byte !== 0xcb) {
      return this.operations[byte];
    } else {
      return this.cbOperations[this.fetch()];
    }
  }

  protected execute() {
    throw new Error("execute() is not implemented.");
  }

  /**
   * Flag Getters and Setters
   * for convenience
   */

  protected get ZeroFlag(): boolean {
    return !!(this.registers.f.Value & 0x80);
  }

  protected set ZeroFlag(val: boolean) {
    if (val) {
      this.registers.f.Value |= 0x80;
    } else {
      this.registers.f.Value &= 0x7f;
    }
  }

  protected get SubtractFlag(): boolean {
    return !!(this.registers.f.Value & 0x40);
  }

  protected set SubtractFlag(val: boolean) {
    if (val) {
      this.registers.f.Value |= 0x40;
    } else {
      this.registers.f.Value &= 0xbf;
    }
  }

  protected get HalfCarryFlag(): boolean {
    return !!(this.registers.f.Value & 0x20);
  }

  protected set HalfCarryFlag(val: boolean) {
    if (val) {
      this.registers.f.Value |= 0x20;
    } else {
      this.registers.f.Value &= 0xdf;
    }
  }

  protected get CarryFlag(): boolean {
    return !!(this.registers.f.Value & 0x10);
  }

  protected set CarryFlag(val: boolean) {
    if (val) {
      this.registers.f.Value |= 0x10;
    } else {
      this.registers.f.Value &= 0xef;
    }
  }

  /**
   * LD r, r'
   * Loads the contents of register r' into register r.
   *
   * Opcodes:
   *   0x40 - 0x45, 0x47 - 0x4D, 0x4F
   *   0x50 - 0x55, 0x57 - 0x5D, 0x5F
   *   0x60 - 0x65, 0x67 - 0x6D, 0x6F
   *                0x78 - 0x7D, 0x7F
   */
  protected loadRegisterToRegister(
    source: CPURegister8,
    destination: CPURegister8
  ) {
    destination.Value = source.Value;
  }

  /**
   * LD dd, nn
   * Loads 2 bytes of immediate data to register pair dd.
   *
   * Opcodes: 0x01, 0x11, 0x21, 0x31
   */
  protected loadImmediateWordToRegister(register: CPURegister16) {
    register.Value = this.mmu.readWord(this.registers.pc.Value);
    this.registers.pc.Value += 2;
  }

  /**
   * INC r
   * Increments the contents of register r by 1.
   *
   * Opcodes: 0x04, 0x14, 0x24, 0x0C, 0x1C, 0x2C, 0x3C
   */
  protected incrementRegister(register: CPURegister8) {
    // When calculating the HalfCarryFlag, check to see if
    // bit at index 3 carries to bit 4 (the least significant bit being index 0).
    // Example: 0b00001111 + 0b00000001 = 0b00010000
    this.HalfCarryFlag = (register.Value++ & 0xf) + 1 > 0xf;
    this.SubtractFlag = false;
    this.ZeroFlag = register.Value ? false : true;
  }

  /**
   * DEC r
   * Decrements the contents of register r by 1.
   *
   * Opcodes: 0x05, 0x15, 0x25, 0x0D, 0x1D, 0x2D, 0x3D
   */
  protected decrementRegister(register: CPURegister8) {
    // Similar to INC, except flip the logic to work for subtraction.
    // This way, we know if bit at index 3 borrowed from bit at index 4.
    this.HalfCarryFlag = (register.Value-- & 0xf) - 1 < 0;
    this.SubtractFlag = true;
    this.ZeroFlag = register.Value ? false : true;
  }

  /**
   * ADD HL, ss
   * Adds the contents of register pair ss to the contents of register pair HL
   * and stores the results in HL.
   *
   * Opcodes: 0x09, 0x19, 0x29, 0x39
   */
  protected addWordToHL(value: number) {
    const hl = this.registers.hl.Value;
    value &= 0xffff;

    this.SubtractFlag = false;
    // Set if there is a carry from bit 11; otherwise reset.
    this.HalfCarryFlag = (hl & 0xfff) + (value & 0xfff) > 0xfff;
    // Set if there is a carry from bit 15; otherwise reset.
    this.CarryFlag = hl + value > 0xffff;

    this.registers.hl.Value += value;
  }

  /**
   * ADD A, r
   * Adds the contents of register r to those of register A and stores
   * the results in register A.
   *
   * Opcodes: 0x80 - 0x85, 0x87
   *
   * ADD A, (HL)
   * Adds the contents of memory specified by the contents of register pair HL to
   * the contents of Register A and stores the results in register A.
   *
   * Opcodes: 0x86
   *
   * ADD A, n
   * Adds the contents of 8-bit immediate n to those of register A and
   * stores the results in register A.
   *
   * Opcodes: 0xC6
   */
  protected addByteToA(value: number) {
    const a = this.registers.a.Value;
    value &= 0xff;

    this.registers.a.Value = a + value;

    this.CarryFlag = a + value > 0xff;
    this.HalfCarryFlag = (a & 0xf) + (value & 0xf) > 0xf;
    this.ZeroFlag = this.registers.a.Value === 0;
    this.SubtractFlag = false;
  }

  /**
   * ADC A, r
   * Adds the contents of register r and Carry Flag to register A and stores
   * the results in register A.
   *
   * Opcodes: 0x88 - 0x8D, 0x8F
   *
   * ADC A, (HL)
   * Adds the contents of memory specified by the contents of register pair HL
   * and Carry Flag to register A and stores the results in register A.
   *
   * Opcodes: 0x8E
   *
   * ADC A, n
   * Adds the contents of 8-bit immediate n and Carry Flag to register A and
   * stores the results in register A.
   *
   * Opcodes: 0xCE
   */
  protected addByteAndCarryIntoA(value: number) {
    const a = this.registers.a.Value;
    const cf = this.CarryFlag ? 1 : 0;
    value &= 0xff;

    this.registers.a.Value = a + value + cf;

    this.CarryFlag = a + value + cf > 0xff;
    this.HalfCarryFlag = (a & 0xf) + (value & 0xf) + cf > 0xf;
    this.ZeroFlag = this.registers.a.Value === 0;
    this.SubtractFlag = false;
  }

  /**
   * SUB A, r
   * Subtracts the contents of register r from those of register A and stores
   * the results in register A.
   *
   * Opcodes: 0x90 - 0x95, 0x97
   *
   * SUB A, (HL)
   * Subtracts the contents of memory specified by the contents of register pair HL from
   * the contents of Register A and stores the results in register A.
   *
   * Opcodes: 0x96
   *
   * SUB n
   * Subtracts 8-bit immediate n from contents of register A and stores
   * the results in register A.
   *
   * Opcodes: 0xD6
   */
  protected subtractByteFromA(value: number) {
    const a = this.registers.a.Value;
    value &= 0xff;

    this.registers.a.Value = a - value;

    this.CarryFlag = a - value < 0;
    this.HalfCarryFlag = (a & 0xf) - (value & 0xf) < 0;
    this.ZeroFlag = this.registers.a.Value === 0;
    this.SubtractFlag = true;
  }

  /**
   * CP r
   * Subtracts the contents of register r from those of register A and
   * does not store the results.
   *
   * Opcodes: 0xB8 - 0xBD, 0xBF
   *
   * CP (HL)
   * Subtracts the contents of memory specified by register pair HL from
   * those of register A and does not store the results.
   *
   * Opcodes: 0x8E
   *
   * CP n
   * Subtracts the contents of 8-bit immediate n from those of register A
   * and does not store the results.
   *
   * Opcodes: 0xFE
   */
  protected compareByteWithA(value: number) {
    const a = this.registers.a.Value;
    value &= 0xff;

    this.CarryFlag = a - value < 0;
    this.HalfCarryFlag = (a & 0xf) - (value & 0xf) < 0;
    this.ZeroFlag = a - value === 0;
    this.SubtractFlag = true;
  }

  /**
   * SBC A, r
   * Subtracts the contents of register r and Carry Flag from register A and
   * stores the results in register A.
   *
   * Opcodes: 0x98 - 0x9D, 0x9F
   *
   * SBC A, (HL)
   * Subtracts the contents of memory specified by the contents of register
   * pair HL and Carry Flag from register A and stores the results in
   * register A.
   *
   * Opcodes: 0x9E
   *
   * SBC A, n
   * Subtracts the contents of 8-bit immediate n and Carry Flag from register
   * A and stores the results in register A.
   *
   * Opcodes: 0xDE
   */
  protected subtractByteAndCarryFromA(value: number) {
    const a = this.registers.a.Value;
    const cf = this.CarryFlag ? 1 : 0;
    value &= 0xff;

    this.registers.a.Value = a - value - cf;

    this.CarryFlag = a - value - cf < 0;
    this.HalfCarryFlag = (a & 0xf) - (value & 0xf) - cf < 0;
    this.ZeroFlag = this.registers.a.Value === 0;
    this.SubtractFlag = true;
  }

  /**
   * AND r
   * Takes the logical AND for each bit of the contents of register r
   * and register A, and stores the results in register A.
   *
   * Opcodes: 0xA0 - 0xA5, 0xA7
   *
   * AND (HL)
   * Takes the logical AND for each bit of the contents of memory specified
   * by the contents of register pair HL and register A, and stores the results
   * in register A.
   *
   * Opcodes: 0xA6
   *
   * AND n
   * Takes the logical AND for each bit of 8-bit immediate n
   * and register A, and stores the results in register A.
   *
   * Opcodes: 0xE6
   */
  protected logicalAndByteWithA(value: number) {
    this.registers.a.Value &= value;
    this.CarryFlag = false;
    this.HalfCarryFlag = true;
    this.SubtractFlag = false;
    this.ZeroFlag = this.registers.a.Value === 0;
  }

  /**
   * XOR r
   * Takes the logical exclusive-OR for each bit of the contents of
   * register r and register A, and stores the results in register A.
   *
   * Opcodes: 0xA8 - 0xAD, 0xAF
   *
   * XOR (HL)
   * Takes the logical exclusive-OR for each bit of the contents of
   * memory specified by the contents of register pair HL and register A,
   * and stores the results in register A.
   *
   * Opcodes: 0xAE
   *
   * XOR n
   * Takes the logical exclusive-OR for each bit of the contents of
   * 8-bit immediate n and register A, and stores the results in register A.
   *
   * Opcodes: 0xEE
   */
  protected logicalXorByteWithA(value: number) {
    this.registers.a.Value ^= value;
    this.CarryFlag = false;
    this.HalfCarryFlag = false;
    this.SubtractFlag = false;
    this.ZeroFlag = this.registers.a.Value === 0;
  }

  /**
   * OR r
   * Takes the logical-OR for each bit of the contents of
   * register r and register A, and stores the results in register A.
   *
   * Opcodes: 0xB0 - 0xB5, 0xB7
   *
   * OR (HL)
   * Takes the logical-OR for each bit of the contents of
   * memory specified by the contents of register pair HL and register A,
   * and stores the results in register A.
   *
   * Opcodes: 0xB6
   *
   * OR n
   * Takes the logical-OR for each bit of 8-bit immediate n
   * and the contents of register A, and stores the results in register A.
   *
   * Opcodes: 0xF6
   */
  protected logicalOrByteWithA(value: number) {
    this.registers.a.Value |= value;
    this.CarryFlag = false;
    this.HalfCarryFlag = false;
    this.SubtractFlag = false;
    this.ZeroFlag = this.registers.a.Value === 0;
  }

  /**
   * POP qq
   * Pops contents from the memory stack and into register pair qq.
   *
   * Opcodes: 0xC1, 0xD1, 0xE1, 0xF1
   *
   * RET
   * Pops from the memory stack the PC value pushed when the subroutine was
   * called, returning control to the source program.
   *
   * In this case, the 16-bit of address specified by SP are loaded into
   * the PC, and the contents of SP are incremented by 2.
   *
   * Opcodes: 0xC9
   */
  protected popFromStackIntoRegister(register: CPURegister16) {
    register.Value = this.mmu.readWord(this.registers.sp.Value);
    this.registers.sp.Value += 2;
  }

  /**
   * PUSH qq
   * Pushes the contents of register pair qq onto the memory stack.
   *
   * Opcodes: 0xC5, 0xD5, 0xE5, 0xF5
   */
  protected pushWordToStack(value: number) {
    this.registers.sp.Value -= 2;
    this.mmu.writeWord(this.registers.sp.Value, value);
  }

  /**
   * CALL nn
   * Pushes the PC value (after reading nn) to the memory specified by the
   * current Stack Pointer. Then, nn is loaded into the PC, and SP is
   * decremented by 2.
   *
   * Opcodes: 0xCD
   *
   * CALL cc, nn
   * If condition cc is true, then performs CALL nn.
   *
   * Opcodes: 0xC4, 0xCC, 0xD4, 0xDC
   *
   * RST t
   * Similar to a CALL instruction, except instead of providing the address
   * to a subroutine, the address is calculated from operand t.
   *
   * Opcodes: 0xC7, 0xCF, 0xD7, 0xDF, 0xE7, 0xEF, 0xF7, 0xFF
   */
  protected callSubroutine(resetByteOffset?: number) {
    let subroutineAddress;
    if (resetByteOffset === undefined) {
      // If this is a CALL instruction, read the immediate data.
      subroutineAddress = this.mmu.readWord(this.registers.pc.Value);
      this.registers.pc.Value += 2;
    } else {
      // If this is a RST instruction, calculate the address to use.
      subroutineAddress = resetByteOffset * 0x08;
    }

    // Decrement the stack pointer so we can write PC to the stack.
    this.registers.sp.Value -= 2;
    this.mmu.writeWord(this.registers.sp.Value, this.registers.pc.Value);

    // Update the program counter to the address of the subroutine..
    this.registers.pc.Value = subroutineAddress;
  }

  /**
   * Convert a byte to a signed number.
   * In JavaScript, the operands of all bitwise operaters are converted to
   * signed 32-bit integers in two's complement format, so in order to
   * interpret a byte as a signed number we just shift it 24 bits left,
   * and then 24 bits right with the sign-propagating bitwise shift.
   *
   * Source:https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators#Signed_32-bit_integers
   * Example: 0x80 -> 0x80000000 -> 0xFFFFFF80 == -128 in 32 bit two's complement.
   */
  protected byteToSigned(byte: number) {
    return ((byte & 0xff) << 24) >> 24;
  }
}

/**
 * Interfaces
 */

export interface IOperationMap {
  [index: number]: IOperation;
}

export interface IOperation {
  /**
   * The mnemonic for the operation, such as ADD or LD.
   */
  mnemonic: string;
  /**
   * A description of the operation.
   */
  description: string;
  /**
   * A function which emulates the operation and returns the number
   * of clock cycles the operation took.
   */
  fn: () => number;
}
