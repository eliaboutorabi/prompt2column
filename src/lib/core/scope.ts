/** Works out exactly which rows a run will touch. */
import type { ColumnId, Row, RowId, RowScope } from './types';

export interface ScopeInput {
	scope: RowScope;
	rows: Row[];
	selected: Set<RowId>;
	/** Column the run writes into, null before it exists. */
	targetColumnId: ColumnId | null;
	/** When false, rows whose target cell already has a value are skipped. */
	overwrite: boolean;
}

export function resolveScope(input: ScopeInput): Row[] {
	const { scope, rows, selected, targetColumnId, overwrite } = input;
	let candidates: Row[];
	switch (scope.kind) {
		case 'selected':
			candidates = rows.filter((row) => selected.has(row.id));
			break;
		case 'range': {
			const lo = Math.max(1, Math.min(scope.from, scope.to));
			const hi = Math.min(rows.length, Math.max(scope.from, scope.to));
			candidates = lo > rows.length ? [] : rows.slice(lo - 1, hi);
			break;
		}
		case 'first':
			candidates = rows.slice(0, Math.max(0, scope.count));
			break;
		case 'empty':
			candidates = targetColumnId
				? rows.filter((row) => (row.cells[targetColumnId] ?? '').trim() === '')
				: rows.slice();
			break;
		default:
			candidates = rows.slice();
	}
	if (overwrite || !targetColumnId || scope.kind === 'empty') return candidates;
	return candidates.filter((row) => (row.cells[targetColumnId] ?? '').trim() === '');
}

export function describeScope(scope: RowScope, rowCount: number, selectedCount: number): string {
	switch (scope.kind) {
		case 'selected':
			return selectedCount === 1 ? '1 selected row' : `${selectedCount} selected rows`;
		case 'range':
			return `rows ${Math.min(scope.from, scope.to)} to ${Math.min(Math.max(scope.from, scope.to), rowCount)}`;
		case 'first':
			return `first ${Math.min(scope.count, rowCount)} rows`;
		case 'empty':
			return 'rows with an empty result';
		default:
			return rowCount === 1 ? 'the only row' : `all ${rowCount} rows`;
	}
}
