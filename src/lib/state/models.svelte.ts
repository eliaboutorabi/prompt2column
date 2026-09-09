/** Models found on the machine running Ollama. */
import { DEFAULT_HOST, listModels, type OllamaModel } from '$lib/core/ollama';

const HOST_KEY = 'prompt2column:host';

class ModelStore {
	host = $state(DEFAULT_HOST);
	models = $state<OllamaModel[]>([]);
	loading = $state(false);
	error = $state('');
	checkedAt = $state(0);

	constructor() {
		if (typeof localStorage !== 'undefined') {
			this.host = localStorage.getItem(HOST_KEY) ?? DEFAULT_HOST;
		}
	}

	get online(): boolean {
		return this.checkedAt > 0 && this.error === '';
	}

	setHost(host: string): void {
		this.host = host.trim().replace(/\/+$/, '') || DEFAULT_HOST;
		if (typeof localStorage !== 'undefined') localStorage.setItem(HOST_KEY, this.host);
	}

	async scan(): Promise<void> {
		this.loading = true;
		this.error = '';
		try {
			this.models = await listModels(this.host);
			if (!this.models.length) {
				this.error = 'Ollama is running but has no models. Pull one with "ollama pull llama3.2".';
			}
		} catch (error) {
			this.models = [];
			this.error = error instanceof Error ? error.message : String(error);
		} finally {
			this.checkedAt = Date.now();
			this.loading = false;
		}
	}
}

export const models = new ModelStore();
