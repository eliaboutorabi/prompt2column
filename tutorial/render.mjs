// Renders the tutorial.
//
//   node tutorial/render.mjs --rehearse            low resolution, estimated timing, stills at every cue
//   node tutorial/render.mjs --rehearse --voice    low resolution, real narration
//   node tutorial/render.mjs --final               4K, real narration, mixed and captioned
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Recorder } from './engine.mjs';
import { narrate } from './narration.mjs';
import { BASE, build, serve } from './server.mjs';
import { SEGMENTS, captionText } from './story.mjs';

const args = new Set(process.argv.slice(2));
const FINAL = args.has('--final');
const VOICED = FINAL || args.has('--voice');
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const NAME = FINAL ? 'prompt2column-tutorial' : 'rehearsal';
mkdirSync(`${OUT}stills`, { recursive: true });

const LEAD = 1.3; // silence before the first word
const PAUSE = 0.5; // between segments unless a segment asks for more
const TAIL = 2.6; // after the last word, before the fade

/**
 * Surgical fixes for single syllables in a particular take: [from, to, dB]. The
 * "I'll pick" in this take of the rows line pops about 6 dB above anything else.
 */
const DIPS = {
	'27-firstfew-a278facecf.mp3': [[7.4, 7.58, -9]]
};

const fmt = (t) => {
	const m = Math.floor(t / 60);
	const s = Math.floor(t % 60);
	return `${m}:${String(s).padStart(2, '0')}`;
};

// 1. Narration timing, and the segment start times it implies.
const voice = await narrate(SEGMENTS, VOICED ? 'voice' : 'estimate');
let clock = LEAD;
const timeline = SEGMENTS.map((segment, index) => {
	if (index > 0) clock += segment.pause ?? PAUSE;
	const start = clock;
	clock += voice[index].duration;
	return { ...segment, start, end: clock, voice: voice[index] };
});
const total = clock + TAIL;

/** When a phrase starts being spoken, in video time. */
function phraseTime(segment, phrase) {
	const spoken = segment.voice.chars.map((c) => c.ch).join('');
	const index = spoken.toLowerCase().indexOf(phrase.toLowerCase());
	if (index < 0) throw new Error(`"${phrase}" is not in segment ${segment.id}`);
	return segment.start + segment.voice.chars[index].start;
}

// 2. Turn cues into timed events on the recorder.
const recorder = new Recorder({
	base: BASE,
	fps: 30,
	dpr: FINAL ? 3840 / 1810 : 1,
	out: `${OUT}${NAME}-video.mp4`,
	preset: FINAL ? 'slow' : 'veryfast',
	crf: FINAL ? 15 : 23,
	total,
	log: args.has('--quiet') ? undefined : (line) => console.log(line)
});

const CLICK_LEAD = 0.12;
const stills = [];
for (const segment of timeline) {
	for (const cue of segment.cues) {
		const at = phraseTime(segment, cue.at) + (cue.action.delay ?? 0);
		const action = cue.action;
		const label = `${segment.id}: ${action.kind} ${action.target?.name ?? action.text ?? action.combo ?? action.name ?? ''}`;
		if (action.kind === 'glide' || action.kind === 'click') {
			const arrive = action.kind === 'click' ? at - CLICK_LEAD : at;
			const dur = action.dur ?? 0.7;
			scheduleGlide(action.target, arrive, dur, label);
			if (action.kind === 'click') {
				recorder.at(at, `${label} (press)`, (r) => r.press({ x: r.view.x, y: r.view.y }));
				recorder.at(at + 0.09, `${label} (release)`, (r) => r.release());
			}
			stills.push({
				t: at + 0.4,
				path: `${OUT}stills/${fmt(at).replace(':', 'm')}s-${segment.id}-${(action.target.name ?? 'point').replace(/[^a-z0-9]+/gi, '-')}.png`
			});
		} else if (action.kind === 'type') {
			const cps = action.cps ?? 12;
			let t = at;
			for (const ch of action.text) {
				recorder.at(t, `${label} '${ch}'`, (r) => r.page.keyboard.type(ch));
				t += (1 / cps) * (0.75 + recorder.random() * 0.5);
			}
		} else if (action.kind === 'key') {
			recorder.at(at, label, async (r) => {
				await r.page.keyboard.press(action.combo);
				// Closing a menu leaves its button focused; let go of it, as clicking elsewhere would.
				if (action.blur) await r.page.evaluate(() => document.activeElement?.blur());
			});
		} else if (action.kind === 'card') {
			recorder.at(at, label, (r) => {
				r.view.card = {
					name: action.name,
					role: action.role,
					side: action.side ?? 'left',
					in: at + action.show,
					out: at + action.hide
				};
			});
		}
	}
}

/** Starts a glide `dur` before it should arrive, finding the target then (and retrying briefly if it isn't up yet). */
function scheduleGlide(target, arrive, dur, label, attempt = 0) {
	const begin = Math.max(0, arrive - dur) + attempt / recorder.fps;
	recorder.at(begin, `${label} (glide)`, async (r) => {
		let point;
		try {
			point = await r.locate(target);
		} catch (error) {
			if (attempt < 24) return scheduleGlide(target, arrive, dur, label, attempt + 1);
			console.log(`! skipped: ${label}: ${error.message}`);
			return;
		}
		r.glideTo(point, Math.max(arrive, r.t + 0.15), Math.max(0.15, arrive - r.t));
	});
}

recorder.stills = VOICED && !args.has('--stills') ? [] : stills;

// 3. Record (skipped with --mix-only, which redoes just the sound and captions).
if (!args.has('--mix-only')) {
	build();
	const stop = await serve();
	await recorder.start();
	const started = Date.now();
	await recorder.run(total, (t, all, elapsed) =>
		console.log(
			`  ${fmt(t)} / ${fmt(all)}  (${Math.round(elapsed)}s, ${(t / elapsed).toFixed(2)}x)`
		)
	);
	stop();
	console.log(`video ${fmt(total)} rendered in ${Math.round((Date.now() - started) / 1000)}s`);
}

// 4. Chapters and captions from the narration timing.
const chapters = timeline
	.filter((segment) => segment.chapter)
	.map((segment, i) => `${i === 0 ? '0:00' : fmt(segment.start - 0.4)} ${segment.chapter}`);
writeFileSync(`${OUT}${NAME}-chapters.txt`, chapters.join('\n') + '\n');

const srtTime = (t) => {
	const ms = Math.max(0, Math.round(t * 1000));
	const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
	const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
	const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
	return `${h}:${m}:${s},${String(ms % 1000).padStart(3, '0')}`;
};
const cues = [];
for (const segment of timeline) {
	// Words with their times.
	const chars = segment.voice.chars;
	let words = [];
	let current = null;
	chars.forEach((c, i) => {
		if (/\s/.test(c.ch)) {
			if (current) words.push(current);
			current = null;
			return;
		}
		current ??= { text: '', start: segment.start + c.start, end: 0 };
		current.text += c.ch;
		current.end = segment.start + chars[i].end;
	});
	if (current) words.push(current);
	// Spoken spellings back to written ones, before any line breaks can split them.
	const merged = [];
	for (let i = 0; i < words.length; i++) {
		const [a, b, c] = [words[i], words[i + 1], words[i + 2]];
		if (/^prompt$/i.test(a.text) && b?.text === 'to' && /^column\W*$/.test(c?.text ?? '')) {
			merged.push({ text: `prompt2column${c.text.slice(6)}`, start: a.start, end: c.end });
			i += 2;
		} else if (a.text === 'Svelte' && /^Kit\W*$/.test(b?.text ?? '')) {
			merged.push({ text: `SvelteKit${b.text.slice(3)}`, start: a.start, end: b.end });
			i += 1;
		} else merged.push(a);
	}
	words = merged;
	// Sentences, then each sentence into balanced lines of up to ~42 characters.
	const sentences = [];
	let sentence = [];
	for (const word of words) {
		sentence.push(word);
		if (/[.?!]$/.test(word.text)) {
			sentences.push(sentence);
			sentence = [];
		}
	}
	if (sentence.length) sentences.push(sentence);
	for (const words of sentences) {
		const length = words.map((w) => w.text).join(' ').length;
		const lines = Math.ceil(length / 42);
		const target = length / lines;
		let line = [];
		for (const word of words) {
			const next = [...line, word].map((w) => w.text).join(' ').length;
			const breakAfterComma =
				line.length && /[,:;]$/.test(line[line.length - 1].text) && next > target * 0.7;
			if (line.length && (next > target + 8 || breakAfterComma)) {
				cues.push(line);
				line = [];
			}
			line.push(word);
		}
		if (line.length) cues.push(line);
	}
}
const captions = cues.map((line, i) => {
	const start = line[0].start;
	const next = cues[i + 1]?.[0].start ?? Infinity;
	const end = Math.min(Math.max(line[line.length - 1].end + 0.25, start + 0.9), next - 0.04);
	return { start, end, text: line.map((w) => w.text).join(' ') };
});
writeFileSync(
	`${OUT}${NAME}.srt`,
	captions
		.map((cue, i) => `${i + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`)
		.join('\n')
);
writeFileSync(
	`${OUT}${NAME}-transcript.md`,
	timeline
		.map(
			(segment) =>
				`${segment.chapter ? `\n## ${segment.chapter}\n\n` : ''}**[${fmt(segment.start)}]** ${captionText(segment.text)}\n`
		)
		.join('\n')
);

// 5. Narration track: every segment at its start time, levelled for YouTube, then muxed with fades.
if (VOICED) {
	const inputs = timeline.flatMap((segment) => ['-i', segment.voice.audio]);
	// Each line: rumble, pops and room tone eased down (the voice is quiet, so levelling lifts them all),
	// soft edges so it starts and stops cleanly, then placed at its start time.
	const delays = timeline
		.map((segment, i) => {
			const d = segment.voice.duration;
			// A steep cut below 110 Hz takes out plosive thumps ("p" sounds) without touching the voice itself.
			const dips = (DIPS[segment.voice.audio.split('/').pop()] ?? [])
				.map(([from, to, db]) => {
					const depth = 1 - 10 ** (db / 20);
					return `,asetnsamples=n=64,volume='1-${depth.toFixed(3)}*between(t,${from},${to})*(0.5-0.5*cos(2*PI*(t-${from})/${(to - from).toFixed(3)}))':eval=frame`;
				})
				.join('');
			return `[${i}:a]highpass=f=110:p=2,highpass=f=110:p=2${dips},afftdn=nr=12:nf=-55:tn=1,afade=t=in:d=0.015,afade=t=out:st=${(d - 0.03).toFixed(3)}:d=0.03,adelay=${Math.round(segment.start * 1000)}:all=1[a${i}]`;
		})
		.join(';');
	// A gentle compressor evens out the voice's wide swings before the level is set.
	const mix = `${delays};${timeline.map((_, i) => `[a${i}]`).join('')}amix=inputs=${timeline.length}:normalize=0,acompressor=threshold=0.03:ratio=3:attack=5:release=150:knee=4,apad=whole_dur=${total.toFixed(3)},aresample=48000[out]`;
	const raw = `${OUT}${NAME}-narration-raw.wav`;
	run('ffmpeg', [
		'-y',
		'-loglevel',
		'error',
		...inputs,
		'-filter_complex',
		mix,
		'-map',
		'[out]',
		'-t',
		total.toFixed(3),
		'-c:a',
		'pcm_s24le',
		raw
	]);
	// Lift the (quiet) voice to YouTube's -14 LUFS with one fixed gain, and let a limiter
	// catch the few peaks that would clip, so nothing pumps in the pauses.
	const measure = spawnSync(
		'ffmpeg',
		['-hide_banner', '-i', raw, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'],
		{ encoding: 'utf8' }
	);
	const loudness = Number(
		measure.stderr
			.match(/I:\s+(-?[\d.]+) LUFS/g)
			.pop()
			.match(/-?[\d.]+/)[0]
	);
	const gain = (-14 - loudness).toFixed(2);
	run('ffmpeg', [
		'-y',
		'-loglevel',
		'error',
		'-i',
		raw,
		'-af',
		`volume=${gain}dB,alimiter=limit=0.79:attack=2:release=80:level=false,aresample=48000,pan=stereo|c0=0.7071*c0|c1=0.7071*c0`,
		'-c:a',
		'pcm_s16le',
		`${OUT}${NAME}-narration.wav`
	]);
	console.log(`narration levelled from ${loudness} LUFS by ${gain} dB`);
	run('ffmpeg', [
		'-y',
		'-loglevel',
		'error',
		'-i',
		`${OUT}${NAME}-video.mp4`,
		'-i',
		`${OUT}${NAME}-narration.wav`,
		'-map',
		'0:v',
		'-map',
		'1:a',
		'-c:v',
		'copy',
		'-af',
		`afade=t=in:st=0:d=0.4,afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2`,
		'-c:a',
		'aac',
		'-b:a',
		'256k',
		'-movflags',
		'+faststart',
		`${OUT}${NAME}.mp4`
	]);
	console.log(`wrote ${OUT}${NAME}.mp4`);
}

function run(command, list) {
	const result = spawnSync(command, list, { stdio: 'inherit' });
	if (result.status !== 0) throw new Error(`${command} failed`);
}
