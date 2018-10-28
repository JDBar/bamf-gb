import Z80Register from "./class.Z80Register";

export default class Z80Register8 extends Z80Register {
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
