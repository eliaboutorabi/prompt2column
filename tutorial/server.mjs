// Builds the app once and serves the production build for recording.
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const PORT = 4319;
export const BASE = `http://localhost:${PORT}`;

export function build() {
	const result = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
	if (result.status !== 0) throw new Error('Build failed');
}

/** Starts `vite preview` and resolves once it answers; returns a stop function. */
export async function serve() {
	const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
		cwd: ROOT,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	child.stderr.on('data', (chunk) => process.stderr.write(chunk));
	for (let i = 0; i < 100; i++) {
		try {
			const response = await fetch(BASE);
			if (response.ok) break;
		} catch {
			// not up yet
		}
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	return () => child.kill('SIGTERM');
}
