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
	it('says how to use it until a cell is picked', async () => {
		mount(makeWorkspace());
		await expect.element(reader()).toHaveTextContent(/No cell selected/);
		await expect.element(reader()).toHaveTextContent(/Click a cell to read all of it here/);
		await expect.element(page.getByRole('button', { name: 'Copy cell text' })).toBeDisabled();
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

	it('says the cell is being edited and shows the text as it is typed', async () => {
		mount(makeWorkspace());
		await userEvent.dblClick(page.getByText('Short note 1'));
		await expect.element(reader()).toHaveTextContent(/Editing/);
		await expect.element(reader()).toHaveTextContent(/Enter saves, Esc cancels/);
		await userEvent.keyboard('{End}, then left early');
		await expect.poll(() => readerText()?.textContent).toBe('Short note 1, then left early');
	});

	it('goes back to the saved text once the edit is saved', async () => {
		const ws = makeWorkspace();
		mount(ws);
		await userEvent.dblClick(page.getByText('Short note 1'));
		await userEvent.keyboard('{End} (checked){Enter}');
		await expect.poll(() => readerText()?.textContent).toBe('Short note 1 (checked)');
		await expect.element(reader()).not.toHaveTextContent(/Editing/);
		expect(ws.rows[1].cells.c2).toBe('Short note 1 (checked)');
	});

	it('shows the original text again when the edit is cancelled', async () => {
		mount(makeWorkspace());
		await userEvent.dblClick(page.getByText('Short note 1'));
		await userEvent.keyboard('{End} discarded');
		await expect.poll(() => readerText()?.textContent).toBe('Short note 1 discarded');
		await userEvent.keyboard('{Escape}');
		await expect.poll(() => readerText()?.textContent).toBe('Short note 1');
		await expect.element(reader()).not.toHaveTextContent(/Editing/);
	});

	it('clears the selection from its own button, staying put', async () => {
		const ws = makeWorkspace();
		mount(ws);
		await userEvent.click(page.getByText(/^Signed up on a phone/));
		await userEvent.click(page.getByRole('button', { name: 'Clear selection' }));
		expect(ws.activeCell).toBeNull();
		await expect.element(reader()).toHaveTextContent(/No cell selected/);
	});

	it('empties when the column it shows is deleted', async () => {
		const ws = makeWorkspace();
		mount(ws);
		await userEvent.click(page.getByText(/^Signed up on a phone/));
		ws.deleteColumn('c2');
		await expect.element(reader()).toHaveTextContent(/No cell selected/);
	});

	it('shows the cell a search lands on', async () => {
		const ws = makeWorkspace();
		render(SearchBar, { props: { ws } });
		mount(ws);
		await userEvent.fill(page.getByRole('searchbox'), 'researcher');
		await expect.poll(() => readerText()?.textContent).toBe(note);
	});

	it('never moves the sheet when a cell is picked', async () => {
		mount(makeWorkspace(makeRows(12)));
		// A row well inside the view, so the browser has no reason to scroll it.
		const cell = page.getByText('P02 participant', { exact: true }).element();
		const before = cell.getBoundingClientRect().top;
		await userEvent.click(cell);
		await expect.element(reader()).toHaveTextContent(/row 3/);
		expect(cell.getBoundingClientRect().top).toBe(before);
	});

	it('opens the double-clicked cell for editing, even with nothing selected yet', async () => {
		// When the reader used to appear on the first click, it pushed the sheet down and
		// the second click landed rows above, opening the wrong cell.
		const ws = makeWorkspace(makeRows(12));
		mount(ws);
		await userEvent.dblClick(page.getByText('P06 participant', { exact: true }));
		expect(ws.editingCell).toEqual({ rowId: 'r6', columnId: 'c1' });
		await expect.element(reader()).toHaveTextContent(/Editing/);
	});
});
