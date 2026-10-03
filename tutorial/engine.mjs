// The recording engine: drives the app on a timeline, one video frame at a
// time, with the page's clock, animations and network all held to video time.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// A 1920x1080 screen zoomed to about 106%: big, readable text, and room for every sample's columns.
export const VIEW = { width: 1810, height: 1018 };
const OVERLAY = fileURLToPath(new URL('./overlay.js', import.meta.url));
const REPLIES = JSON.parse(readFileSync(new URL('./fixtures/replies.json', import.meta.url)));
const TAGS = JSON.parse(readFileSync(new URL('./fixtures/tags.json', import.meta.url)));

/** A small seeded random source, so every render moves and types the same way. */
function seeded(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10));

export class Recorder {
	constructor({
		base,
		fps = 30,
		dpr = 2.2,
		out,
		preset = 'slow',
		crf = 15,
		stills = [],
		total,
		log
	}) {
		this.total = total;
		this.base = base;
		this.fps = fps;
		this.dpr = dpr;
		this.out = out;
		this.preset = preset;
		this.crf = crf;
		this.stills = stills; // [{ t, path }]
		this.log = log ?? (() => {});
		this.t = 0;
		this.frameIndex = 0;
		this.events = []; // { t, run, label }
		this.waiters = []; // { t, resolve }
		this.view = { x: 1180, y: 560, pressed: false, hidden: false, rings: [], card: null };
		this.motion = null; // { t0, t1, from, to, bend }
		this.random = seeded(7);
		this.forceFrames = 0;
	}

	async start() {
		this.browser = await chromium.launch();
		this.context = await this.browser.newContext({
			viewport: VIEW,
			deviceScaleFactor: this.dpr,
			colorScheme: 'dark',
			locale: 'en-US',
			timezoneId: 'America/Chicago',
			acceptDownloads: true
		});
		const start = new Date('2026-10-03T10:14:00-05:00');
		await this.context.clock.install({ time: start });
		await this.context.clock.pauseAt(new Date(start.getTime() + 1000));
		await this.context.addInitScript({ path: OVERLAY });
		this.page = await this.context.newPage();
		await this.mockOllama();
		this.cdp = await this.context.newCDPSession(this.page);
		await this.cdp.send('Emulation.setDeviceMetricsOverride', {
			...VIEW,
			deviceScaleFactor: this.dpr,
			mobile: false
		});
		await this.page.goto(this.base + '/');
		// Let the app start: its clock only moves when told to.
		for (let i = 0; i < 80; i++) {
			await this.page.clock.runFor(50);
			if (await this.page.locator('h1.headline').isVisible()) break;
		}
		await this.page.evaluate(() => document.fonts.ready);
		await this.page.mouse.move(this.view.x, this.view.y);
	}

	/** Opened on the first frame, sized from it: even dimensions for yuv420p (3841 becomes 3840). */
	openEncoder(width, height) {
		const fades = this.total
			? `,fade=t=in:st=0:d=0.5,fade=t=out:st=${(this.total - 0.9).toFixed(2)}:d=0.9`
			: '';
		const args = [
			'-y',
			'-loglevel',
			'error',
			'-f',
			'image2pipe',
			'-framerate',
			String(this.fps),
			'-c:v',
			'png',
			'-i',
			'-',
			'-vf',
			`crop=${width}:${height}:0:0,scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p${fades}`,
			'-c:v',
			'libx264',
			'-preset',
			this.preset,
			'-crf',
			String(this.crf),
			'-colorspace',
			'bt709',
			'-color_primaries',
			'bt709',
			'-color_trc',
			'bt709',
			'-movflags',
			'+faststart',
			this.out
		];
		const child = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
		this.encoderDone = new Promise((resolve, reject) =>
			child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))))
		);
		return child;
	}

	/** Ollama answers with the model's recorded replies, each after its recorded latency. */
	async mockOllama() {
		const byPrompt = new Map(REPLIES.map((entry) => [entry.prompt, entry]));
		await this.page.route('**://localhost:11434/api/tags', (route) =>
			route.fulfill({ json: TAGS })
		);
		await this.page.route('**://localhost:11434/api/chat', async (route) => {
			const request = JSON.parse(route.request().postData() ?? '{}');
			const prompt = request.messages?.[1]?.content;
			const entry = byPrompt.get(prompt);
			if (!entry) {
				this.log(`! no recorded reply for prompt: ${String(prompt).slice(0, 80)}`);
				await route.fulfill({ status: 500, json: { error: 'no recorded reply' } });
				return;
			}
			await this.until(this.t + entry.latencyMs / 1000);
			this.forceFrames = Math.max(this.forceFrames, 2);
			await route.fulfill({ json: entry.reply }).catch(() => {});
		});
	}

	/** Resolves once video time reaches t. */
	until(t) {
		if (t <= this.t) return Promise.resolve();
		return new Promise((resolve) => this.waiters.push({ t, resolve }));
	}

	at(t, label, run) {
		this.events.push({ t, label, run });
	}

	/** Moves the pointer to a point, arriving at time `arrive`. */
	glideTo(point, arrive, dur) {
		const from = this.pointerAt(this.t);
		const distance = Math.hypot(point.x - from.x, point.y - from.y);
		const d = dur ?? Math.min(1.15, Math.max(0.42, 0.34 + distance / 1500));
		const t0 = Math.max(this.t, arrive - d);
		const bend = (this.random() - 0.5) * 0.22;
		this.motion = { t0, t1: Math.max(t0 + 0.05, arrive), from, to: point, bend };
	}

	pointerAt(t) {
		const m = this.motion;
		if (!m) return { x: this.view.x, y: this.view.y };
		const p = smooth((t - m.t0) / (m.t1 - m.t0));
		// A gentle arc rather than a ruler-straight line.
		const mx = (m.from.x + m.to.x) / 2 - (m.to.y - m.from.y) * m.bend;
		const my = (m.from.y + m.to.y) / 2 + (m.to.x - m.from.x) * m.bend;
		const x = (1 - p) * (1 - p) * m.from.x + 2 * (1 - p) * p * mx + p * p * m.to.x;
		const y = (1 - p) * (1 - p) * m.from.y + 2 * (1 - p) * p * my + p * p * m.to.y;
		return { x, y };
	}

	/** Where on screen a target is: a locator's box at an anchor, or a fixed point. */
	async locate(target) {
		if ('x' in target && !target.locator) return { x: target.x, y: target.y };
		const locator = target.locator(this.page).first();
		// A short look, never Playwright's long auto-wait: a missing target is retried next frame.
		const box = await locator.boundingBox({ timeout: 120 }).catch(() => null);
		if (!box) throw new Error(`target not visible: ${target.name ?? locator}`);
		const [fx, fy] = target.anchor ?? [0.5, 0.5];
		return {
			x: box.x + box.width * fx + (target.dx ?? 0),
			y: box.y + box.height * fy + (target.dy ?? 0)
		};
	}

	async frame() {
		const t = this.t;
		// Network replies due by now.
		const due = this.waiters.filter((waiter) => waiter.t <= t + 1e-6);
		this.waiters = this.waiters.filter((waiter) => waiter.t > t + 1e-6);
		for (const waiter of due) waiter.resolve();
		if (due.length) await new Promise((resolve) => setTimeout(resolve, 15));

		// Timeline events due by now, in order.
		let acted = false;
		this.events.sort((a, b) => a.t - b.t);
		while (this.events.length && this.events[0].t <= t + 1e-6) {
			const event = this.events.shift();
			this.log(`${t.toFixed(2)}s ${event.label}`);
			await event.run(this);
			acted = true;
		}
		if (acted) this.forceFrames = Math.max(this.forceFrames, 3);

		// The pointer, and the real mouse under it so hover states follow.
		const point = this.pointerAt(t);
		const moved = Math.abs(point.x - this.view.x) > 0.01 || Math.abs(point.y - this.view.y) > 0.01;
		if (moved) {
			this.view.x = point.x;
			this.view.y = point.y;
			await this.page.mouse.move(point.x, point.y);
		}
		const ringsLive = this.view.rings.some((ring) => t - ring.t < 0.6);
		this.view.rings = this.view.rings.filter((ring) => t - ring.t < 0.6);
		const card = this.view.card;
		const cardLive = card && t > card.in - 0.1 && t < card.out + 0.6;

		await this.page.clock.runFor(
			Math.round(((this.frameIndex + 1) * 1000) / this.fps) -
				Math.round((this.frameIndex * 1000) / this.fps)
		);
		const { dirty } = await this.page.evaluate(
			([time, view]) => window.__tut.frame(time, view),
			[t, this.view]
		);

		const needed =
			!this.last ||
			dirty ||
			acted ||
			moved ||
			ringsLive ||
			cardLive ||
			this.forceFrames > 0 ||
			this.frameIndex % 15 === 0;
		if (needed) {
			const { data } = await this.cdp.send('Page.captureScreenshot', {
				format: 'png',
				optimizeForSpeed: true
			});
			this.last = Buffer.from(data, 'base64');
		}
		if (this.forceFrames > 0) this.forceFrames -= 1;
		for (const still of this.stills) {
			if (still.done || t < still.t) continue;
			writeFileSync(still.path, this.last);
			still.done = true;
		}
		if (!this.ffmpeg) {
			const width = this.last.readUInt32BE(16);
			const height = this.last.readUInt32BE(20);
			this.ffmpeg = this.openEncoder(width - (width % 2), height - (height % 2));
		}
		if (!this.ffmpeg.stdin.write(this.last))
			await new Promise((resolve) => this.ffmpeg.stdin.once('drain', resolve));
		this.frameIndex += 1;
		this.t = this.frameIndex / this.fps;
	}

	async run(duration, onProgress) {
		const total = Math.ceil(duration * this.fps);
		const started = Date.now();
		while (this.frameIndex < total) {
			await this.frame();
			if (this.frameIndex % (this.fps * 10) === 0)
				onProgress?.(this.t, total / this.fps, (Date.now() - started) / 1000);
		}
		this.ffmpeg.stdin.end();
		await this.encoderDone;
		await this.browser.close();
	}

	// Actions, used by the story through the helpers below.

	async press(point) {
		this.view.pressed = true;
		this.view.rings.push({ x: point.x, y: point.y, t: this.t });
		await this.page.mouse.down();
	}

	async release() {
		this.view.pressed = false;
		await this.page.mouse.up();
	}
}
