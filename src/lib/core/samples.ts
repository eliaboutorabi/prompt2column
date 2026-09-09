import { base } from '$app/paths';

/** Bundled sheets so a new workspace has something to run against. */
export interface Sample {
	id: string;
	name: string;
	file: string;
	rows: number;
	blurb: string;
	presetId: string;
}

export const SAMPLES: Sample[] = [
	{
		id: 'support',
		name: 'Support tickets',
		file: 'support-tickets.csv',
		rows: 15,
		blurb: 'Inbound messages to label by sentiment or topic.',
		presetId: 'classify'
	},
	{
		id: 'expenses',
		name: 'Expense requests',
		file: 'expense-requests.csv',
		rows: 15,
		blurb: 'Claims to approve or reject against a policy cap.',
		presetId: 'decide'
	},
	{
		id: 'research',
		name: 'Research notes',
		file: 'research-notes.csv',
		rows: 12,
		blurb: 'Long interview notes to compress into one line.',
		presetId: 'summarize'
	}
];

export async function loadSample(sample: Sample, fetcher: typeof fetch = fetch): Promise<string> {
	const response = await fetcher(`${base}/samples/${sample.file}`);
	if (!response.ok) throw new Error(`Could not load the ${sample.name} sample.`);
	return response.text();
}
