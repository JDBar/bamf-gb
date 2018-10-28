export default abstract class Z80Register {
  protected abstract value: number;

  abstract get Value(): number;

  abstract set Value(n: number);
}
