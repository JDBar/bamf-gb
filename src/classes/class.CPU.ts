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
          this.registers.m.Value = 1;
          this.registers.mCycles.Value += 1;
        },
      },
      0x01: {
        mnemonic: "LD BC,d16",
        description: "Load 16-bit immediate into BC.",
        fn: () => {
          // GameBoy is little endian, so we have to load the low byte first.
          this.registers.bc.Value =
            this.mmu.readByte(this.registers.pc.Value++) |
            (this.mmu.readByte(this.registers.pc.Value++) << 8);
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
          this.registers.b.Value++;
          this.registers.mCycles.Value += 1;
        },
      },
      0x05: {
        mnemonic: "DEC B",
        description: "Decrement B",
        fn: () => {
          this.registers.b.Value--;
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
