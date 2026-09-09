import { afterEach, describe, expect, it, vi } from 'vitest';
import { complete, formatModelSize, listModels, OllamaError } from './ollama';

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
		handler(String(input), init)
	);
	globalThis.fetch = spy as unknown as typeof fetch;
	return spy;
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('listModels', () => {
	it('maps the tag list and sorts by name', async () => {
		mockFetch(() =>
			json({
				models: [
					{ name: 'qwen3:8b', size: 5_100_000_000, details: { parameter_size: '8B' } },
					{ name: 'gemma4:e2b', size: 7_476_595_162, capabilities: ['thinking'] }
				]
			})
		);
		const models = await listModels();
		expect(models.map((model) => model.name)).toEqual(['gemma4:e2b', 'qwen3:8b']);
		expect(models[0].capabilities).toEqual(['thinking']);
	});

	it('explains how to start Ollama when the socket is closed', async () => {
		mockFetch(() => {
			throw new TypeError('fetch failed');
		});
		await expect(listModels('http://localhost:11434')).rejects.toThrow(/ollama serve/i);
	});

	it('surfaces an HTTP failure', async () => {
		mockFetch(() => json({}, 500));
		await expect(listModels()).rejects.toThrow(/500/);
	});
});

describe('complete', () => {
	it('sends the schema, the system message and the row prompt', async () => {
		const spy = mockFetch(() => json({ message: { content: '{"value":"good"}' }, eval_count: 6 }));
		const result = await complete({
			model: 'test',
			system: 'rules',
			prompt: 'row data',
			schema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
			temperature: 0.2,
			numPredict: 64,
			think: false
		});
		const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
		expect(body.messages).toEqual([
			{ role: 'system', content: 'rules' },
			{ role: 'user', content: 'row data' }
		]);
		expect(body.format.required).toEqual(['value']);
		expect(body.stream).toBe(false);
		expect(body.think).toBe(false);
		expect(body.options).toEqual({ temperature: 0.2, num_predict: 64 });
		expect(result.content).toBe('{"value":"good"}');
		expect(result.outputTokens).toBe(6);
	});

	it('leaves thinking alone when the run asks for it', async () => {
		const spy = mockFetch(() => json({ message: { content: 'ok' } }));
		await complete({ model: 'test', system: 's', prompt: 'p', think: true });
		expect(JSON.parse(String(spy.mock.calls[0][1]?.body)).think).toBeUndefined();
	});

	it('names the missing model on a 404', async () => {
		mockFetch(() => new Response('model not found', { status: 404 }));
		await expect(complete({ model: 'llama9', system: 's', prompt: 'p' })).rejects.toThrow(
			/ollama pull llama9/
		);
	});

	it('treats an empty reply as a failure', async () => {
		mockFetch(() => json({ message: { content: '   ' } }));
		await expect(complete({ model: 'test', system: 's', prompt: 'p' })).rejects.toBeInstanceOf(
			OllamaError
		);
	});

	it('reports an abort as cancelled rather than offline', async () => {
		mockFetch(() => {
			const error = new Error('aborted');
			error.name = 'AbortError';
			throw error;
		});
		await expect(complete({ model: 'test', system: 's', prompt: 'p' })).rejects.toThrow(
			/cancelled/i
		);
	});
});

describe('formatModelSize', () => {
	it('uses gigabytes for large models', () => {
		expect(formatModelSize(7_476_595_162)).toBe('7.0 GB');
	});

	it('uses megabytes for small ones', () => {
		expect(formatModelSize(250 * 1024 ** 2)).toBe('250 MB');
	});

	it('returns nothing when the size is unknown', () => {
		expect(formatModelSize(0)).toBe('');
	});
});
