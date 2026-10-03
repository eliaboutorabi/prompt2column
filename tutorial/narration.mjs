// Narration: Ellie's voice from ElevenLabs, with per-character timings so the
// on-screen actions can land on the words. Each segment is cached by its text,
// so a rehearsal never pays for the same line twice.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CACHE = fileURLToPath(new URL('./out/voice/', import.meta.url));
const VOICE_NAME = 'Eli';
const MODEL = 'eleven_multilingual_v2';
const SETTINGS = {
	stability: 0.5,
	similarity_boost: 0.8,
	style: 0,
	use_speaker_boost: true,
	speed: 1
};

function apiKey() {
	const env = readFileSync(`${ROOT}.env`, 'utf8');
	const match = env.match(/^ELEVENLABS_API_KEY=["']?([^"'\r\n]+)/m);
	if (!match) throw new Error('ELEVENLABS_API_KEY is missing from .env');
	return match[1].trim();
}

async function voiceId(key) {
	const response = await fetch('https://api.elevenlabs.io/v1/voices', {
		headers: { 'xi-api-key': key }
	});
	const { voices } = await response.json();
	const voice = voices.find(
		(candidate) => candidate.name.trim().toLowerCase() === VOICE_NAME.toLowerCase()
	);
	if (!voice) throw new Error(`No voice named ${VOICE_NAME}`);
	return voice.voice_id;
}

function duration(path) {
	const probe = spawnSync('ffprobe', [
		'-v',
		'error',
		'-show_entries',
		'format=duration',
		'-of',
		'csv=p=0',
		path
	]);
	return Number(String(probe.stdout).trim());
}

/** A stand-in timing for rehearsals before any audio exists: ~14.5 characters a second. */
function estimate(text) {
	const chars = [];
	let t = 0;
	for (const ch of text) {
		const step = 1 / 14.5 + (/[.?!]/.test(ch) ? 0.32 : /[,:;]/.test(ch) ? 0.14 : 0);
		chars.push({ ch, start: t, end: t + 1 / 14.5 });
		t += step;
	}
	return { chars, duration: t + 0.15 };
}

/**
 * Timing (and audio, when voiced) for every segment.
 * mode "estimate" uses no API; mode "voice" generates or reuses real audio.
 */
export async function narrate(segments, mode) {
	if (mode === 'estimate')
		return segments.map((segment) => ({ id: segment.id, ...estimate(segment.text) }));

	mkdirSync(CACHE, { recursive: true });
	let key = null;
	let voice = null;
	const result = [];
	for (const [index, segment] of segments.entries()) {
		const hash = createHash('sha1')
			.update(JSON.stringify([segment.text, MODEL, SETTINGS, VOICE_NAME]))
			.digest('hex')
			.slice(0, 10);
		const base = `${CACHE}${String(index).padStart(2, '0')}-${segment.id}-${hash}`;
		if (!existsSync(`${base}.json`)) {
			key ??= apiKey();
			voice ??= await voiceId(key);
			const body = {
				text: segment.text,
				model_id: MODEL,
				voice_settings: SETTINGS,
				previous_text: segments[index - 1]?.text,
				next_text: segments[index + 1]?.text,
				seed: 2026
			};
			const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_192`;
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'xi-api-key': key, 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${await response.text()}`);
			const data = await response.json();
			writeFileSync(`${base}.mp3`, Buffer.from(data.audio_base64, 'base64'));
			writeFileSync(`${base}.json`, JSON.stringify(data.alignment));
			console.log(`voiced ${segment.id} (${segment.text.length} characters)`);
		}
		const alignment = JSON.parse(readFileSync(`${base}.json`, 'utf8'));
		const chars = alignment.characters.map((ch, i) => ({
			ch,
			start: alignment.character_start_times_seconds[i],
			end: alignment.character_end_times_seconds[i]
		}));
		result.push({ id: segment.id, chars, duration: duration(`${base}.mp3`), audio: `${base}.mp3` });
	}
	return result;
}
