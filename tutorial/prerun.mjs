// Runs the three sample sheets once through the real model, through the app
// itself, and keeps every request and reply. The recording replays these, so
// the answers on screen are the model's own while the timing stays exact.
//
// Usage: node tutorial/prerun.mjs   (needs Ollama running and signed in)
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { BASE, build, serve } from './server.mjs';

const MODEL = 'gemma4:31b-cloud';
const OUT = new URL('./fixtures/replies.json', import.meta.url);

const SHEETS = [
	{ sample: 'Support tickets', column: 'Sentiment', rows: 15 },
	{ sample: 'Expense requests', column: 'Decision', rows: 15 },
	{ sample: 'Research notes', column: 'Summary', rows: 12 }
];

build();
const stop = await serve();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1746, height: 982 } });
const page = await context.newPage();
const replies = [];

await page.route('**://localhost:11434/api/chat', async (route) => {
	const request = JSON.parse(route.request().postData() ?? '{}');
	const started = Date.now();
	const response = await route.fetch();
	const body = await response.json();
	replies.push({
		model: request.model,
		system: request.messages?.[0]?.content,
		prompt: request.messages?.[1]?.content,
		format: request.format,
		think: request.think,
		latencyMs: Date.now() - started,
		reply: body
	});
	await route.fulfill({ response, json: body });
});

await page.goto(BASE + '/');
await page.getByRole('heading', { name: /Create a workspace|Sign in/ }).waitFor();
const swap = page.getByRole('button', { name: 'Create a new workspace instead' });
if (await swap.isVisible()) await swap.click();
await page.getByLabel('Name').fill('ellie');
await page.getByLabel('Passphrase').fill('prerun-passphrase');
await page.getByRole('button', { name: 'Create workspace' }).click();
await page.getByRole('heading', { name: 'Start a project' }).waitFor();

for (const sheet of SHEETS) {
	await page.locator('button.sample', { hasText: sheet.sample }).click();
	await page.getByRole('grid').waitFor();
	await page.getByLabel('Column name').fill(sheet.column);
	await page.getByRole('combobox', { name: 'Model' }).click();
	await page.getByRole('option', { name: new RegExp(MODEL) }).click();
	await page.getByRole('button', { name: new RegExp(`Run on ${sheet.rows} rows`) }).click();
	await page.getByText(`${sheet.rows} / ${sheet.rows} rows`).waitFor({ timeout: 180_000 });
	const failed = await page.locator('.cell.error').count();
	console.log(`${sheet.sample}: done, ${failed} failed`);
	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	await page.getByRole('heading', { name: 'Start a project' }).waitFor();
}

writeFileSync(OUT, JSON.stringify(replies, null, '\t'));
console.log(`kept ${replies.length} replies in ${OUT.pathname}`);
await browser.close();
stop();
