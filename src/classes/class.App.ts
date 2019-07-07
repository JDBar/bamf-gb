export default class App {
	constructor() {
		window.addEventListener("resize", this.resizeCanvas);
	}

	/**
	 * Resizes the renderer proportionally to it's parent container.
	 */
	public resizeCanvas() {
		const canvas = document.getElementById("bamf-gb-canvas");
		const ratio = 10 / 9;
		if (canvas) {
			const parent = canvas.parentElement;
			if (parent) {
				canvas.style.maxWidth =
					parent.offsetWidth <= parent.offsetHeight * ratio
						? `${parent.offsetWidth}px`
						: `${parent.offsetHeight * ratio}px`;
				canvas.style.maxHeight =
					parent.offsetHeight <= parent.offsetWidth / ratio
						? `${parent.offsetHeight}px`
						: `${parent.offsetWidth / ratio}px`;
			}
		}
	}
}
