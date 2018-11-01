import CPURegister from "./class.CPURegister";
import CPURegister16 from "./class.CPURegister16";
import CPURegister8 from "./class.CPURegister8";
import CPURegisterPair from "./class.CPURegisterPair";
import MMU from "./class.MMU";

/**
 * The CPU.
 */
export default class CPU {
  private clock: IRegisterSet;
  private registers: IRegisterSet;
  private mmu: MMU;
  private operations: IOperationMap;

  constructor() {
    this.clock = {
      mCycles: new CPURegister8(),
      tCycles: new CPURegister8(),
    };

    this.registers = {};
    this.registers.a = new CPURegister8();
    this.registers.b = new CPURegister8();
    this.registers.c = new CPURegister8();
    this.registers.d = new CPURegister8();
    this.registers.e = new CPURegister8();
    this.registers.f = new CPURegister8(); // Flags (ZNHCxxxx)
    this.registers.h = new CPURegister8();
    this.registers.l = new CPURegister8();
    this.registers.mCycles = new CPURegister8(); // Clock for last instruction.
    this.registers.cCycles = new CPURegister8(); // Clock for last instruction. (Not sure if this will be used?)
    this.registers.pc = new CPURegister16(); // Program counter.
    this.registers.sp = new CPURegister16(); // Stack pointer.
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

    this.mmu = new MMU();

    this.operations = {
      0x00: {
        mnemonic: "NOP",
        description: "No operation.",
        fn: () => {
          this.registers.mCycles.Value += 1;
        },
      },
      0x01: {
        mnemonic: "LD BC,d16",
        description: "Load 16-bit immediate into BC.",
        fn: () => {
          this.registers.bc.Value = this.mmu.readWord(this.registers.pc.Value);
          this.registers.pc.Value += 2;
          this.registers.mCycles.Value += 3;
        },
      },
      0x02: {
        mnemonic: "LD (BC),A",
        description: "Save A to address pointed by BC.",
        fn: () => {
          this.mmu.writeByte(this.registers.bc.Value, this.registers.a.Value);
          this.registers.mCycles.Value += 2;
        },
      },
      0x03: {
        mnemonic: "INC BC",
        description: "Increment 16-bit BC",
        fn: () => {
          this.registers.bc.Value++;
          this.registers.mCycles.Value += 2;
        },
      },
      0x04: {
        mnemonic: "INC B",
        description: "Increment B",
        fn: () => {
          // When calculating the HalfCarryFlag, check to see if
          // bit at index 3 carries to bit 4 (the least significant bit being index 0).
          // Example: 0b00001111 + 0b00000001 = 0b00010000
          this.HalfCarryFlag = (this.registers.b.Value++ & 0xf) + 1 > 0xf;
          this.SubtractFlag = false;
          this.ZeroFlag = this.registers.b.Value ? false : true;
          this.registers.mCycles.Value += 1;
        },
      },
      0x05: {
        mnemonic: "DEC B",
        description: "Decrement B",
        fn: () => {
          // Similar to INC, except flip the logic to work for subtraction.
          // This way, we know if bit at index 3 borrowed from bit at index 4.
          this.HalfCarryFlag = (this.registers.b.Value-- & 0xf) - 1 < 0;
          this.registers.b.Value--;
          this.SubtractFlag = true;
          this.ZeroFlag = this.registers.b.Value ? false : true;
          this.registers.mCycles.Value += 1;
        },
      },
      0x06: {
        mnemonic: "LD B,d8",
        description: "Load 8-bit immediate into register B.",
        fn: () => {
          this.registers.b.Value = this.mmu.readByte(this.registers.pc.Value++);
          this.registers.mCycles.Value += 2;
        },
      },
      0x07: {
        mnemonic: "RLC A",
        description: "Rotate A with left carry.",
        fn: () => {
          this.HalfCarryFlag = false;
          this.SubtractFlag = false;
          this.ZeroFlag = false;
          this.CarryFlag = (this.registers.a.Value & 0x8) > 0;
          this.registers.a.Value =
            (this.registers.a.Value << 1) + (this.CarryFlag ? 1 : 0);
          this.registers.mCycles.Value += 1;
        },
      },
      0x08: {
        mnemonic: "LD (a16),SP",
        description:
          "Stores the lower byte of SP at address nn and the upper byte of SP at address nn + 1",
        fn: () => {
          const address = this.mmu.readWord(this.registers.pc.Value);
          this.registers.pc.Value += 2;
          this.mmu.writeWord(address, this.registers.sp.Value);
        },
      },
    };
  }

  /**
   * Resets the CPU.
   */
  private reset() {
    for (const k of Object.keys(this.registers)) {
      this.registers[k].Value = 0;
    }
    this.clock.m.Value = 0;
    this.clock.t.Value = 0;
  }

  private fetch(): number {
    return this.mmu.readByte(this.registers.pc.Value++);
  }

  private decode(byte: number): IOperation {
    const result: IOperation | IOperationMap = this.operations[byte];
    // Consider making Operation/OperationMap classes so that
    // this interface member memery is not necessary.
    if ((result as IOperation).hasOwnProperty("fn")) {
      // This is an operation.
      return result as IOperation;
    } else {
      // This is the CB-prefix operation map.
      const nextByte = this.fetch();
      return (result as IOperationMap)[nextByte] as IOperation;
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
}

/**
 * Interfaces
 */

interface IRegisterSet {
  [index: string]: CPURegister;
}

interface IOperationMap {
  [index: number]: IOperation | IOperationMap;
}

interface IOperation {
  description: string;
  mnemonic: string;
  fn: () => void;
}
