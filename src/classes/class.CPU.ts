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
      m: new CPURegister8(),
      t: new CPURegister8(),
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
    this.registers.m = new CPURegister8(); // Clock for last instruciton.
    this.registers.t = new CPURegister8(); // Clock for last instruciton. (Not sure if this will be used?)
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
        cycles: 1,
        fn: () => {
          this.registers.m.Value = 1;
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
  cycles: number;
  mnemonic: string;
  fn: () => void;
}
