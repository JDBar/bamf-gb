import CPURegister16 from "./class.CPURegister16";
import CPURegister8 from "./class.CPURegister8";

/**
 * The CPU.
 */
export default class CPU {
  private clock: IClock;
  private registers: IRegisterSet;

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
  }

  private fetch() {
    throw new Error("fetch() is not implemented.");
  }

  private decode() {
    throw new Error("decode() is not implemented.");
  }

  private execute() {
    throw new Error("execute() is not implemented.");
  }
}

/**
 * Interfaces
 */
interface IClock {
  m: CPURegister8;
  t: CPURegister8;
}

interface IRegisterSet {
  a: CPURegister8;
  b: CPURegister8;
  c: CPURegister8;
  d: CPURegister8;
  e: CPURegister8;
  f: CPURegister8;
  h: CPURegister8;
  l: CPURegister8;
  m: CPURegister8;
  pc: CPURegister16;
  sp: CPURegister16;
  t: CPURegister8;
}
