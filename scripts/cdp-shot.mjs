// Captures pilotées par le protocole DevTools (Chrome sans interface) : vraie
// attente, défilement, survol, glisser, mobile. Sert à vérifier le rendu WebGL.
//   1. lancer Chrome : chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<dossier temporaire> --enable-gpu --ignore-gpu-blocklist
//   2. node scripts/cdp-shot.mjs 9333 <dossier de sortie> <jobs.json>
// jobs.json : [{ "name", "url", "w", "h", "mobile"?, "scale"?, "wait"?, "steps"?: [{ "eval" | "move" | "click" | "drag", "wait"? }] }]
import { readFile, writeFile } from 'node:fs/promises';
const [port, out, jobsFile] = process.argv.slice(2);
const jobs = JSON.parse(await readFile(jobsFile, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
	const m = JSON.parse(e.data);
	if (m.id && pending.has(m.id)) {
		pending.get(m.id)(m);
		pending.delete(m.id);
	}
};
const send = (method, params = {}) =>
	new Promise((r) => {
		const i = ++id;
		pending.set(i, r);
		ws.send(JSON.stringify({ id: i, method, params }));
	});
await send('Page.enable');
for (const job of jobs) {
	const { w, h, mobile = false, scale = 1 } = job;
	await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile });
	await send('Page.navigate', { url: job.url });
	await sleep(job.wait ?? 6000);
	for (const step of job.steps ?? []) {
		if (step.drag) {
			const [x0, y0, x1, y1] = step.drag;
			await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
			for (let k = 1; k <= 20; k++) {
				await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + ((x1 - x0) * k) / 20, y: y0 + ((y1 - y0) * k) / 20, button: 'left', buttons: 1 });
				await sleep(16);
			}
			await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
		}
		if (step.move) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: step.move[0], y: step.move[1] });
		if (step.click) {
			await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: step.click[0], y: step.click[1], button: 'left', clickCount: 1 });
			await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: step.click[0], y: step.click[1], button: 'left', clickCount: 1 });
		}
		if (step.eval) await send('Runtime.evaluate', { expression: step.eval, awaitPromise: true });
		await sleep(step.wait ?? 800);
	}
	const shot = await send('Page.captureScreenshot', { format: 'png' });
	await writeFile(`${out}/${job.name}.png`, Buffer.from(shot.result.data, 'base64'));
	console.log('ok', job.name);
}
ws.close();
