import CPURegister16 from "./class.CPURegister16";
import CPURegister8 from "./class.CPURegister8";

/**
 * A pair of two 8-bit CPU registers which acts as a 16-bit CPU register.
 * The high register acts as the 8 high bits and the
 * low register acts as the 8 low bits.
 */
export default class CPURegisterPair extends CPURegister16 {
	protected value: number;

	/**
	 * The register to store the 8 high bits.
	 */
	private high: CPURegister8;

	/**
	 * The register to store the 8 low bits.
	 */
	private low: CPURegister8;

	constructor(high: CPURegister8, low: CPURegister8) {
		super();
		this.value = 0;
		this.high = high;
		this.low = low;
	}

	get Value(): number {
		this.value = ((this.high.Value << 8) | this.low.Value) & 0xffff;
		return this.value;
	}

	set Value(n: number) {
		this.value = n & 0xffff;
		this.high.Value = (n & 0xff00) >> 8;
		this.low.Value = n & 0xff;
	}
}
