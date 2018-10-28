import CPURegister from "./class.CPURegister";

export default class CPURegister16 extends CPURegister {
  protected value: number;

  constructor() {
    super();
    this.value = 0;
  }

  get Value(): number {
    return this.value & 0xffff;
  }

  set Value(n: number) {
    this.value = n & 0xffff;
  }
}
