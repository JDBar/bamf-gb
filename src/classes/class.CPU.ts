import CPURegister from "./class.CPURegister";
import CPURegister16 from "./class.CPURegister16";
import CPURegister8 from "./class.CPURegister8";
import CPURegisterPair from "./class.CPURegisterPair";
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
   */
  private clock: IRegisterSet;

  /**
   * The set of registers on the CPU.
   * A register can hold 8 or 16 bits (1-2 bytes).
   */
  private registers: IRegisterSet;

  /**
   * The memory mapping unit of the Gameboy.
   * Check out README.md and class.MMU.ts for more information.
   * http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-Memory
   */
  private mmu: MMU;

  /**
   * The main instruction set of the Gameboy CPU.
   * Contains operations for opcodes 0x00 - 0xff.
   */
  private operations: IOperationMap;

  /**
   * The CB-prefixed instruction set of the Gameboy CPU.
   * 0xcb is an opcode to fetch an additional byte to use
   * with an alternate instruction mapping.
   */
  private cbOperations: IOperationMap;

  constructor() {
    this.mmu = new MMU();

    this.clock = {
      mCycles: new CPURegister8(), // The "CYCL" value in Gameboy Programming Manual.
      tCycles: new CPURegister8(), // The true number of cycles (unimplemented).
    };

    this.registers = {};

    /**
     * Accumulator register for storing data and results of
     * arithmetic and logical operations.
     */
    this.registers.a = new CPURegister8();

    /**
     * Auxillary registers B, C, D, E, F, H and L.
     * These serve as auxillary registers to the accumulator. As register
     * pairs, (BC, DE, HL) they are 16-bit registers that function as data pointers.
     */
    this.registers.b = new CPURegister8();
    this.registers.c = new CPURegister8();
    this.registers.d = new CPURegister8();
    this.registers.e = new CPURegister8();
    /**
     * Flags register (bits: ZNHCxxxx)
     * Z: Zero Flag
     * N : Subtract Flag
     * H: Half Carry Flag
     * C: Carry Flag
     */
    this.registers.f = new CPURegister8();
    this.registers.h = new CPURegister8();
    this.registers.l = new CPURegister8();
    this.registers.pc = new CPURegister16(); // Program counter.
    this.registers.sp = new CPURegister16(); // Stack pointer.

    /**
     * Set up register pairs for convenience. These are useful
     * for instructions which treat two 8-bit registers as a single
     * 16-bit register. (e.g. opcode 0x01)
     */
    this.registers.af = new CPURegisterPair(
      this.registers.a as CPURegister8,
      this.registers.f as CPURegister8
    );
    this.registers.bc = new CPURegisterPair(
      this.registers.b as CPURegister8,
      this.registers.c as CPURegister8
    );
    this.registers.de = new CPURegisterPair(
      this.registers.d as CPURegister8,
      this.registers.e as CPURegister8
    );
    this.registers.hl = new CPURegisterPair(
      this.registers.h as CPURegister8,
      this.registers.l as CPURegister8
    );

    this.operations = {
      0x00: {
        mnemonic: "NOP",
        description: "No operation.",
        fn: () => {
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x01: {
        mnemonic: "LD BC, nn",
        description: "Load 16-bit immediate into BC.",
        fn: () => {
          this.loadImmediateWordToPair(this.registers.bc as CPURegisterPair);
          this.clock.mCycles.Value += 3;
        },
        mCycles: 3,
      },
      0x02: {
        mnemonic: "LD (BC), A",
        description: "Save A to address (BC).",
        fn: () => {
          this.mmu.writeByte(this.registers.bc.Value, this.registers.a.Value);
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x03: {
        mnemonic: "INC BC",
        description: "Increment 16-bit BC",
        fn: () => {
          this.registers.bc.Value++;
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x04: {
        mnemonic: "INC B",
        description: "Increment B",
        fn: () => {
          this.incrementRegister8(this.registers.b as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x05: {
        mnemonic: "DEC B",
        description: "Decrement B",
        fn: () => {
          this.decrementRegister8(this.registers.b as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x06: {
        mnemonic: "LD B, n",
        description: "Load 8-bit immediate into register B.",
        fn: () => {
          this.registers.b.Value = this.mmu.readByte(this.registers.pc.Value++);
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
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
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x08: {
        mnemonic: "LD (nn), SP",
        description:
          "Stores the lower byte of SP at address (nn) and the upper byte of SP at address (nn + 1)",
        fn: () => {
          const address = this.mmu.readWord(this.registers.pc.Value);
          this.registers.pc.Value += 2;
          this.mmu.writeWord(address, this.registers.sp.Value);
          this.clock.mCycles.Value += 5;
        },
        mCycles: 5,
      },
      0x09: {
        mnemonic: "ADD HL, BC",
        description:
          "Adds the contents of BC to the contents of HL and stores results in HL.",
        fn: () => {
          this.SubtractFlag = false;
          // Set if there is a carry from bit 11; otherwise reset.
          this.HalfCarryFlag =
            (this.registers.hl.Value & 0xfff) +
              (this.registers.bc.Value & 0xfff) >
            0xfff;
          // Set if there is a carry from bit 15; otherwise reset.
          this.CarryFlag =
            (this.registers.hl.Value & 0xffff) +
              (this.registers.bc.Value & 0xffff) >
            0xfff;
          this.registers.hl.Value += this.registers.bc.Value;
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x0a: {
        mnemonic: "LD A, (BC)",
        description: "Loads the byte at address (BC) into A.",
        fn: () => {
          this.registers.a.Value = this.mmu.readByte(this.registers.bc.Value);
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x0b: {
        mnemonic: "DEC BC",
        description: "Decrement the contents of BC by 1.",
        fn: () => {
          this.registers.bc.Value--;
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x0c: {
        mnemonic: "INC C",
        description: "Increment C",
        fn: () => {
          this.incrementRegister8(this.registers.c as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x0d: {
        mnemonic: "DEC C",
        description: "Decrement C",
        fn: () => {
          this.decrementRegister8(this.registers.c as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x0e: {
        mnemonic: "LD C, n",
        description: "Loads 8-bit immediate into C.",
        fn: () => {
          this.registers.c.Value = this.mmu.readByte(this.registers.pc.Value++);
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
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
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x10: {
        mnemonic: "STOP",
        description:
          "Stops the system clock. STOP mode is entered, and LCD controller also stops.",
        fn: () => {
          // TODO: We'll have to come back to this one for proper implementation.
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x11: {
        mnemonic: "LD DE, nn",
        description: "Load 16-bit immediate into DE",
        fn: () => {
          this.loadImmediateWordToPair(this.registers.de as CPURegisterPair);
          this.clock.mCycles.Value += 3;
        },
        mCycles: 3,
      },
      0x12: {
        mnemonic: "LD (DE), A",
        description: "Save A to address (DE).",
        fn: () => {
          this.mmu.writeByte(this.registers.de.Value, this.registers.a.Value);
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x13: {
        mnemonic: "INC DE",
        description: "Increment 16-bit DE",
        fn: () => {
          this.registers.de.Value++;
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x14: {
        mnemonic: "INC D",
        description: "Increment D",
        fn: () => {
          this.incrementRegister8(this.registers.d as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x15: {
        mnemonic: "DEC D",
        description: "Decrement D",
        fn: () => {
          this.decrementRegister8(this.registers.d as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x16: {
        mnemonic: "LD D, n",
        description: "Load 8-bit immediate into register D.",
        fn: () => {
          this.registers.d.Value = this.mmu.readByte(this.registers.pc.Value++);
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
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

          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x18: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x19: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x1a: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x1b: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x1c: {
        mnemonic: "INC E",
        description: "Increment E",
        fn: () => {
          this.incrementRegister8(this.registers.e as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x1d: {
        mnemonic: "DEC E",
        description: "Decrement E",
        fn: () => {
          this.decrementRegister8(this.registers.e as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x1e: {
        mnemonic: "LD E, n",
        description: "Load 8-bit immediate into register E.",
        fn: () => {
          this.registers.e.Value = this.mmu.readByte(this.registers.pc.Value++);
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x1f: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x20: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x21: {
        mnemonic: "LD HL,nn",
        description: "Load 16-bit immediate into HL",
        fn: () => {
          this.loadImmediateWordToPair(this.registers.hl as CPURegisterPair);
          this.clock.mCycles.Value += 3;
        },
        mCycles: 3,
      },
      0x22: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x23: {
        mnemonic: "INC HL",
        description: "Increment 16-bit HL",
        fn: () => {
          this.registers.HL.Value++;
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x24: {
        mnemonic: "INC H",
        description: "Increment H",
        fn: () => {
          this.incrementRegister8(this.registers.h as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x25: {
        mnemonic: "DEC H",
        description: "Decrement H",
        fn: () => {
          this.decrementRegister8(this.registers.h as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x26: {
        mnemonic: "LD H, n",
        description: "Load 8-bit immediate into register H.",
        fn: () => {
          this.registers.h.Value = this.mmu.readByte(this.registers.pc.Value++);
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x27: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x28: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x29: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x2a: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x2b: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x2c: {
        mnemonic: "INC L",
        description: "Increment L",
        fn: () => {
          this.incrementRegister8(this.registers.l as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x2d: {
        mnemonic: "DEC L",
        description: "Decrement L",
        fn: () => {
          this.decrementRegister8(this.registers.l as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x2e: {
        mnemonic: "LD L, n",
        description: "Load 8-bit immediate into register L.",
        fn: () => {
          this.registers.l.Value = this.mmu.readByte(this.registers.pc.Value++);
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x2f: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x30: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x31: {
        mnemonic: "LD SP,nn",
        description: "Load 16-bit immediate into SP",
        fn: () => {
          this.loadImmediateWordToPair(this.registers.sp as CPURegisterPair);
          this.clock.mCycles.Value += 3;
        },
        mCycles: 3,
      },
      0x32: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x33: {
        mnemonic: "INC SP",
        description: "Increment 16-bit SP",
        fn: () => {
          this.registers.sp.Value++;
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x34: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x35: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x36: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x37: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x38: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x39: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x3a: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x3b: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x3c: {
        mnemonic: "INC A",
        description: "Increment A",
        fn: () => {
          this.incrementRegister8(this.registers.a as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x3d: {
        mnemonic: "DEC A",
        description: "Decrement A",
        fn: () => {
          this.decrementRegister8(this.registers.a as CPURegister8);
          this.clock.mCycles.Value += 1;
        },
        mCycles: 1,
      },
      0x3e: {
        mnemonic: "LD A, n",
        description: "Load 8-bit immediate into register A.",
        fn: () => {
          this.registers.a.Value = this.mmu.readByte(this.registers.pc.Value++);
          this.clock.mCycles.Value += 2;
        },
        mCycles: 2,
      },
      0x3f: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x40: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x41: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x42: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x43: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x44: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x45: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x46: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x47: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x48: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x49: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x4a: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x4b: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x4c: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x4d: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x4e: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x4f: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x50: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x51: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x52: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x53: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x54: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x55: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x56: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x57: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x58: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x59: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x5a: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x5b: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x5c: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x5d: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x5e: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x5f: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x60: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x61: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x62: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x63: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x64: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x65: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x66: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x67: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x68: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x69: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x6a: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x6b: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x6c: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x6d: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x6e: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x6f: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x70: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x71: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x72: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x73: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x74: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x75: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x76: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x77: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x78: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x79: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x7a: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x7b: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x7c: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x7d: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x7e: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x7f: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x80: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x81: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x82: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x83: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x84: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x85: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x86: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x87: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x88: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x89: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x8a: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x8b: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x8c: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x8d: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x8e: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x8f: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x90: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x91: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x92: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x93: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x94: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x95: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x96: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x97: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x98: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x99: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x9a: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x9b: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x9c: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x9d: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x9e: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0x9f: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xa0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xa1: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xa2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xa3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xa4: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xa5: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xa6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xa7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xa8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xa9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xaa: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xab: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xac: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xad: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xae: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xaf: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xb0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xb1: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xb2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xb3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xb4: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xb5: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xb6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xb7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xb8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xb9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xba: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xbb: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xbc: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xbd: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xbe: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xbf: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xc0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xc1: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xc2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xc3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xc4: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xc5: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xc6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xc7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xc8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xc9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xca: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xcb: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xcc: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xcd: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xce: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xcf: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xd0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xd1: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xd2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xd3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xd4: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xd5: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xd6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xd7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xd8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xd9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xda: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xdb: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xdc: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xdd: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xde: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xdf: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xe0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xe1: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xe2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xe3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xe4: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xe5: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xe6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xe7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xe8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xe9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xea: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xeb: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xec: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xed: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xee: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xef: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xf0: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xf1: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xf2: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xf3: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xf4: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xf5: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xf6: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xf7: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xf8: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xf9: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xfa: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xfb: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xfc: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xfd: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xfe: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
      0xff: {
        mnemonic: "",
        description: "",
        fn: () => {
          throw new Error("Instruction not implemented.");
        },
        mCycles: NaN,
      },
    };

    this.cbOperations = {};
  }

  /**
   * Resets the CPU.
   */
  private reset() {
    for (const k of Object.keys(this.registers)) {
      this.registers[k].Value = 0;
    }
    this.clock.mCycles.Value = 0;
    this.clock.tCycles.Value = 0;
  }

  /**
   * Fetches the next byte and increments the program counter.
   */
  private fetch(): number {
    return this.mmu.readByte(this.registers.pc.Value++);
  }

  /**
   * Decodes an opcode and returns an operation.
   */
  private decode(byte: number): IOperation {
    if (byte !== 0xcb) {
      return this.operations[byte];
    } else {
      return this.cbOperations[this.fetch()];
    }
  }

  private execute() {
    throw new Error("execute() is not implemented.");
  }

  /**
   * Flag Getters and Setters
   * for convenience
   */

  private get ZeroFlag(): boolean {
    return !!(this.registers.f.Value & 0x80);
  }

  private set ZeroFlag(val: boolean) {
    if (val) {
      this.registers.f.Value |= 0x80;
    } else {
      this.registers.f.Value &= 0x7f;
    }
  }

  private get SubtractFlag(): boolean {
    return !!(this.registers.f.Value & 0x40);
  }

  private set SubtractFlag(val: boolean) {
    if (val) {
      this.registers.f.Value |= 0x40;
    } else {
      this.registers.f.Value &= 0xbf;
    }
  }

  private get HalfCarryFlag(): boolean {
    return !!(this.registers.f.Value & 0x20);
  }

  private set HalfCarryFlag(val: boolean) {
    if (val) {
      this.registers.f.Value |= 0x20;
    } else {
      this.registers.f.Value &= 0xdf;
    }
  }

  private get CarryFlag(): boolean {
    return !!(this.registers.f.Value & 0x10);
  }

  private set CarryFlag(val: boolean) {
    if (val) {
      this.registers.f.Value |= 0x10;
    } else {
      this.registers.f.Value &= 0xef;
    }
  }

  /**
   * CPU operations that can be reused.
   */

  /**
   * LD dd, nn
   * Loads 2 bytes of immediate data to register pair dd.
   *
   * Opcodes: 0x01, 0x11, 0x21, 0x31
   */
  private loadImmediateWordToPair(pair: CPURegisterPair) {
    pair.Value = this.mmu.readWord(this.registers.pc.Value);
    this.registers.pc.Value += 2;
  }

  /**
   * INC r
   * Increments the contents of register r by 1.
   *
   * Opcodes: 0x04, 0x14, 0x24, 0x0C, 0x1C, 0x2C, 0x3C
   */
  private incrementRegister8(register: CPURegister8) {
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
  private decrementRegister8(register: CPURegister8) {
    // Similar to INC, except flip the logic to work for subtraction.
    // This way, we know if bit at index 3 borrowed from bit at index 4.
    this.HalfCarryFlag = (register.Value-- & 0xf) - 1 < 0;
    this.SubtractFlag = true;
    this.ZeroFlag = register.Value ? false : true;
  }
}

/**
 * Interfaces
 */

interface IRegisterSet {
  [index: string]: CPURegister;
}

interface IOperationMap {
  [index: number]: IOperation;
}

interface IOperation {
  mnemonic: string;
  description: string;
  fn: () => void;
  mCycles: number;
}
