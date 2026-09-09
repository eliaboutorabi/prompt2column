/** Thin client for the local Ollama HTTP API. */
import type { JsonSchema } from './output';

export const DEFAULT_HOST = 'http://localhost:11434';

export interface OllamaModel {
	name: string;
	size: number;
	family: string;
	parameterSize: string;
	quantization: string;
	capabilities: string[];
	modifiedAt: string;
}

export class OllamaError extends Error {
	readonly kind: 'offline' | 'http' | 'aborted' | 'bad-response';
	constructor(kind: OllamaError['kind'], message: string) {
		super(message);
		this.name = 'OllamaError';
		this.kind = kind;
	}
}

function offlineError(host: string): OllamaError {
	return new OllamaError(
		'offline',
		`Cannot reach Ollama at ${host}. Start it with "ollama serve" and try again.`
	);
}

export async function listModels(
	host = DEFAULT_HOST,
	signal?: AbortSignal
): Promise<OllamaModel[]> {
	let response: Response;
	try {
		response = await fetch(`${host}/api/tags`, { signal });
	} catch (error) {
		if (isAbort(error)) throw new OllamaError('aborted', 'Request cancelled.');
		throw offlineError(host);
	}
	if (!response.ok) {
		throw new OllamaError('http', `Ollama replied with ${response.status} when listing models.`);
	}
	const body = (await response.json()) as { models?: RawModel[] };
	return (body.models ?? []).map(toModel).sort((a, b) => a.name.localeCompare(b.name));
}

interface RawModel {
	name?: string;
	model?: string;
	size?: number;
	modified_at?: string;
	capabilities?: string[];
	details?: {
		family?: string;
		parameter_size?: string;
		quantization_level?: string;
	};
}

function toModel(raw: RawModel): OllamaModel {
	return {
		name: raw.name ?? raw.model ?? 'unknown',
		size: raw.size ?? 0,
		family: raw.details?.family ?? '',
		parameterSize: raw.details?.parameter_size ?? '',
		quantization: raw.details?.quantization_level ?? '',
		capabilities: raw.capabilities ?? [],
		modifiedAt: raw.modified_at ?? ''
	};
}

export interface CompletionRequest {
	host?: string;
	model: string;
	system: string;
	prompt: string;
	schema?: JsonSchema;
	temperature?: number;
	numPredict?: number | null;
	think?: boolean;
	signal?: AbortSignal;
}

export interface CompletionResult {
	content: string;
	durationMs: number;
	promptTokens: number;
	outputTokens: number;
}

export async function complete(request: CompletionRequest): Promise<CompletionResult> {
	const host = request.host ?? DEFAULT_HOST;
	const body: Record<string, unknown> = {
		model: request.model,
		stream: false,
		messages: [
			{ role: 'system', content: request.system },
			{ role: 'user', content: request.prompt }
		],
		options: {
			temperature: request.temperature ?? 0,
			...(request.numPredict ? { num_predict: request.numPredict } : {})
		}
	};
	if (request.schema) body.format = request.schema;
	if (request.think === false) body.think = false;

	const started = Date.now();
	let response: Response;
	try {
		response = await fetch(`${host}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: request.signal
		});
	} catch (error) {
		if (isAbort(error)) throw new OllamaError('aborted', 'Run cancelled.');
		throw offlineError(host);
	}
	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new OllamaError('http', formatHttpError(response.status, detail, request.model));
	}
	const payload = (await response.json()) as {
		message?: { content?: string };
		error?: string;
		prompt_eval_count?: number;
		eval_count?: number;
	};
	if (payload.error) throw new OllamaError('http', payload.error);
	const content = payload.message?.content ?? '';
	if (content.trim() === '') {
		throw new OllamaError('bad-response', 'The model returned an empty reply.');
	}
	return {
		content,
		durationMs: Date.now() - started,
		promptTokens: payload.prompt_eval_count ?? 0,
		outputTokens: payload.eval_count ?? 0
	};
}

function formatHttpError(status: number, detail: string, model: string): string {
	const trimmed = detail.trim().slice(0, 300);
	if (status === 404) {
		return `Ollama does not have the model "${model}". Pull it with "ollama pull ${model}".`;
	}
	return trimmed ? `Ollama error ${status}: ${trimmed}` : `Ollama error ${status}.`;
}

function isAbort(error: unknown): boolean {
	return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

export function formatModelSize(bytes: number): string {
	if (!bytes) return '';
	const gb = bytes / 1024 ** 3;
	if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
	return `${Math.round(bytes / 1024 ** 2)} MB`;
}
