import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import CellReader from './CellReader.svelte';
import DataGrid from './DataGrid.svelte';
import SearchBar from './SearchBar.svelte';
import { Workspace } from '$lib/state/workspace.svelte';
import { defaultConfig, type Column, type Row } from '$lib/core/types';

const note =
	'Signed up on a phone during a shift. Skipped the tour twice because he thought it was an ad. Found the import button only after the researcher pointed at it, then finished the first import in 11 minutes.';

const columns: Column[] = [
	{ id: 'c1', name: 'Participant', generated: false },
	{ id: 'c2', name: 'Raw notes', generated: false },
	{ id: 'c3', name: 'Summary', generated: true }
];

function makeRows(count = 3): Row[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `r${index}`,
		cells: {
			c1: `P0${index} participant`,
			c2: index === 0 ? note : `Short note ${index}`,
			c3: index === 1 ? 'Struggled with onboarding.' : ''
		}
	}));
}

function makeWorkspace(rows = makeRows()): Workspace {
	const ws = new Workspace();
	ws.project = {
		id: 'p1',
		ownerId: 'u1',
		name: 'Research notes',
		fileName: null,
		createdAt: 0,
		updatedAt: 0,
		columns: columns.map((column) => ({ ...column })),
		rows,
		config: defaultConfig()
	};
	ws.loading = false;
	ws.touch = () => {};
	return ws;
}

const targets: HTMLElement[] = [];

/** The same layout the app uses: reader above a grid that takes the remaining height. */
function sheet(height = 360): HTMLElement {
	const target = document.createElement('div');
	target.style.cssText = `display: grid; grid-template-rows: auto minmax(0, 1fr); height: ${height}px; width: 700px;`;
	document.body.append(target);
	targets.push(target);
	return target;
}

function mount(ws: Workspace, height?: number) {
	const target = sheet(height);
	render(CellReader, { props: { ws }, target });
	render(DataGrid, { props: { ws, onInsert: () => {} }, target });
}

const reader = () => page.getByRole('region', { name: 'Cell reader' });
const readerText = () => document.querySelector<HTMLElement>('.reader .text');

afterEach(() => {
	for (const target of targets.splice(0)) target.remove();
	Reflect.deleteProperty(navigator, 'clipboard');
	vi.restoreAllMocks();
});

describe('CellReader', () => {
	it('stays out of the way until a cell is picked', async () => {
		mount(makeWorkspace());
		await expect.element(page.getByText('P00 participant')).toBeVisible();
		expect(document.querySelector('.reader')).toBeNull();
	});

	it('shows the whole value of the picked cell, with its column and row', async () => {
		mount(makeWorkspace());
		await userEvent.click(page.getByText(/^Signed up on a phone/));
		await expect.element(reader()).toBeVisible();
		expect(readerText()?.textContent).toBe(note);
		await expect.element(reader()).toHaveTextContent(/Raw notes/);
		await expect.element(reader()).toHaveTextContent(/row 1/);
		await expect.element(reader()).toHaveTextContent(/38 words/);
	});

	it('follows the selection as the arrow keys move it', async () => {
		mount(makeWorkspace());
		await userEvent.click(page.getByText(/^Signed up on a phone/));
		await userEvent.keyboard('{ArrowDown}');
		await expect.poll(() => readerText()?.textContent).toBe('Short note 1');
		await userEvent.keyboard('{ArrowRight}');
		await expect.poll(() => readerText()?.textContent).toBe('Struggled with onboarding.');
		await expect.element(reader()).toHaveTextContent(/Summary/);
		await expect.element(reader()).toHaveTextContent(/row 2/);
	});

	it('sets generated text in the same monospace face as the grid', async () => {
		mount(makeWorkspace());
		await userEvent.click(page.getByText('Struggled with onboarding.'));
		await expect.poll(() => readerText()?.classList.contains('mono')).toBe(true);
	});

	it('says so when the cell is empty, and has nothing to copy', async () => {
		const ws = makeWorkspace();
		mount(ws);
		ws.setActiveCell('r0', 'c3');
		await expect.element(reader()).toHaveTextContent(/Empty cell/);
		await expect.element(page.getByRole('button', { name: 'Copy cell text' })).toBeDisabled();
	});

	it('copies the full value and confirms it', async () => {
		const writeText = vi.fn(async () => {});
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		mount(makeWorkspace());
		await userEvent.click(page.getByText(/^Signed up on a phone/));
		await userEvent.click(page.getByRole('button', { name: 'Copy cell text' }));
		expect(writeText).toHaveBeenCalledWith(note);
		await expect.element(page.getByRole('button', { name: 'Copied' })).toBeVisible();
	});

	it('drops the confirmation once another cell is picked', async () => {
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: async () => {} },
			configurable: true
		});
		mount(makeWorkspace());
		await userEvent.click(page.getByText(/^Signed up on a phone/));
		await userEvent.click(page.getByRole('button', { name: 'Copy cell text' }));
		await expect.element(page.getByRole('button', { name: 'Copied' })).toBeVisible();
		await userEvent.click(page.getByText('Short note 2'));
		await expect.element(page.getByRole('button', { name: 'Copy cell text' })).toBeVisible();
	});

	it('says so when the clipboard refuses', async () => {
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: async () => Promise.reject(new Error('denied')) },
			configurable: true
		});
		mount(makeWorkspace());
		await userEvent.click(page.getByText(/^Signed up on a phone/));
		await userEvent.click(page.getByRole('button', { name: 'Copy cell text' }));
		await expect.element(reader()).toHaveTextContent(/Copy failed/);
	});

	it('shows the whole error for a row that failed, which the grid cuts short', async () => {
		const ws = makeWorkspace();
		const error = '"somewhat pleasant" is not one of the allowed labels, even after a retry.';
		ws.lastRunColumnId = 'c3';
		ws.cellStatus.set('r2', 'error');
		ws.cellError.set('r2', error);
		mount(ws);
		ws.setActiveCell('r2', 'c3');
		await expect.poll(() => readerText()?.textContent?.trim()).toBe(error);
		await expect.element(page.getByRole('button', { name: 'Copy cell text' })).toBeDisabled();
	});

	it('fills in live while a run writes the cell', async () => {
		const ws = makeWorkspace();
		ws.lastRunColumnId = 'c3';
		ws.cellStatus.set('r0', 'running');
		mount(ws);
		ws.setActiveCell('r0', 'c3');
		await expect.element(reader()).toHaveTextContent(/Generating/);
		ws.setCell('r0', 'c3', 'Found the import button late.');
		ws.cellStatus.set('r0', 'done');
		await expect.poll(() => readerText()?.textContent).toBe('Found the import button late.');
	});

	it('closes from its own button', async () => {
		const ws = makeWorkspace();
		mount(ws);
		await userEvent.click(page.getByText(/^Signed up on a phone/));
		await userEvent.click(page.getByRole('button', { name: 'Close cell reader' }));
		expect(document.querySelector('.reader')).toBeNull();
		expect(ws.activeCell).toBeNull();
	});

	it('closes when the column it shows is deleted', async () => {
		const ws = makeWorkspace();
		mount(ws);
		await userEvent.click(page.getByText(/^Signed up on a phone/));
		ws.deleteColumn('c2');
		await expect.poll(() => document.querySelector('.reader')).toBeNull();
	});

	it('shows the cell a search lands on', async () => {
		const ws = makeWorkspace();
		render(SearchBar, { props: { ws } });
		mount(ws);
		await userEvent.fill(page.getByRole('searchbox'), 'researcher');
		await expect.poll(() => readerText()?.textContent).toBe(note);
	});

	it('keeps a row near the bottom in view when the reader opens and the grid shrinks', async () => {
		const ws = makeWorkspace(makeRows(40));
		mount(ws, 300);
		const grid = document.querySelector<HTMLElement>('[role="grid"]')!;
		await expect.poll(() => grid.clientHeight).toBeGreaterThan(0);
		// The last row that fits before the reader takes its share of the height.
		const lastVisible = Math.floor((grid.clientHeight - 36) / 34) - 1;
		await userEvent.click(page.getByText(`P0${lastVisible} participant`, { exact: true }));
		await expect.element(reader()).toBeVisible();
		await expect.poll(() => grid.clientHeight).toBeLessThan(300);
		const row = document.querySelector<HTMLElement>(`[data-cell="${lastVisible}-0"]`)!;
		const bottom = grid.getBoundingClientRect().bottom;
		expect(row.getBoundingClientRect().bottom).toBeLessThanOrEqual(bottom + 1);
	});
});
