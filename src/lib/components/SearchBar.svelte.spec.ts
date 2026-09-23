import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DataGrid from './DataGrid.svelte';
import SearchBar from './SearchBar.svelte';
import { Workspace } from '$lib/state/workspace.svelte';
import { defaultConfig, type Column, type Row } from '$lib/core/types';

const columns: Column[] = [
	{ id: 'c1', name: 'Customer', generated: false },
	{ id: 'c2', name: 'Message', generated: false },
	{ id: 'c3', name: 'Decision', generated: true }
];

const baseRows: Row[] = [
	{ id: 'r1', cells: { c1: 'Marta Kovács', c2: 'Billing charged twice', c3: 'Reject' } },
	{ id: 'r2', cells: { c1: 'Kwame Boateng', c2: 'Support fixed it fast', c3: 'Approve' } },
	{ id: 'r3', cells: { c1: 'Elif Yalçın', c2: 'Billing asked about a discount', c3: 'Approve' } }
];

function makeWorkspace(rows: Row[] = baseRows): Workspace {
	const ws = new Workspace();
	ws.project = {
		id: 'p1',
		ownerId: 'u1',
		name: 'Expenses',
		fileName: null,
		createdAt: 0,
		updatedAt: 0,
		columns,
		rows,
		config: defaultConfig()
	};
	ws.loading = false;
	ws.touch = () => {};
	return ws;
}

/** Gives the grid a real viewport so it virtualizes the way it does in the app. */
function sizedTarget(): HTMLElement {
	const target = document.createElement('div');
	target.style.cssText = 'height: 320px; width: 520px;';
	document.body.append(target);
	targets.push(target);
	return target;
}

const targets: HTMLElement[] = [];
afterEach(() => {
	for (const target of targets.splice(0)) target.remove();
});

describe('SearchBar', () => {
	it('counts matching cells and rows as you type', async () => {
		render(SearchBar, { props: { ws: makeWorkspace() } });
		await userEvent.fill(page.getByRole('searchbox', { name: 'Find in sheet' }), 'billing');
		await expect.element(page.getByText(/1\s+of 2/)).toBeVisible();
		await expect.element(page.getByText('cells, 2 rows')).toBeVisible();
	});

	it('says so when nothing matches', async () => {
		render(SearchBar, { props: { ws: makeWorkspace() } });
		await userEvent.fill(page.getByRole('searchbox'), 'refund');
		await expect.element(page.getByText('No matches')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Next match' })).toBeDisabled();
	});

	it('steps forward on Enter and back on Shift Enter, wrapping around', async () => {
		const ws = makeWorkspace();
		render(SearchBar, { props: { ws } });
		const box = page.getByRole('searchbox');
		await userEvent.fill(box, 'approve');
		expect(ws.currentMatch?.rowId).toBe('r2');
		await userEvent.keyboard('{Enter}');
		expect(ws.currentMatch?.rowId).toBe('r3');
		await userEvent.keyboard('{Enter}');
		expect(ws.currentMatch?.rowId).toBe('r2');
		await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
		expect(ws.currentMatch?.rowId).toBe('r3');
	});

	it('steps with the arrow buttons', async () => {
		const ws = makeWorkspace();
		render(SearchBar, { props: { ws } });
		await userEvent.fill(page.getByRole('searchbox'), 'approve');
		await userEvent.click(page.getByRole('button', { name: 'Next match' }));
		await expect.element(page.getByText(/2\s+of 2/)).toBeVisible();
		await userEvent.click(page.getByRole('button', { name: 'Previous match' }));
		await expect.element(page.getByText(/1\s+of 2/)).toBeVisible();
	});

	it('ignores accents, so plain letters find accented names', async () => {
		const ws = makeWorkspace();
		render(SearchBar, { props: { ws } });
		await userEvent.fill(page.getByRole('searchbox'), 'kovacs');
		expect(ws.currentMatch).toMatchObject({ rowId: 'r1', columnId: 'c1' });
	});

	it('searches one column when one is picked', async () => {
		const ws = makeWorkspace();
		render(SearchBar, { props: { ws } });
		await userEvent.fill(page.getByRole('searchbox'), 'a');
		const everywhere = ws.search.matches.length;
		await userEvent.selectOptions(
			page.getByRole('combobox', { name: 'Column to search' }),
			'Decision'
		);
		expect(ws.search.matches.length).toBeLessThan(everywhere);
		expect(ws.search.matches.every((match) => match.columnId === 'c3')).toBe(true);
	});

	it('clears the search on Escape', async () => {
		const ws = makeWorkspace();
		render(SearchBar, { props: { ws } });
		const box = page.getByRole('searchbox');
		await userEvent.fill(box, 'billing');
		await userEvent.keyboard('{Escape}');
		await expect.element(box).toHaveValue('');
		expect(ws.search.matches).toHaveLength(0);
	});

	it('ticks the rows that hold a match', async () => {
		const ws = makeWorkspace();
		render(SearchBar, { props: { ws } });
		await userEvent.fill(page.getByRole('searchbox'), 'billing');
		await userEvent.click(page.getByRole('button', { name: 'Tick 2 rows' }));
		expect([...ws.selected].sort()).toEqual(['r1', 'r3']);
	});
});

describe('search in the grid', () => {
	it('highlights the matched text without changing what the cell says', async () => {
		const ws = makeWorkspace();
		render(SearchBar, { props: { ws } });
		const { container } = render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.fill(page.getByRole('searchbox'), 'billing');
		await expect.element(page.getByText('Billing', { exact: true }).first()).toBeVisible();
		const marks = [...container.querySelectorAll('mark')].map((mark) => mark.textContent);
		expect(marks).toEqual(['Billing', 'Billing']);
		const cell = container.querySelector('.cell.hit .value');
		expect(cell?.textContent).toBe('Billing charged twice');
	});

	it('marks the current match apart from the other hits', async () => {
		const ws = makeWorkspace();
		render(SearchBar, { props: { ws } });
		const { container } = render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.fill(page.getByRole('searchbox'), 'approve');
		await expect.poll(() => container.querySelectorAll('.cell.hit').length).toBe(2);
		expect(container.querySelectorAll('.cell.current')).toHaveLength(1);
		expect(container.querySelector('.cell.current')?.textContent?.trim()).toBe('Approve');
	});

	it('scrolls a match far down a long sheet into view', async () => {
		const rows: Row[] = Array.from({ length: 600 }, (_, index) => ({
			id: `r${index}`,
			cells: {
				c1: `Customer ${index}`,
				c2: index === 480 ? 'Needle in the haystack' : 'Routine request',
				c3: ''
			}
		}));
		const ws = makeWorkspace(rows);
		render(SearchBar, { props: { ws } });
		render(DataGrid, { props: { ws, onInsert: () => {} }, target: sizedTarget() });
		// Far below the fold, the row is not in the DOM until the search reaches it.
		expect(document.querySelector('[data-cell="480-1"]')).toBeNull();
		await userEvent.fill(page.getByRole('searchbox'), 'haystack');
		await expect.element(page.getByText('haystack')).toBeInViewport();
	});

	it('shows the part of a long value where the match is', async () => {
		const rows: Row[] = [
			{
				id: 'r1',
				cells: {
					c1: 'Petra Novakova',
					c2: 'Renewal quote came in 38 percent above last year with no notice and no change in seat count.',
					c3: ''
				}
			}
		];
		const ws = makeWorkspace(rows);
		render(SearchBar, { props: { ws } });
		const { container } = render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.fill(page.getByRole('searchbox'), 'seat');
		await expect
			.poll(() => container.querySelector('.cell.hit .value')?.textContent)
			.toBe('…change in seat count.');
		expect(container.querySelector('.cell.hit .value')?.getAttribute('title')).toContain(
			'Renewal quote'
		);
	});
});
