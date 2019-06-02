import CPURegister16 from "./class.CPURegister16";
import CPURegister8 from "./class.CPURegister8";
import CPURegisterPair from "./class.CPURegisterPair";

/**
 * The set of registers on the CPU.
 * A register can hold 8 or 16 bits (1-2 bytes).
 */
export default class CPURegisterSet implements ICPURegisterSet {
  public readonly a: CPURegister8;
  public readonly b: CPURegister8;
  public readonly c: CPURegister8;
  public readonly d: CPURegister8;
  public readonly e: CPURegister8;
  public readonly f: CPURegister8;
  public readonly h: CPURegister8;
  public readonly l: CPURegister8;
  public readonly pc: CPURegister16;
  public readonly sp: CPURegister16;
  public readonly af: CPURegisterPair;
  public readonly bc: CPURegisterPair;
  public readonly de: CPURegisterPair;
  public readonly hl: CPURegisterPair;

  constructor() {
    /**
     * Accumulator register for storing data and results of
     * arithmetic and logical operations.
     */
    this.a = new CPURegister8();

    /**
     * Auxillary registers B, C, D, E, F, H and L.
     * These serve as auxillary registers to the accumulator. As register
     * pairs, (AF, BC, DE, HL) they are 16-bit registers that function as data pointers.
     */
    this.b = new CPURegister8();
    this.c = new CPURegister8();
    this.d = new CPURegister8();
    this.e = new CPURegister8();
    /**
     * Flags register (bits: ZNHCxxxx)
     * Z: Zero Flag
     * N : Subtract Flag
     * H: Half Carry Flag
     * C: Carry Flag
     */
    this.f = new CPURegister8();
    this.h = new CPURegister8();
    this.l = new CPURegister8();
    this.pc = new CPURegister16(); // Program counter.
    this.sp = new CPURegister16(); // Stack pointer.

    /**
     * Set up register pairs for convenience. These are useful
     * for instructions which treat two 8-bit registers as a single
     * 16-bit register. (e.g. opcode 0x01)
     */
    this.af = new CPURegisterPair(this.a, this.f);
    this.bc = new CPURegisterPair(this.b, this.c);
    this.de = new CPURegisterPair(this.d, this.e);
    this.hl = new CPURegisterPair(this.h, this.l);
  }
}

/**
 * Interfaces
 */
export interface ICPURegisterSet {
  a: CPURegister8;
  b: CPURegister8;
  c: CPURegister8;
  d: CPURegister8;
  e: CPURegister8;
  f: CPURegister8;
  h: CPURegister8;
  l: CPURegister8;
  pc: CPURegister16;
  sp: CPURegister16;
  af: CPURegisterPair;
  bc: CPURegisterPair;
  de: CPURegisterPair;
  hl: CPURegisterPair;
}
