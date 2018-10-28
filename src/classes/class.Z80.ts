import Z80Register16 from "./class.Z80Register16";
import Z80Register8 from "./class.Z80Register8";

/**
 * The CPU.
 */
export default class Z80 {
  private clock: IClock;
  private registers: IRegisterSet;

  constructor() {
    this.clock = {
      m: new Z80Register8(),
      t: new Z80Register8(),
    };

    this.registers = {
      a: new Z80Register8(),
      b: new Z80Register8(),
      c: new Z80Register8(),
      d: new Z80Register8(),
      e: new Z80Register8(),
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
      f: new Z80Register8(),
      h: new Z80Register8(),
      l: new Z80Register8(),
      m: new Z80Register8(), // Clock for last instr.
      pc: new Z80Register16(), // Program counter.
      sp: new Z80Register16(), // Stack pointer.
      t: new Z80Register8(), // Clock for last instr.
    };
  }
}

/**
 * Interfaces
 */
interface IClock {
  m: Z80Register8;
  t: Z80Register8;
}

interface IRegisterSet {
  a: Z80Register8;
  b: Z80Register8;
  c: Z80Register8;
  d: Z80Register8;
  e: Z80Register8;
  f: Z80Register8;
  h: Z80Register8;
  l: Z80Register8;
  m: Z80Register8;
  pc: Z80Register16;
  sp: Z80Register16;
  t: Z80Register8;
}
