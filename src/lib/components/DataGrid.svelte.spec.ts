import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DataGrid from './DataGrid.svelte';
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
