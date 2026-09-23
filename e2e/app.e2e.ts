import { expect, test, type Page } from '@playwright/test';

const MODELS = {
	models: [
		{
			name: 'gemma4:e2b-mlx',
			model: 'gemma4:e2b-mlx',
			size: 7_476_595_162,
			details: { family: 'gemma', parameter_size: '2B', quantization_level: 'nvfp4' },
			capabilities: ['completion', 'thinking']
		},
		{ name: 'qwen3:8b', model: 'qwen3:8b', size: 5_200_000_000, details: {} }
	]
};

/** Stands in for a local Ollama so the run is deterministic and instant. */
async function mockOllama(page: Page, options: { offline?: boolean; answers?: string[] } = {}) {
	if (options.offline) {
		await page.route('**://localhost:11434/**', (route) => route.abort('connectionrefused'));
		return;
	}
	const answers = options.answers ?? ['positive', 'neutral', 'negative'];
	let call = 0;
	await page.route('**://localhost:11434/api/tags', (route) => route.fulfill({ json: MODELS }));
	await page.route('**://localhost:11434/api/chat', (route) => {
		const value = answers[call % answers.length];
		call += 1;
		route.fulfill({
			json: {
				model: 'gemma4:e2b-mlx',
				message: { role: 'assistant', content: JSON.stringify({ value }) },
				done: true,
				prompt_eval_count: 40,
				eval_count: 3
			}
		});
	});
}

async function signUp(page: Page, name = 'ines.moreau') {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Create a workspace|Sign in/ })).toBeVisible();
	const swap = page.getByRole('button', { name: 'Create a new workspace instead' });
	if (await swap.isVisible()) await swap.click();
	await page.getByLabel('Name').fill(name);
	await page.getByLabel('Passphrase').fill('winter-harbour');
	await page.getByRole('button', { name: 'Create workspace' }).click();
	await expect(page.getByRole('heading', { name: 'Start a project' })).toBeVisible();
}

test('signs up, imports a sample, runs a prompt and exports the result', async ({ page }) => {
	await mockOllama(page);
	await signUp(page);

	await page.getByRole('button', { name: /Support tickets/ }).click();
	await expect(page.getByRole('columnheader', { name: /Customer/ })).toBeVisible();
	await expect(page.getByText('Ines Moreau').first()).toBeVisible();

	// The sample arrives with the classify preset already filled in.
	await expect(page.getByLabel('Column name')).toHaveValue('Category');
	await page.getByLabel('Column name').fill('Sentiment');
	await expect(page.getByLabel('Model', { exact: true })).toHaveValue('gemma4:e2b-mlx');

	await page.getByRole('button', { name: /Run on 15 rows/ }).click();
	await expect(page.getByRole('button', { name: /Run on/ })).toBeEnabled({ timeout: 30_000 });

	await expect(page.getByRole('columnheader', { name: /Sentiment/ })).toBeVisible();
	const cells = page.locator('.cell.generated');
	await expect(cells.first()).toHaveText(/positive|neutral|negative/);
	await expect(page.getByText('15 / 15 rows')).toBeVisible();

	const download = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export CSV' }).click()
	]).then(([event]) => event);
	expect(download.suggestedFilename()).toBe('support-tickets-enriched.csv');
	const stream = await download.createReadStream();
	const text = await new Promise<string>((resolve, reject) => {
		let out = '';
		stream.on('data', (chunk) => (out += chunk));
		stream.on('end', () => resolve(out));
		stream.on('error', reject);
	});
	expect(text.split('\n')[0]).toContain('Sentiment');
	expect(text).toMatch(/,(positive|neutral|negative)/);
});

test('keeps the project and its generated column after leaving and coming back', async ({
	page
}) => {
	await mockOllama(page, { answers: ['Approve', 'Reject'] });
	await signUp(page, 'tomasz.w');

	await page.getByRole('button', { name: /Expense requests/ }).click();
	await page.getByLabel('Column name').fill('Decision');
	await page.getByRole('button', { name: 'A range' }).click();
	await page.getByLabel('First row in the range').fill('1');
	await page.getByLabel('Last row in the range').fill('4');
	await expect(page.getByText('This run will touch')).toContainText('4');

	await page.getByRole('button', { name: /Run on 4 rows/ }).click();
	await expect(page.getByText('4 / 4 rows')).toBeVisible({ timeout: 30_000 });

	await page.getByRole('link', { name: 'Back to projects' }).click();
	await expect(page.getByRole('button', { name: /Expense requests/ }).first()).toBeVisible();
	await page.getByRole('button', { name: /Open Expense requests/ }).click();

	await expect(page.getByRole('columnheader', { name: /Decision/ })).toBeVisible();
	await expect(page.locator('.cell.generated').first()).toHaveText(/Approve|Reject/);
});

test('completes a column reference from the prompt editor and from the header', async ({
	page
}) => {
	await mockOllama(page);
	await signUp(page, 'amara.o');

	await page.getByRole('button', { name: /Research notes/ }).click();
	const editor = page.getByRole('combobox', { name: 'Prompt', exact: true });
	await editor.fill('');
	await editor.pressSequentially('Summarize {{stu');
	await page
		.getByRole('listbox', { name: 'Columns' })
		.getByRole('option', { name: /Study/ })
		.click();
	await expect(editor).toHaveValue('Summarize {{Study}}');

	await page.getByRole('grid').getByRole('button', { name: 'Raw notes', exact: true }).click();
	await expect(editor).toHaveValue('Summarize {{Study}} {{Raw notes}}');
});

test('blocks a run whose prompt names a column that does not exist', async ({ page }) => {
	await mockOllama(page);
	await signUp(page, 'bilal.h');

	await page.getByRole('button', { name: /Research notes/ }).click();
	const editor = page.getByRole('combobox', { name: 'Prompt', exact: true });
	await editor.fill('Summarize {{Nothing}}');
	await expect(page.getByRole('alert')).toContainText('No column called "Nothing"');
	await expect(page.getByRole('button', { name: /Run on/ })).toBeDisabled();
});

test('says so plainly when Ollama is not running', async ({ page }) => {
	await mockOllama(page, { offline: true });
	await signUp(page, 'sanne.dv');

	await page.getByRole('button', { name: /Support tickets/ }).click();
	await expect(page.getByText('Ollama offline')).toBeVisible();
	await expect(page.getByRole('alert').first()).toContainText('ollama serve');
	await expect(page.getByRole('button', { name: /Run on/ })).toBeDisabled();
});

test('previews the exact prompt one row will send', async ({ page }) => {
	await mockOllama(page);
	await signUp(page, 'freya.l');

	await page.getByRole('button', { name: /Support tickets/ }).click();
	await page.getByRole('button', { name: 'Preview' }).click();

	const dialog = page.getByRole('dialog', { name: 'Prompt preview' });
	await expect(dialog).toContainText('Ines Moreau');
	await expect(dialog).toContainText('No greeting');
	await dialog.getByRole('button', { name: 'Test this row' }).click();
	await expect(dialog.locator('.answer')).toHaveText(/positive|neutral|negative/);
	await dialog.getByRole('button', { name: 'Next row' }).click();
	await expect(dialog).toContainText('Tomasz Wierzbicki');
});

test('finds cells from the keyboard and runs the prompt on just those rows', async ({ page }) => {
	await mockOllama(page);
	await signUp(page, 'marta.k');

	await page.getByRole('button', { name: /Support tickets/ }).click();
	await expect(page.getByRole('columnheader', { name: /Message/ })).toBeVisible();

	await page.getByRole('grid').click();
	await page.keyboard.press('ControlOrMeta+f');
	const search = page.getByRole('searchbox', { name: 'Find in sheet' });
	await expect(search).toBeFocused();

	await search.fill('workaround');
	await expect(page.getByRole('search')).toContainText(/1\s+of 2/);
	await expect(page.locator('.cell.current mark')).toHaveText(/workaround/i);

	await search.press('Enter');
	await expect(page.getByRole('search')).toContainText(/2\s+of 2/);

	await page.getByRole('button', { name: 'Tick 2 rows' }).click();
	await page.getByRole('button', { name: 'Ticked rows' }).click();
	await expect(page.getByRole('button', { name: /Run on 2 rows/ })).toBeEnabled();

	await search.press('Escape');
	await expect(search).toHaveValue('');
	await expect(page.locator('mark')).toHaveCount(0);
});
