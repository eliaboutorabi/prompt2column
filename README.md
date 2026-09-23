# prompt2column

Add a column to a spreadsheet by writing a single prompt. The prompt runs once per
row against a language model on your own machine through
[Ollama](https://ollama.com), and each answer lands in the new column.

It's good at jobs like labelling support tickets by sentiment, approving or rejecting
expense claims against a policy, or summarizing long notes into one line. Answers
are constrained to the shape you choose, so a classification column contains
labels, not "Sure! Here is the label you asked for".

Everything runs in the browser. Your file, your prompts and the model's answers
never leave your computer.

## Quick start

You need **Node 20.19+** (or 22.12+) and **Ollama** with at least one model.

```bash
# 1. Get a model, if you don't have one yet
ollama pull llama3.2

# 2. Make sure Ollama is running (the desktop app does this for you)
ollama serve

# 3. Install and start prompt2column
npm install
npm run dev
```

Open <http://localhost:5173>, create a local workspace, and load one of the sample
sheets to try it without your own data.

## How it works

1. **Sign in.** Pick a name and passphrase. This keeps your projects apart from
   anyone else using the same browser (see [Privacy and storage](#privacy-and-storage)).
2. **Import a sheet.** Drop a CSV or pick one of the three samples. The first row
   becomes the column headers.
3. **Write the prompt.** Reference columns with `{{Column name}}`. A preset
   (Classify, Approve or reject, Summarize, Score) gives you a starting draft.
4. **Name the new column** and **choose the answer shape**: a label, yes or no, a
   number or free text.
5. **Choose the rows**: all of them, a range, the ones you ticked, and so on.
6. **Preview** the exact prompt one row will send, and test it on that row
   without writing anything.
7. **Run it.** Cells fill in as answers arrive. You can pause, resume, stop, and
   retry only the rows that failed.
8. **Export** the finished sheet as CSV.

Projects save automatically, so you can close the tab and pick up later.

## Writing prompts

A prompt is plain text with column references in double braces:

```text
Classify this support ticket by sentiment.

Customer: {{Customer}}
Message: {{Message}}
```

- **Autocomplete.** Type `{{` (or `@`, or Ctrl Space) and the editor suggests
  columns. Arrow keys pick one, and Enter or Tab inserts it.
- **Click to insert.** Clicking a column header in the sheet, or a column chip
  under the editor, adds that reference at the cursor.
- **Forgiving names.** `{{ customer }}` and `{{Customer}}` point at the same
  column.
- **Checked as you type.** A reference that matches no column is underlined in
  red, and the run stays disabled until it's fixed. A prompt with no references
  gets a warning, since every row would get the same answer.
- **Renames carry over.** Renaming a column updates every reference to it in the
  prompt.

Rows where every referenced cell is empty are skipped and marked as failed rather
than sent to the model, which would only make something up.

## Answer shapes

The shape you choose becomes a JSON schema that Ollama enforces while it
generates. The model returns the value and nothing else: no greeting, no
explanation, no markdown.

| Shape         | Writes into the cell        | Options                                      |
| ------------- | --------------------------- | -------------------------------------------- |
| **Label**     | One label from your list    | Optionally accept answers outside the list   |
| **Yes / no**  | One of two words you choose | For example `Approve` and `Reject`           |
| **Number**    | A number                    | Lowest and highest value, whole numbers only |
| **Free text** | A single line of text       | A rough word budget (25 by default)          |

If a reply still misses (a label with the wrong case, say, or a number buried in
a sentence), it's repaired where the intent is clear. Otherwise the row is retried
once, and the model is told why its first answer was rejected. If that fails too,
the row is marked as failed and shows the reason.

## Choosing rows

| Option            | Runs on                                                        |
| ----------------- | -------------------------------------------------------------- |
| **Every row**     | The whole sheet                                                |
| **First few**     | The first N rows, handy for a trial run                        |
| **A range**       | Rows _from_ to _to_, inclusive                                 |
| **Ticked rows**   | Rows you ticked in the sheet or with search                    |
| **Empty results** | Rows whose result cell is still blank, to finish a stopped run |

Untick **Replace values that are already there** to leave filled cells alone. The
composer always shows how many rows the run will touch before you start it.

## Finding cells

The search bar above the sheet finds cells anywhere in the data, including rows
the grid hasn't drawn yet (the browser's own find can't see those).

- It ignores capital letters and accents, so `kovacs` finds `Kovács`.
- You can limit it to one column.
- Every match is highlighted, and the current one is outlined and scrolled into
  view. In long text cells, the cell shows the part around the match.
- **Tick N rows** ticks every row with a match. Switch the run to **Ticked rows**
  to run the prompt on exactly those rows.

## Keyboard shortcuts

| Where          | Keys                      | Does                          |
| -------------- | ------------------------- | ----------------------------- |
| In a sheet     | ⌘F / Ctrl F               | Go to the search bar          |
| In a sheet     | ⌘G / Ctrl G, add Shift    | Next or previous match        |
| Search bar     | Enter / Shift Enter       | Next or previous match        |
| Search bar     | Esc                       | Clear the search              |
| Prompt editor  | `{{`, `@` or Ctrl Space   | Suggest columns               |
| Suggestions    | ↑ ↓, then Enter or Tab    | Insert the highlighted column |
| Sheet          | Arrow keys                | Move between cells            |
| Sheet          | Enter, F2 or double click | Edit the cell                 |
| Sheet          | Space                     | Tick or untick the row        |
| Editing a cell | Enter / Esc               | Save or cancel                |

## Sample sheets

These live in `static/samples/`. Each one opens with the preset that suits it.

| File                   | Rows | Try it with                                     |
| ---------------------- | ---- | ----------------------------------------------- |
| `support-tickets.csv`  | 15   | **Classify**: sentiment or topic labels         |
| `expense-requests.csv` | 15   | **Approve or reject**: against a policy cap     |
| `research-notes.csv`   | 12   | **Summarize**: long interview notes to one line |

## Settings

**Advanced**, at the bottom of the composer, has:

| Setting                          | Default                  | Notes                                                   |
| -------------------------------- | ------------------------ | ------------------------------------------------------- |
| Rows at once                     | 2                        | Parallel requests. Raise it if your machine has room.   |
| Temperature                      | 0                        | 0 gives the most repeatable answers.                    |
| Ollama address                   | `http://localhost:11434` | Remembered in the browser.                              |
| Let thinking models reason first | Off                      | Lets reasoning models think before they answer. Slower. |

**Rescan**, next to the model picker, reloads the list after you pull a new
model.

## Privacy and storage

- The CSV is read in the browser. It isn't uploaded anywhere.
- Apart from loading the app itself, the only requests go to your Ollama address.
- Projects are saved in the browser's IndexedDB and are private to that browser
  profile. Clearing site data deletes them, so export anything you want to keep.
- Accounts are **local**. Passphrases are never stored: the app keeps a salted
  PBKDF2 hash (210,000 rounds) and checks your passphrase against it. Accounts
  keep projects apart on a shared computer. They are **not** server
  authentication, and the saved project data isn't encrypted.
- **Stay signed in** keeps your session after the browser closes. Leave it off on
  a shared machine.

## Building and hosting

```bash
npm run build     # static site written to build/
npm run preview   # serve that build locally
```

The build is a plain static site, so any static host can serve it. Ollama only
accepts browser requests from localhost pages by default. If you serve the app
from another address, add it to Ollama's allowed origins:

```bash
OLLAMA_ORIGINS="https://your-host.example" ollama serve
```

## Development

| Command                      | Does                                                |
| ---------------------------- | --------------------------------------------------- |
| `npm run dev`                | Dev server on port 5173                             |
| `npm run check`              | Type-check with svelte-check                        |
| `npm run lint`               | Prettier and ESLint                                 |
| `npm run format`             | Format everything with Prettier                     |
| `npm run test:unit -- --run` | Unit tests (Node) and component tests (Chromium)    |
| `npm run test:e2e`           | Build, serve on port 4173, run the Playwright flows |
| `npm test`                   | Both test suites                                    |

None of the tests need a model or a GPU. The Ollama client and the runner are
tested against fakes, and the end-to-end flows stand in for Ollama's HTTP
endpoints.

### Project layout

```
src/lib/core/        Domain logic with no framework code: the template language, answer
                     shapes, the run engine, CSV, search, the Ollama client,
                     IndexedDB storage and local accounts
src/lib/state/       Svelte 5 rune stores: session, open workspace, models, theme
src/lib/components/  UI: data grid, prompt editor, composer, search bar, dialogs
src/routes/          /      sign-in and project list
                     /app   the workspace (?p=<project id>)
static/samples/      The bundled CSV files
e2e/                 Playwright flows
```

Built with SvelteKit (static adapter), Svelte 5, Tailwind CSS 4, Papa Parse and
Phosphor icons.

## Troubleshooting

**"Cannot reach Ollama"** means Ollama isn't running, or it's on a different
address. Start it with `ollama serve`, check the address under Advanced, then
click Rescan.

**"Ollama is running but has no models"** means you need to pull one, for example
`ollama pull llama3.2`, then click Rescan.

**Ollama is running, but the app still says it can't reach it.** If the app is
served from anywhere other than localhost, Ollama rejects its requests. Add that
address to `OLLAMA_ORIGINS`, as shown in [Building and hosting](#building-and-hosting).

**Runs are slow.** Local models run at the speed of your hardware. Test on a few
rows first with **First few**, try a smaller model, and only raise **Rows at once**
if your machine has spare capacity. The first request after a while also waits for
the model to load.

**`npm run test:e2e` stops with "port 4173 is already used".** Another preview
server is using that port. Stop it, or run Playwright with a config that serves
on a different port.

## Not done yet

- Excel files (`.xlsx`) for import and export. `src/lib/core/csv.ts` is where
  that will go.
- A way to read a long generated cell in full. For now it's shown in the cell's
  tooltip.
