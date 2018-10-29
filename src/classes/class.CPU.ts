import CPURegister from "./class.CPURegister";
import CPURegister16 from "./class.CPURegister16";
import CPURegister8 from "./class.CPURegister8";
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

    this.registers = {
      a: new CPURegister8(),
      b: new CPURegister8(),
      c: new CPURegister8(),
      d: new CPURegister8(),
      e: new CPURegister8(),
      /**
       * f: The flags register.
       *
       * "Zero"
       * f & 0x80: Set if the last operation produced a result of 0.
       *
       * "Operation"
       * f & 0x40: Set if the last operation was a subtraction.
       *
       * "Half-Carry"
       * f & 0x20: Set if, in the result of the last operation, the lower half
       *           of the byte overflowed past 15.
       *
       * "Carry"
       * f & 0x10: Set if the last operation produced a result over 255 (for additions)
       *           or under 0 (for subtractions).
       */
      f: new CPURegister8(),
      h: new CPURegister8(),
      l: new CPURegister8(),
      m: new CPURegister8(), // Clock for last instr.
      pc: new CPURegister16(), // Program counter.
      sp: new CPURegister16(), // Stack pointer.
      t: new CPURegister8(), // Clock for last instr.
    };

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
