import CPURegister from "./class.CPURegister";
import CPURegister8 from "./class.CPURegister8";

export default class CPURegisterPair extends CPURegister {
  protected value: number;
  private high: CPURegister8;
  private low: CPURegister8;

  constructor(high: CPURegister8, low: CPURegister8) {
    super();
    this.value = 0;
    this.high = high;
    this.low = low;
  }

  get Value(): number {
    return this.value;
  }

  set Value(n: number) {
    this.value = n & 0xFFFF;
    this.high.Value = (n & 0xFF00) >> 8;
    this.low.Value = n & 0xFF;
}