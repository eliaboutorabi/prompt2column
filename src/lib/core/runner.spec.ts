import { describe, expect, it, vi } from 'vitest';
import { Runner, type CompleteFn } from './runner';
import { OllamaError } from './ollama';
import { defaultConfig, type Column, type GenConfig, type Row } from './types';

const columns: Column[] = [
	{ id: 'c1', name: 'Message', generated: false },
	{ id: 'c2', name: 'Sentiment', generated: true }
];

function makeRows(count: number): Row[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `r${index + 1}`,
		cells: { c1: `message ${index + 1}`, c2: '' }
	}));
}

function config(over: Partial<GenConfig> = {}): GenConfig {
	return {
		...defaultConfig(),
		model: 'test-model',
		targetColumnName: 'Sentiment',
		template: 'Classify: {{Message}}',
		output: { ...defaultConfig().output, kind: 'choice', choices: ['good', 'bad'] },
		concurrency: 1,
		...over
	};
}

const reply = (value: string): Awaited<ReturnType<CompleteFn>> => ({
	content: JSON.stringify({ value }),
	durationMs: 1,
	promptTokens: 1,
	outputTokens: 1
});

describe('Runner', () => {
	it('writes a value for every row', async () => {
		const complete = vi.fn<CompleteFn>(async () => reply('good'));
		const runner = new Runner({ config: config(), columns, rows: makeRows(3), complete });
		const outcomes = await runner.start();
		expect(outcomes.map((outcome) => outcome.value)).toEqual(['good', 'good', 'good']);
		expect(runner.completed).toBe(3);
		expect(runner.status).toBe('done');
	});

	it('sends the rendered row, not the raw template', async () => {
		const complete = vi.fn<CompleteFn>(async () => reply('good'));
		await new Runner({ config: config(), columns, rows: makeRows(1), complete }).start();
		expect(complete.mock.calls[0][0].prompt).toBe('Classify: message 1');
	});

	it('keeps at most `concurrency` calls in flight', async () => {
		let active = 0;
		let peak = 0;
		const complete: CompleteFn = async () => {
			active += 1;
			peak = Math.max(peak, active);
			await new Promise((resolve) => setTimeout(resolve, 5));
			active -= 1;
			return reply('good');
		};
		await new Runner({
			config: config({ concurrency: 2 }),
			columns,
			rows: makeRows(6),
			complete
		}).start();
		expect(peak).toBe(2);
	});

	it('retries once when the answer is outside the allowed labels', async () => {
		const complete = vi
			.fn<CompleteFn>()
			.mockResolvedValueOnce(reply('somewhat pleasant'))
			.mockResolvedValueOnce(reply('good'));
		const runner = new Runner({ config: config(), columns, rows: makeRows(1), complete });
		const [outcome] = await runner.start();
		expect(complete).toHaveBeenCalledTimes(2);
		expect(outcome).toMatchObject({ ok: true, value: 'good' });
	});

	it('tells the model why the previous answer was rejected', async () => {
		const complete = vi
			.fn<CompleteFn>()
			.mockResolvedValueOnce(reply('somewhat pleasant'))
			.mockResolvedValueOnce(reply('good'));
		await new Runner({ config: config(), columns, rows: makeRows(1), complete }).start();
		expect(complete.mock.calls[1][0].system).toContain('previous reply was rejected');
	});

	it('fails the row after the retries run out', async () => {
		const complete = vi.fn<CompleteFn>(async () => reply('unclear'));
		const runner = new Runner({ config: config(), columns, rows: makeRows(1), complete });
		const [outcome] = await runner.start();
		expect(outcome.ok).toBe(false);
		expect(outcome.error).toContain('not one of the allowed labels');
		expect(runner.failed).toBe(1);
	});

	it('does not retry when Ollama is unreachable', async () => {
		const complete = vi.fn<CompleteFn>(async () => {
			throw new OllamaError('offline', 'Cannot reach Ollama at http://localhost:11434.');
		});
		const [outcome] = await new Runner({
			config: config(),
			columns,
			rows: makeRows(1),
			complete
		}).start();
		expect(complete).toHaveBeenCalledTimes(1);
		expect(outcome.error).toContain('Cannot reach Ollama');
	});

	it('fails a row whose referenced cells are all empty, without calling the model', async () => {
		const complete = vi.fn<CompleteFn>(async () => reply('good'));
		const rows: Row[] = [{ id: 'r1', cells: { c1: '   ', c2: '' } }];
		const [outcome] = await new Runner({ config: config(), columns, rows, complete }).start();
		expect(complete).not.toHaveBeenCalled();
		expect(outcome.error).toContain('empty');
	});

	it('fails every row when the template names a column that is gone', async () => {
		const complete = vi.fn<CompleteFn>(async () => reply('good'));
		const [outcome] = await new Runner({
			config: config({ template: 'Classify: {{Gone}}' }),
			columns,
			rows: makeRows(1),
			complete
		}).start();
		expect(complete).not.toHaveBeenCalled();
		expect(outcome.error).toContain('Unknown column reference: Gone');
	});

	it('stops early and leaves the remaining rows untouched', async () => {
		const complete = vi.fn<CompleteFn>(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			return reply('good');
		});
		const runner = new Runner({ config: config(), columns, rows: makeRows(10), complete });
		const finished = runner.start();
		await new Promise((resolve) => setTimeout(resolve, 12));
		runner.stop();
		await finished;
		expect(runner.status).toBe('stopped');
		expect(complete.mock.calls.length).toBeLessThan(10);
	});

	it('holds while paused and carries on after resume', async () => {
		const complete = vi.fn<CompleteFn>(async () => reply('good'));
		const runner = new Runner({ config: config(), columns, rows: makeRows(4), complete });
		const finished = runner.start();
		runner.pause();
		const duringPause = complete.mock.calls.length;
		await new Promise((resolve) => setTimeout(resolve, 15));
		expect(complete.mock.calls.length).toBe(duringPause);
		expect(runner.status).toBe('paused');
		runner.resume();
		await finished;
		expect(runner.completed).toBe(4);
	});

	it('reports each row as it starts and finishes', async () => {
		const started: string[] = [];
		const done: string[] = [];
		await new Runner({
			config: config(),
			columns,
			rows: makeRows(2),
			complete: async () => reply('good'),
			onRowStart: (id) => started.push(id),
			onRowDone: (outcome) => done.push(outcome.rowId)
		}).start();
		expect(started).toEqual(['r1', 'r2']);
		expect(done).toEqual(['r1', 'r2']);
	});
});
