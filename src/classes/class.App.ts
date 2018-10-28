export default class App {
  constructor() {
    window.addEventListener("resize", this.resizeCanvas);
  }

  /**
   * Resizes the renderer proportionally to it's parent container.
   */
  public resizeCanvas() {
    const canvas = document.getElementById("bamf-gb-canvas");
    if (canvas) {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.style.maxWidth = `${parent.offsetWidth}px`;
        canvas.style.maxHeight = `${parent.offsetWidth * 0.9}px`;
        console.log(canvas, canvas.style.width);
      }
    }
  }
}
