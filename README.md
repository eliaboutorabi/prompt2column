# prompt2column

Add a column to a spreadsheet by writing one prompt. The prompt runs once per
row against a model on your own machine through [Ollama](https://ollama.com).
Nothing leaves the browser.

## Running it

```bash
npm install
npm run dev
```

Ollama needs to be running (`ollama serve`) with at least one model pulled. The
app scans `http://localhost:11434` on load; the address is editable under
Advanced in the composer.

## What it does

- **Import** a CSV by drop or file picker, or start from one of three bundled
  samples in `static/samples/`.
- **Write a prompt** with `{{Column name}}` references. The editor highlights
  them, autocompletes as you type `{{`, and column headers in the sheet insert a
  reference on click.
- **Pick an answer shape.** Label (a closed list), yes/no with your own two
  words, number in a range, or free text with a word budget. The shape becomes a
  JSON schema that Ollama constrains generation with, so the model returns the
  value and nothing else. A reply that still lands outside the shape is repaired
  where possible, then retried once, then reported on the row.
- **Choose the rows**: all, first N, a range, ticked rows, or only rows whose
  result cell is still empty.
- **Watch it run** with per-row status, pause, resume, stop and retry-failed.
- **Find cells** with the search bar above the sheet, or ⌘F / Ctrl F. It ignores
  case and accents, can be limited to one column, highlights every hit, and steps
  through them with Enter and Shift Enter. It searches the data rather than the
  page, so it finds rows the grid has not drawn yet. "Tick rows" selects every
  row with a match, ready for a run on ticked rows only.
- **Export** the sheet back to CSV.

Projects live in IndexedDB under a local account. Accounts keep projects apart on
a shared computer; they are not server authentication and the stored data is not
encrypted.

## Layout

```
src/lib/core/       framework-free domain code (template, output, runner, csv, ollama, db, auth)
src/lib/state/      Svelte 5 rune stores (session, workspace, models, theme)
src/lib/components/ UI
src/routes/         / projects and sign-in, /app the workspace
e2e/                Playwright flows against a mocked Ollama
```

## Tests

```bash
npm run test:unit -- --run   # node and browser tests
npm run test:e2e             # Playwright flows
npm run check                # svelte-check
```

The end-to-end tests mock the Ollama endpoints, so they need no model and no GPU.

## Not done yet

- Excel import and export. `src/lib/core/csv.ts` is the seam for it.
- No way to read a long generated cell in full beyond the tooltip.
