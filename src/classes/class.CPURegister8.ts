import CPURegister from "./class.CPURegister";

/**
 * An 8-bit CPU register.
 */
export default class CPURegister8 extends CPURegister {
  protected value: number;

  constructor() {
    super();
    this.value = 0;
  }

  get Value(): number {
    return this.value & 0xff;
  }

  set Value(n: number) {
    this.value = n & 0xff;
  }
}
