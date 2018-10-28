export default abstract class CPURegister {
  protected abstract value: number;

  abstract get Value(): number;

  abstract set Value(n: number);
}
