import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DataGrid from './DataGrid.svelte';
// The app's tokens, so tests can check real colours and rings rather than bare classes.
import '../../routes/layout.css';
import { Workspace } from '$lib/state/workspace.svelte';
import { defaultConfig, type Column, type Project } from '$lib/core/types';

const columns: Column[] = [
	{ id: 'c1', name: 'Customer', generated: false },
	{ id: 'c2', name: 'Message', generated: false },
	{ id: 'c3', name: 'Sentiment', generated: true }
];

function makeWorkspace(): Workspace {
	const ws = new Workspace();
	const project: Project = {
		id: 'p1',
		ownerId: 'u1',
		name: 'Support tickets',
		fileName: 'support-tickets.csv',
		createdAt: 0,
		updatedAt: 0,
		columns,
		rows: [
			{ id: 'r1', cells: { c1: 'Ines Moreau', c2: 'Timestamps are shifted', c3: 'negative' } },
			{ id: 'r2', cells: { c1: 'Kwame Boateng', c2: 'Support fixed it fast', c3: 'positive' } },
			{ id: 'r3', cells: { c1: 'Elif Yalcin', c2: 'Is there a discount?', c3: '' } }
		],
		config: { ...defaultConfig(), template: 'Read {{Message}} from {{Customer}}' }
	};
	ws.project = project;
	ws.loading = false;
	// The grid must not write to IndexedDB during a component test.
	ws.touch = () => {};
	return ws;
}

describe('DataGrid', () => {
	it('renders every column header and row', async () => {
		render(DataGrid, { props: { ws: makeWorkspace(), onInsert: () => {} } });
		await expect.element(page.getByRole('columnheader', { name: /Customer/ })).toBeVisible();
		await expect.element(page.getByText('Timestamps are shifted')).toBeVisible();
		await expect.element(page.getByText('Kwame Boateng')).toBeVisible();
	});

	it('asks the composer to insert a reference when a header is clicked', async () => {
		const onInsert = vi.fn();
		render(DataGrid, { props: { ws: makeWorkspace(), onInsert } });
		await userEvent.click(page.getByRole('button', { name: 'Message', exact: true }));
		expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Message' }));
	});

	it('ticks every row from the header checkbox', async () => {
		const ws = makeWorkspace();
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.click(page.getByRole('checkbox', { name: 'Select every row' }));
		expect(ws.selected.size).toBe(3);
	});

	it('ticks a single row', async () => {
		const ws = makeWorkspace();
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.click(page.getByRole('checkbox', { name: 'Select row 2' }));
		expect([...ws.selected]).toEqual(['r2']);
	});

	it('renames a column and rewrites the prompt that referenced it', async () => {
		const ws = makeWorkspace();
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.click(page.getByRole('button', { name: 'Options for Message' }));
		await userEvent.click(page.getByRole('menuitem', { name: 'Rename' }));
		const input = page.getByRole('textbox', { name: 'Column name' });
		await userEvent.fill(input, 'Ticket text');
		await userEvent.keyboard('{Enter}');
		await expect.element(page.getByRole('columnheader', { name: /Ticket text/ })).toBeVisible();
		expect(ws.project?.config.template).toBe('Read {{Ticket text}} from {{Customer}}');
	});

	it('refuses a rename that collides with another column', async () => {
		const ws = makeWorkspace();
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.click(page.getByRole('button', { name: 'Options for Message' }));
		await userEvent.click(page.getByRole('menuitem', { name: 'Rename' }));
		await userEvent.fill(page.getByRole('textbox', { name: 'Column name' }), 'Customer');
		await userEvent.keyboard('{Enter}');
		await expect.element(page.getByRole('alert')).toBeVisible();
		expect(ws.columns.map((column) => column.name)).toContain('Message');
	});

	it('deletes a generated column', async () => {
		const ws = makeWorkspace();
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.click(page.getByRole('button', { name: 'Options for Sentiment' }));
		await userEvent.click(page.getByRole('menuitem', { name: 'Delete column' }));
		expect(ws.columns.map((column) => column.name)).toEqual(['Customer', 'Message']);
	});

	it('edits a cell on double click', async () => {
		const ws = makeWorkspace();
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.dblClick(page.getByText('Is there a discount?'));
		const input = page.getByRole('textbox', { name: 'Cell value' });
		await userEvent.fill(input, 'Asked about pricing');
		await userEvent.keyboard('{Enter}');
		expect(ws.rows[2].cells.c2).toBe('Asked about pricing');
	});

	it('leaves the cell alone when the edit is cancelled', async () => {
		const ws = makeWorkspace();
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.dblClick(page.getByText('Ines Moreau'));
		await userEvent.fill(page.getByRole('textbox', { name: 'Cell value' }), 'Someone else');
		await userEvent.keyboard('{Escape}');
		expect(ws.rows[0].cells.c1).toBe('Ines Moreau');
	});
});

describe('generated column styling', () => {
	it('marks generated cells so they stand out from imported data', async () => {
		const ws = makeWorkspace();
		const { container } = render(DataGrid, { props: { ws, onInsert: () => {} } });
		await expect.element(page.getByText('negative')).toBeVisible();
		expect(container.querySelectorAll('.head-cell.generated')).toHaveLength(1);
		expect(container.querySelectorAll('.cell.generated').length).toBe(3);
	});
});

describe('answer counts in the column menu', () => {
	const decisionColumns: Column[] = [
		{ id: 'req', name: 'Request', generated: false },
		{ id: 'team', name: 'Team', generated: false },
		{ id: 'dec', name: 'Decision', generated: true }
	];
	const decisions = ['Approve', 'Reject', 'Approve', '', 'Approve', 'Reject'];
	const teams = ['Design', 'Sales', 'Design', 'Sales', 'Research', 'Design'];

	function countsWorkspace(): Workspace {
		const ws = new Workspace();
		ws.project = {
			id: 'p2',
			ownerId: 'u1',
			name: 'Expense requests',
			fileName: null,
			createdAt: 0,
			updatedAt: 0,
			columns: decisionColumns.map((column) => ({ ...column })),
			rows: decisions.map((decision, index) => ({
				id: `r${index}`,
				cells: { req: `EXP-09${10 + index}`, team: teams[index], dec: decision }
			})),
			config: defaultConfig()
		};
		ws.loading = false;
		ws.touch = () => {};
		return ws;
	}

	const openMenu = (name: string) =>
		userEvent.click(page.getByRole('button', { name: `Options for ${name}` }));
	const menu = () => page.getByRole('menu');

	it('tallies a generated column as answers, most common first', async () => {
		render(DataGrid, { props: { ws: countsWorkspace(), onInsert: () => {} } });
		await openMenu('Decision');
		await expect.element(menu()).toHaveTextContent(/Answers\s*6 rows/);
		const items = page.getByRole('menuitem', { name: /rows?, \d+%/ });
		expect(items.elements().map((item) => item.getAttribute('aria-label'))).toEqual([
			'Approve: 3 rows, 50%. Tick them.',
			'Reject: 2 rows, 33%. Tick them.',
			'Empty: 1 row, 17%. Tick them.'
		]);
	});

	it('calls them values for an imported column', async () => {
		render(DataGrid, { props: { ws: countsWorkspace(), onInsert: () => {} } });
		await openMenu('Team');
		await expect.element(menu()).toHaveTextContent(/Values\s*6 rows/);
		await expect
			.element(page.getByRole('menuitem', { name: 'Design: 3 rows, 50%. Tick them.' }))
			.toBeVisible();
	});

	it('ticks exactly the rows holding a value, then closes', async () => {
		const ws = countsWorkspace();
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await openMenu('Decision');
		await userEvent.click(page.getByRole('menuitem', { name: /^Reject:/ }));
		expect([...ws.selected].sort()).toEqual(['r1', 'r5']);
		await expect.element(menu()).not.toBeInTheDocument();
	});

	it('ticks the blank rows from the Empty entry', async () => {
		const ws = countsWorkspace();
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await openMenu('Decision');
		await userEvent.click(page.getByRole('menuitem', { name: /^Empty:/ }));
		expect([...ws.selected]).toEqual(['r3']);
	});

	it('replaces the ticked rows rather than adding to them', async () => {
		const ws = countsWorkspace();
		ws.tickRows(['r0', 'r2']);
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await openMenu('Decision');
		await userEvent.click(page.getByRole('menuitem', { name: /^Reject:/ }));
		expect([...ws.selected].sort()).toEqual(['r1', 'r5']);
	});

	it('collapses a column of all-different values to a note', async () => {
		render(DataGrid, { props: { ws: countsWorkspace(), onInsert: () => {} } });
		await openMenu('Request');
		await expect.element(menu()).toHaveTextContent('Every row has a different value.');
		expect(page.getByRole('menuitem', { name: /Tick them/ }).elements()).toHaveLength(0);
	});

	it('keeps the list short when there are many values', async () => {
		const ws = countsWorkspace();
		const labels = ['a', 'a', 'b', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
		ws.project!.rows = labels.map((label, index) => ({
			id: `m${index}`,
			cells: { req: `EXP-${index}`, team: 'Design', dec: label }
		}));
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await openMenu('Decision');
		await expect.element(menu()).toHaveTextContent('3 other values, 3 rows');
		expect(page.getByRole('menuitem', { name: /Tick them/ }).elements()).toHaveLength(8);
	});

	it('updates while the menu is open, as a run fills cells in', async () => {
		const ws = countsWorkspace();
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await openMenu('Decision');
		ws.setCell('r3', 'dec', 'Reject');
		await expect
			.element(page.getByRole('menuitem', { name: 'Reject: 3 rows, 50%. Tick them.' }))
			.toBeVisible();
		expect(page.getByRole('menuitem', { name: /^Empty:/ }).elements()).toHaveLength(0);
	});

	it('fits a long tally inside a short grid, keeping Delete in reach', async () => {
		const ws = countsWorkspace();
		const labels = ['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd', 'e', 'e', 'f', 'f', 'g', 'g', 'h', 'h'];
		ws.project!.rows = labels.map((label, index) => ({
			id: `m${index}`,
			cells: { req: `EXP-${index}`, team: 'Design', dec: label }
		}));
		const target = document.createElement('div');
		target.style.cssText = 'height: 240px; width: 700px;';
		document.body.append(target);
		try {
			render(DataGrid, { props: { ws, onInsert: () => {} }, target });
			await openMenu('Decision');
			const grid = document.querySelector<HTMLElement>('[role="grid"]')!;
			const menuBox = document.querySelector<HTMLElement>('.menu')!.getBoundingClientRect();
			expect(menuBox.bottom).toBeLessThanOrEqual(grid.getBoundingClientRect().bottom + 1);
			const counts = document.querySelector<HTMLElement>('.menu .counts')!;
			expect(counts.scrollHeight).toBeGreaterThan(counts.clientHeight);
			await userEvent.click(page.getByRole('menuitem', { name: 'Delete column' }));
			expect(ws.columns.map((column) => column.name)).toEqual(['Request', 'Team']);
		} finally {
			target.remove();
		}
	});

	it('shows the counts during a run but leaves the ticks alone', async () => {
		const ws = countsWorkspace();
		ws.runState = 'running';
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await openMenu('Decision');
		await expect.element(page.getByRole('menuitem', { name: /^Approve:/ })).toBeDisabled();
	});
});

describe('selected and edited cells', () => {
	const cellOf = (text: string) =>
		page.getByText(text, { exact: true }).element().closest<HTMLElement>('.cell')!;

	it('marks the picked cell, its column header and its row number', async () => {
		const { container } = render(DataGrid, {
			props: { ws: makeWorkspace(), onInsert: () => {} }
		});
		await userEvent.click(page.getByText('Kwame Boateng'));
		expect(cellOf('Kwame Boateng').classList.contains('active')).toBe(true);
		expect(container.querySelectorAll('.cell.active')).toHaveLength(1);
		const header = container.querySelector('.head-cell.active-col');
		expect(header?.textContent).toContain('Customer');
		const gutter = container.querySelector('.gutter.active-row');
		expect(gutter?.textContent?.trim()).toBe('2');
	});

	it('moves the marks when another cell is picked, and drops them when the reader closes', async () => {
		const ws = makeWorkspace();
		const { container } = render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.click(page.getByText('Kwame Boateng'));
		await userEvent.click(page.getByText('Is there a discount?'));
		expect(container.querySelectorAll('.cell.active')).toHaveLength(1);
		expect(cellOf('Is there a discount?').classList.contains('active')).toBe(true);
		ws.clearActiveCell();
		await expect.poll(() => container.querySelectorAll('.cell.active').length).toBe(0);
		expect(container.querySelector('.active-col, .active-row')).toBeNull();
	});

	it('rings the cell being edited, with the input filling it edge to edge', async () => {
		const { container } = render(DataGrid, {
			props: { ws: makeWorkspace(), onInsert: () => {} }
		});
		await userEvent.dblClick(page.getByText('Ines Moreau'));
		const editing = container.querySelector<HTMLElement>('.cell.editing')!;
		expect(editing).not.toBeNull();
		expect(container.querySelectorAll('.cell.editing')).toHaveLength(1);
		expect(getComputedStyle(editing).boxShadow).toContain('inset');
		const input = editing.querySelector<HTMLInputElement>('input')!;
		expect(document.activeElement).toBe(input);
		expect(getComputedStyle(input).borderTopWidth).toBe('0px');
		expect(input.getBoundingClientRect().width).toBeGreaterThan(editing.clientWidth * 0.8);
	});

	it('lifts the edited cell off a ticked row so the selection stays visible', async () => {
		const ws = makeWorkspace();
		ws.tickRows(['r2']);
		const { container } = render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.dblClick(page.getByText('Kwame Boateng'));
		const editing = container.querySelector<HTMLElement>('.cell.editing')!;
		const row = editing.closest<HTMLElement>('.row')!;
		expect(row.classList.contains('selected')).toBe(true);
		expect(getComputedStyle(editing).backgroundColor).not.toBe(
			getComputedStyle(row).backgroundColor
		);
	});

	it('clears the editing ring on Enter and keeps the cell selected', async () => {
		const ws = makeWorkspace();
		const { container } = render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.dblClick(page.getByText('Ines Moreau'));
		await userEvent.keyboard('{End} (EU)');
		await userEvent.keyboard('{Enter}');
		expect(container.querySelector('.cell.editing')).toBeNull();
		expect(ws.rows[0].cells.c1).toBe('Ines Moreau (EU)');
		expect(cellOf('Ines Moreau (EU)').classList.contains('active')).toBe(true);
	});

	it('does not reopen the cell it just saved', async () => {
		// The grid treats Enter as "edit this cell"; the save must not reach it.
		const ws = makeWorkspace();
		const start = vi.spyOn(ws, 'startEditing');
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.dblClick(page.getByText('Ines Moreau'));
		await userEvent.keyboard('{Enter}');
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(start).toHaveBeenCalledTimes(1);
	});

	it('hands focus back to the cell, so the arrow keys carry on', async () => {
		const ws = makeWorkspace();
		render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.dblClick(page.getByText('Ines Moreau'));
		await userEvent.keyboard('{Enter}');
		await expect.poll(() => document.activeElement?.getAttribute('data-cell')).toBe('0-0');
		await userEvent.keyboard('{ArrowDown}');
		expect(ws.activeCell).toEqual({ rowId: 'r2', columnId: 'c1' });
	});

	it('clears the editing ring on Escape without saving', async () => {
		const ws = makeWorkspace();
		const { container } = render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.dblClick(page.getByText('Ines Moreau'));
		await userEvent.keyboard('{End} changed{Escape}');
		expect(container.querySelector('.cell.editing')).toBeNull();
		expect(ws.rows[0].cells.c1).toBe('Ines Moreau');
	});

	it('marks a cell opened from the keyboard the same way', async () => {
		const ws = makeWorkspace();
		const { container } = render(DataGrid, { props: { ws, onInsert: () => {} } });
		await userEvent.click(page.getByText('Ines Moreau'));
		await userEvent.keyboard('{ArrowDown}{F2}');
		const editing = container.querySelector<HTMLElement>('.cell.editing')!;
		expect(editing.querySelector('input')?.value).toBe('Kwame Boateng');
		expect(editing.classList.contains('active')).toBe(true);
	});
});

describe('grid dressing', () => {
	function dressedWorkspace(): Workspace {
		const ws = new Workspace();
		ws.project = {
			id: 'p3',
			ownerId: 'u1',
			name: 'Expense requests',
			fileName: null,
			createdAt: 0,
			updatedAt: 0,
			columns: [
				{ id: 'who', name: 'Requester', generated: false },
				{ id: 'amt', name: 'Amount', generated: false },
				{ id: 'day', name: 'Date', generated: false },
				{ id: 'dec', name: 'Decision', generated: true },
				{ id: 'sum', name: 'Summary', generated: true }
			],
			rows: [
				{
					id: 'r1',
					cells: {
						who: 'Ines Moreau',
						amt: '240',
						day: '2026-02-03',
						dec: 'Approve',
						sum: 'An annual licence that replaces three one-off purchases.'
					}
				},
				{
					id: 'r2',
					cells: {
						who: 'Tomasz Wierzbicki',
						amt: '1,850',
						day: '2026-02-04',
						dec: 'Reject',
						sum: 'Flights booked without the pre-approval the policy asks for.'
					}
				},
				{
					id: 'r3',
					cells: {
						who: 'Amara Okonkwo',
						amt: '89',
						day: '2026-02-05',
						dec: 'Approve',
						sum: 'Two methodology books for the retention study.'
					}
				}
			],
			config: defaultConfig()
		};
		ws.loading = false;
		ws.touch = () => {};
		return ws;
	}

	const header = (container: HTMLElement, name: string) =>
		[...container.querySelectorAll<HTMLElement>('.head-cell')].find((cell) =>
			cell.textContent?.includes(name)
		)!;

	it('marks each column with what it holds', async () => {
		const { container } = render(DataGrid, {
			props: { ws: dressedWorkspace(), onInsert: () => {} }
		});
		await expect.element(page.getByText('Ines Moreau')).toBeVisible();
		const kinds = ['Requester', 'Amount', 'Date', 'Decision'].map((name) =>
			header(container, name).querySelector('.kind')?.getAttribute('title')
		);
		expect(kinds).toEqual(['Text', 'Numbers', 'Dates', 'Generated by a prompt']);
	});

	it('right-aligns number columns, header and cells alike', async () => {
		const { container } = render(DataGrid, {
			props: { ws: dressedWorkspace(), onInsert: () => {} }
		});
		await expect.element(page.getByText('1,850')).toBeVisible();
		expect(header(container, 'Amount').classList.contains('numeric')).toBe(true);
		const cell = page.getByText('1,850').element().closest('.cell')!;
		expect(getComputedStyle(cell).justifyContent).toBe('flex-end');
	});

	it('shows short answers as labels, coloured by meaning', async () => {
		render(DataGrid, { props: { ws: dressedWorkspace(), onInsert: () => {} } });
		const approve = page.getByText('Approve').first().element();
		const reject = page.getByText('Reject').element();
		expect(approve.classList.contains('tag')).toBe(true);
		expect(approve.classList.contains('tone-2')).toBe(true);
		expect(reject.classList.contains('tone-6')).toBe(true);
		expect(getComputedStyle(approve).backgroundColor).not.toBe(
			getComputedStyle(reject).backgroundColor
		);
	});

	it('leaves long generated text as plain text', async () => {
		render(DataGrid, { props: { ws: dressedWorkspace(), onInsert: () => {} } });
		const summary = page.getByText(/^An annual licence/).element();
		expect(summary.classList.contains('tag')).toBe(false);
	});

	it('keeps column menus out of sight until the header is hovered', async () => {
		const { container } = render(DataGrid, {
			props: { ws: dressedWorkspace(), onInsert: () => {} }
		});
		const button = page.getByRole('button', { name: 'Options for Amount' });
		await expect.element(button).toBeInTheDocument();
		expect(getComputedStyle(button.element()).opacity).toBe('0');
		await userEvent.hover(header(container, 'Amount'));
		await expect.poll(() => getComputedStyle(button.element()).opacity).toBe('1');
	});

	it('scrolls a run’s column into view when the run starts', async () => {
		const ws = dressedWorkspace();
		const target = document.createElement('div');
		target.style.cssText = 'height: 300px; width: 420px;';
		document.body.append(target);
		try {
			render(DataGrid, { props: { ws, onInsert: () => {} }, target });
			const grid = document.querySelector<HTMLElement>('[role="grid"]')!;
			expect(grid.scrollLeft).toBe(0);
			ws.lastRunColumnId = 'sum';
			ws.runStartedAt = Date.now();
			await expect.poll(() => grid.scrollLeft).toBeGreaterThan(0);
			const summaryHeader = header(target, 'Summary').getBoundingClientRect();
			expect(summaryHeader.right).toBeLessThanOrEqual(grid.getBoundingClientRect().right + 1);
		} finally {
			target.remove();
		}
	});
});
