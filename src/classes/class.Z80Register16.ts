import Z80Register from "./class.Z80Register";

export default class Z80Register16 extends Z80Register {
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
