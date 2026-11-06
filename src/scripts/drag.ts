// Déplacer une fenêtre de l'OS par sa barre de titre.
// `bounds` : la fenêtre reste dans cet élément (sinon libre).
export function makeDraggable(win: HTMLElement, bounds?: HTMLElement) {
	const handle = win.querySelector<HTMLElement>('[data-drag-handle]');
	if (!handle) return { reset() {} };
	let offset = { x: 0, y: 0 };

	handle.addEventListener('pointerdown', (e) => {
		if ((e.target as HTMLElement).closest('button, a')) return;
		e.preventDefault();
		const start = { x: e.clientX - offset.x, y: e.clientY - offset.y };
		const base = win.getBoundingClientRect();
		const area = bounds?.getBoundingClientRect();
		handle.setPointerCapture(e.pointerId);
		win.dataset.dragging = '';

		const move = (ev: PointerEvent) => {
			let x = ev.clientX - start.x;
			let y = ev.clientY - start.y;
			if (area) {
				const left = base.left - offset.x;
				const top = base.top - offset.y;
				x = Math.min(Math.max(x, area.left - left + 8), area.right - left - base.width - 8);
				y = Math.min(Math.max(y, area.top - top + 8), area.bottom - top - base.height - 8);
			}
			offset = { x, y };
			win.style.translate = `${x}px ${y}px`;
		};
		const up = () => {
			delete win.dataset.dragging;
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			handle.removeEventListener('pointercancel', up);
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', up);
		handle.addEventListener('pointercancel', up);
	});

	return {
		reset() {
			offset = { x: 0, y: 0 };
			win.style.translate = '';
		},
	};
}
