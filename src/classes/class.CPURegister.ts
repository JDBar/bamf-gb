/**
 * A register on the CPU.
 */
export default abstract class CPURegister {
  /**
   * The value of the contents of the register.
   */
  protected abstract value: number;

  abstract get Value(): number;

  abstract set Value(n: number);
}
