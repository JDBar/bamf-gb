import CPURegister16 from "./class.CPURegister16";
import CPURegister8 from "./class.CPURegister8";
import CPURegisterPair from "./class.CPURegisterPair";
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
          this.loadImmediateWordTo16Bit(this.registers.bc as CPURegisterPair);
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
          this.incrementRegister8(this.registers.b as CPURegister8);
          return 1;
        },
      },
      0x05: {
        mnemonic: "DEC B",
        description: "Decrement B",
        fn: () => {
          this.decrementRegister8(this.registers.b as CPURegister8);
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
          this.add16BitIntoHL(this.registers.bc as CPURegisterPair);
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
          this.incrementRegister8(this.registers.c as CPURegister8);
          return 1;
        },
      },
      0x0d: {
        mnemonic: "DEC C",
        description: "Decrement C",
        fn: () => {
          this.decrementRegister8(this.registers.c as CPURegister8);
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
          this.loadImmediateWordTo16Bit(this.registers.de as CPURegisterPair);
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
          this.incrementRegister8(this.registers.d as CPURegister8);
          return 1;
        },
      },
      0x15: {
        mnemonic: "DEC D",
        description: "Decrement D",
        fn: () => {
          this.decrementRegister8(this.registers.d as CPURegister8);
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
          this.add16BitIntoHL(this.registers.de as CPURegisterPair);
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
          this.incrementRegister8(this.registers.e as CPURegister8);
          return 1;
        },
      },
      0x1d: {
        mnemonic: "DEC E",
        description: "Decrement E",
        fn: () => {
          this.decrementRegister8(this.registers.e as CPURegister8);
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
          this.loadImmediateWordTo16Bit(this.registers.hl as CPURegisterPair);
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
          this.incrementRegister8(this.registers.h as CPURegister8);
          return 1;
        },
      },
      0x25: {
        mnemonic: "DEC H",
        description: "Decrement H",
        fn: () => {
          this.decrementRegister8(this.registers.h as CPURegister8);
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
          this.add16BitIntoHL(this.registers.hl as CPURegisterPair);
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
          this.incrementRegister8(this.registers.l as CPURegister8);
          return 1;
        },
      },
      0x2d: {
        mnemonic: "DEC L",
        description: "Decrement L",
        fn: () => {
          this.decrementRegister8(this.registers.l as CPURegister8);
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
          this.loadImmediateWordTo16Bit(this.registers.sp);
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
          this.add16BitIntoHL(this.registers.sp);
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
          this.incrementRegister8(this.registers.a as CPURegister8);
          return 1;
        },
      },
      0x3d: {
        mnemonic: "DEC A",
        description: "Decrement A",
        fn: () => {
          this.decrementRegister8(this.registers.a as CPURegister8);
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
          this.load8BitTo8Bit(this.registers.b, this.registers.b);
          return 1;
        },
      },
      0x41: {
        mnemonic: "LD B, C",
        description: "Loads the contents of register C into register B.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.c, this.registers.b);
          return 1;
        },
      },
      0x42: {
        mnemonic: "LD B, D",
        description: "Loads the contents of register D into register B.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.d, this.registers.b);
          return 1;
        },
      },
      0x43: {
        mnemonic: "LD B, E",
        description: "Loads the contents of register E into register B.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.e, this.registers.b);
          return 1;
        },
      },
      0x44: {
        mnemonic: "LD B, H",
        description: "Loads the contents of register H into register B.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.h, this.registers.b);
          return 1;
        },
      },
      0x45: {
        mnemonic: "LD B, L",
        description: "Loads the contents of register L into register B.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.l, this.registers.b);
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
          this.load8BitTo8Bit(this.registers.a, this.registers.b);
          return 1;
        },
      },
      0x48: {
        mnemonic: "LD C, B",
        description: "Loads the contents of register B into register C.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.b, this.registers.c);
          return 1;
        },
      },
      0x49: {
        mnemonic: "LD C, C",
        description: "Loads the contents of register C into register C.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.c, this.registers.c);
          return 1;
        },
      },
      0x4a: {
        mnemonic: "LD C, D",
        description: "Loads the contents of register D into register C.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.d, this.registers.c);
          return 1;
        },
      },
      0x4b: {
        mnemonic: "LD C, E",
        description: "Loads the contents of register E into register C.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.e, this.registers.c);
          return 1;
        },
      },
      0x4c: {
        mnemonic: "LD C, H",
        description: "Loads the contents of register H into register C.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.h, this.registers.c);
          return 1;
        },
      },
      0x4d: {
        mnemonic: "LD C, L",
        description: "Loads the contents of register L into register C.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.l, this.registers.c);
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
          this.load8BitTo8Bit(this.registers.a, this.registers.c);
          return 1;
        },
      },
      0x50: {
        mnemonic: "LD D, B",
        description: "Loads the contents of register B into register D.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.b, this.registers.d);
          return 1;
        },
      },
      0x51: {
        mnemonic: "LD D, C",
        description: "Loads the contents of register C into register D.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.c, this.registers.d);
          return 1;
        },
      },
      0x52: {
        mnemonic: "LD D, D",
        description: "Loads the contents of register D into register D.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.d, this.registers.d);
          return 1;
        },
      },
      0x53: {
        mnemonic: "LD D, E",
        description: "Loads the contents of register E into register D.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.e, this.registers.d);
          return 1;
        },
      },
      0x54: {
        mnemonic: "LD D, H",
        description: "Loads the contents of register H into register D.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.h, this.registers.d);
          return 1;
        },
      },
      0x55: {
        mnemonic: "LD D, L",
        description: "Loads the contents of register L into register D.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.l, this.registers.d);
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
          this.load8BitTo8Bit(this.registers.a, this.registers.d);
          return 1;
        },
      },
      0x58: {
        mnemonic: "LD E, B",
        description: "Loads the contents of register B into register E.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.b, this.registers.e);
          return 1;
        },
      },
      0x59: {
        mnemonic: "LD E, C",
        description: "Loads the contents of register C into register E.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.c, this.registers.e);
          return 1;
        },
      },
      0x5a: {
        mnemonic: "LD E, D",
        description: "Loads the contents of register D into register E.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.d, this.registers.e);
          return 1;
        },
      },
      0x5b: {
        mnemonic: "LD E, E",
        description: "Loads the contents of register E into register E.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.e, this.registers.e);
          return 1;
        },
      },
      0x5c: {
        mnemonic: "LD E, H",
        description: "Loads the contents of register H into register E.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.h, this.registers.e);
          return 1;
        },
      },
      0x5d: {
        mnemonic: "LD E, L",
        description: "Loads the contents of register L into register E.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.l, this.registers.e);
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
          this.load8BitTo8Bit(this.registers.a, this.registers.e);
          return 1;
        },
      },
      0x60: {
        mnemonic: "LD H, B",
        description: "Loads the contents of register B into register H.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.b, this.registers.h);
          return 1;
        },
      },
      0x61: {
        mnemonic: "LD H, C",
        description: "Loads the contents of register C into register H.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.c, this.registers.h);
          return 1;
        },
      },
      0x62: {
        mnemonic: "LD H, D",
        description: "Loads the contents of register D into register H.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.d, this.registers.h);
          return 1;
        },
      },
      0x63: {
        mnemonic: "LD H, E",
        description: "Loads the contents of register E into register H.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.e, this.registers.h);
          return 1;
        },
      },
      0x64: {
        mnemonic: "LD H, H",
        description: "Loads the contents of register H into register H.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.h, this.registers.h);
          return 1;
        },
      },
      0x65: {
        mnemonic: "LD H, L",
        description: "Loads the contents of register L into register H.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.l, this.registers.h);
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
          this.load8BitTo8Bit(this.registers.a, this.registers.h);
          return 1;
        },
      },
      0x68: {
        mnemonic: "LD L, B",
        description: "Loads the contents of register B into register L.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.b, this.registers.l);
          return 1;
        },
      },
      0x69: {
        mnemonic: "LD L, C",
        description: "Loads the contents of register C into register L.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.c, this.registers.l);
          return 1;
        },
      },
      0x6a: {
        mnemonic: "LD L, D",
        description: "Loads the contents of register D into register L.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.d, this.registers.l);
          return 1;
        },
      },
      0x6b: {
        mnemonic: "LD L, E",
        description: "Loads the contents of register E into register L.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.e, this.registers.l);
          return 1;
        },
      },
      0x6c: {
        mnemonic: "LD L, H",
        description: "Loads the contents of register H into register L.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.h, this.registers.l);
          return 1;
        },
      },
      0x6d: {
        mnemonic: "LD L, L",
        description: "Loads the contents of register L into register L.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.l, this.registers.l);
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
          this.load8BitTo8Bit(this.registers.a, this.registers.l);
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
          this.load8BitTo8Bit(this.registers.b, this.registers.a);
          return 1;
        },
      },
      0x79: {
        mnemonic: "LD A, C",
        description: "Loads the contents of register C into register A.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.c, this.registers.a);
          return 1;
        },
      },
      0x7a: {
        mnemonic: "LD A, D",
        description: "Loads the contents of register D into register A.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.d, this.registers.a);
          return 1;
        },
      },
      0x7b: {
        mnemonic: "LD A, E",
        description: "Loads the contents of register E into register A.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.e, this.registers.a);
          return 1;
        },
      },
      0x7c: {
        mnemonic: "LD A, H",
        description: "Loads the contents of register H into register A.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.h, this.registers.a);
          return 1;
        },
      },
      0x7d: {
        mnemonic: "LD A, L",
        description: "Loads the contents of register L into register A.",
        fn: () => {
          this.load8BitTo8Bit(this.registers.l, this.registers.a);
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
          this.load8BitTo8Bit(this.registers.a, this.registers.a);
          return 1;
        },
      },
      0x80: {
        mnemonic: "ADD A, B",
        description: "Adds the contents of register B to those of register A.",
        fn: () => {
          this.add8BitIntoA(this.registers.b);
          return 1;
        },
      },
      0x81: {
        mnemonic: "ADD A, C",
        description: "Adds the contents of register C to those of register A.",
        fn: () => {
          this.add8BitIntoA(this.registers.c);
          return 1;
        },
      },
      0x82: {
        mnemonic: "ADD A, D",
        description: "Adds the contents of register D to those of register A.",
        fn: () => {
          this.add8BitIntoA(this.registers.d);
          return 1;
        },
      },
      0x83: {
        mnemonic: "ADD A, E",
        description: "Adds the contents of register E to those of register A.",
        fn: () => {
          this.add8BitIntoA(this.registers.e);
          return 1;
        },
      },
      0x84: {
        mnemonic: "ADD A, H",
        description: "Adds the contents of register H to those of register A.",
        fn: () => {
          this.add8BitIntoA(this.registers.h);
          return 1;
        },
      },
      0x85: {
        mnemonic: "ADD A, L",
        description: "Adds the contents of register L to those of register A.",
        fn: () => {
          this.add8BitIntoA(this.registers.l);
          return 1;
        },
      },
      0x86: {
        mnemonic: "ADD A, (HL)",
        description:
          "Adds the contents of memory specified by the contents of register pair HL to the contents of register A.",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x87: {
        mnemonic: "ADD A, A",
        description: "Adds the contents of register A to those of register A.",
        fn: () => {
          this.add8BitIntoA(this.registers.a);
          return 1;
        },
      },
      0x88: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x89: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x8a: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x8b: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x8c: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x8d: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x8e: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x8f: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x90: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x91: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x92: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x93: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x94: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x95: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x96: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x97: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x98: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x99: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x9a: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x9b: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x9c: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x9d: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x9e: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0x9f: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xa0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xa1: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xa2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xa3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xa4: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xa5: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xa6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xa7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xa8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xa9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xaa: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xab: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xac: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xad: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xae: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xaf: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xb0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xb1: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xb2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xb3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xb4: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xb5: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xb6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xb7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xb8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xb9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xba: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xbb: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xbc: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xbd: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xbe: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xbf: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xc0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xc1: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xc2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xc3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xc4: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xc5: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xc6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xc7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xc8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xc9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xca: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xcb: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xcc: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xcd: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xce: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xcf: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xd0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xd1: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xd2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
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
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xd5: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xd6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xd7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xd8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
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
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
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
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
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
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xdf: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
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
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
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
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xe6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xe7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
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
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xef: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
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
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
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
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xf6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xf7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
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
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
      },
      0xff: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
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
  protected load8BitTo8Bit(source: CPURegister8, destination: CPURegister8) {
    destination.Value = source.Value;
  }

  /**
   * LD dd, nn
   * Loads 2 bytes of immediate data to register pair dd.
   *
   * Opcodes: 0x01, 0x11, 0x21, 0x31
   */
  protected loadImmediateWordTo16Bit(register: CPURegister16) {
    register.Value = this.mmu.readWord(this.registers.pc.Value);
    this.registers.pc.Value += 2;
  }

  /**
   * INC r
   * Increments the contents of register r by 1.
   *
   * Opcodes: 0x04, 0x14, 0x24, 0x0C, 0x1C, 0x2C, 0x3C
   */
  protected incrementRegister8(register: CPURegister8) {
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
  protected decrementRegister8(register: CPURegister8) {
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
  protected add16BitIntoHL(register: CPURegister16) {
    this.SubtractFlag = false;
    // Set if there is a carry from bit 11; otherwise reset.
    this.HalfCarryFlag =
      (this.registers.hl.Value & 0xfff) + (register.Value & 0xfff) > 0xfff;
    // Set if there is a carry from bit 15; otherwise reset.
    this.CarryFlag = this.registers.hl.Value + register.Value > 0xffff;
    this.registers.hl.Value += register.Value;
  }

  /**
   * ADD A, r
   * Adds the contents of register r to those of register A and stores the results in register A.
   *
   * Opcodes: 0x80 - 0x85, 0x87
   */
  protected add8BitIntoA(register: CPURegister8) {
    const a = this.registers.a.Value;
    const r = register.Value;
    this.registers.a.Value = a + r;
    this.CarryFlag = a + r > 0xff;
    this.HalfCarryFlag = (a & 0xf) + (r & 0xf) > 0xf;
    this.ZeroFlag = this.registers.a.Value === 0;
    this.SubtractFlag = false;
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
