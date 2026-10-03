// The tutorial: what Ellie says, and what happens on screen as she says it.
// Each cue fires on a phrase of its segment ("at"), so a click lands on the word.

const by = (name, locator, anchor, extra = {}) => ({ name, locator, anchor, ...extra });

// Where things are, found fresh at the moment they're needed.
export const T = {
	rest: { x: 1150, y: 520 },
	headline: by('headline', (p) => p.locator('h1.headline'), [0.42, 0.78]),
	demoPrompt: by('demo prompt', (p) => p.locator('.demo-prompt'), [0.36, 0.42]),
	demoColumn: by('demo column', (p) => p.locator('th.gen'), [0.55, 0.5]),
	demoLabel: (i) => by(`demo label ${i}`, (p) => p.locator('td.gen .tag').nth(i), [0.5, 0.55]),
	pill: by('pill', (p) => p.locator('.pill'), [0.62, 0.55]),
	fact: (i) => by(`fact ${i}`, (p) => p.locator('.facts li').nth(i), [0.3, 0.55]),
	authName: by('name field', (p) => p.locator('#auth-name'), [0.3, 0.5]),
	authPass: by('passphrase field', (p) => p.locator('#auth-pass'), [0.3, 0.5]),
	create: by('create', (p) => p.getByRole('button', { name: 'Create workspace' }), [0.5, 0.55]),
	dropzone: by(
		'dropzone',
		(p) => p.getByText('Drop a CSV here or click to choose one'),
		[0.4, 0.6]
	),
	sample: (name) => by(name, (p) => p.locator('button.sample', { hasText: name }), [0.4, 0.42]),
	project: (name) =>
		by(`project ${name}`, (p) => p.locator('li.card', { hasText: name }), [0.42, 0.45]),
	header: (name, anchor = [0.45, 0.5]) =>
		by(
			`header ${name}`,
			(p) => p.getByRole('columnheader', { name: new RegExp(`^${name}`) }),
			anchor
		),
	cell: (row, col, anchor = [0.3, 0.5]) =>
		by(`cell ${row}-${col}`, (p) => p.locator(`[data-cell="${row}-${col}"]`), anchor),
	grid: by('grid', (p) => p.locator('[data-cell="5-2"]'), [0.5, 0.5]),
	readerText: by(
		'reader',
		(p) => p.getByRole('region', { name: 'Cell reader' }).locator('.text'),
		[0.32, 0.3]
	),
	columnName: by('column name', (p) => p.locator('#target-name'), [0.62, 0.5]),
	panelTop: by('panel', (p) => p.locator('#target-name'), [0.3, -0.9]),
	job: by('job', (p) => p.getByRole('combobox', { name: 'Job' }), [0.5, 0.5]),
	option: (name, anchor = [0.3, 0.5]) =>
		by(`option ${name}`, (p) => p.getByRole('option', { name: new RegExp(name) }), anchor),
	badge: (model, text) =>
		by(
			`badge ${text}`,
			(p) =>
				p.getByRole('option', { name: new RegExp(model) }).locator('.badge', { hasText: text }),
			[0.5, 0.5]
		),
	editor: (anchor = [0.3, 0.12]) => by('editor', (p) => p.locator('#prompt-editor'), anchor),
	token: (name) =>
		by(`token ${name}`, (p) => p.locator('.composer .token', { hasText: name }), [0.6, 0.55]),
	insertColumn: by(
		'insert column',
		(p) => p.getByRole('button', { name: 'Insert column' }),
		[0.5, 0.5]
	),
	preview: by(
		'preview',
		(p) => p.getByRole('button', { name: 'Preview', exact: true }),
		[0.55, 0.5]
	),
	radio: (name) =>
		by(`radio ${name}`, (p) => p.getByRole('radio', { name: new RegExp(name) }), [0.5, 0.5]),
	tag: (i) => by(`tag ${i}`, (p) => p.locator('.choices .tag').nth(i), [0.45, 0.5]),
	rules: by('rules', (p) => p.locator('#instructions'), [0.35, 0.5]),
	rows: by('rows to run', (p) => p.getByRole('combobox', { name: 'Rows to run' }), [0.4, 0.5]),
	firstCount: by('first count', (p) => p.getByLabel('How many rows from the top'), [0.4, 0.5]),
	conn: by('connection', (p) => p.locator('.dock .conn'), [0.12, 0.5]),
	dock: by('dock', (p) => p.locator('.dock .status'), [0.5, 0.5]),
	dockEdge: by('dock edge', (p) => p.locator('.dock'), [0.45, 0.02]),
	model: by('model', (p) => p.getByRole('combobox', { name: 'Model' }), [0.45, 0.5]),
	settings: by('settings', (p) => p.getByRole('button', { name: 'Run settings' }), [0.5, 0.5]),
	field: (id) => by(id, (p) => p.locator(`#${id}`), [0.35, 0.5]),
	run: by('run', (p) => p.getByRole('button', { name: /Run on/ }), [0.5, 0.5]),
	pause: by('pause', (p) => p.getByRole('button', { name: 'Pause' }), [0.5, 0.5]),
	system: by('system message', (p) => p.locator('dialog pre.system'), [0.25, 0.3]),
	rowPrompt: by('row prompt', (p) => p.locator('dialog pre.block').nth(1), [0.25, 0.25]),
	testRow: by('test row', (p) => p.getByRole('button', { name: 'Test this row' }), [0.5, 0.5]),
	answer: by('answer', (p) => p.locator('dialog .answer .tag'), [0.5, 0.5]),
	closePreview: by(
		'close preview',
		(p) => p.getByRole('button', { name: 'Close preview' }),
		[0.5, 0.5]
	),
	columnMenu: (name) =>
		by(`menu ${name}`, (p) => p.getByRole('button', { name: `Options for ${name}` }), [0.5, 0.5]),
	tally: (label) =>
		by(
			`tally ${label}`,
			(p) => p.getByRole('menuitem', { name: new RegExp(`^${label}:`) }),
			[0.3, 0.5]
		),
	untick: by('untick', (p) => p.getByRole('button', { name: 'Untick every row' }), [0.5, 0.5]),
	exportButton: by('export', (p) => p.getByRole('button', { name: 'Export' }), [0.5, 0.5]),
	csv: by('csv', (p) => p.getByRole('menuitem', { name: /^CSV/ }), [0.3, 0.5]),
	projects: by(
		'projects',
		(p) => p.getByRole('link', { name: 'Projects', exact: true }),
		[0.5, 0.5]
	),
	brand: by('brand', (p) => p.getByRole('link', { name: 'Back to projects' }), [0.5, 0.5])
};

// Cue makers. `at` is a phrase in the segment; the action lands as it's spoken.
export const glide = (target, opts = {}) => ({ kind: 'glide', target, ...opts });
export const click = (target, opts = {}) => ({ kind: 'click', target, ...opts });
export const type = (text, opts = {}) => ({ kind: 'type', text, ...opts });
export const key = (combo, opts = {}) => ({ kind: 'key', combo, ...opts });
export const card = (name, role, opts = {}) => ({ kind: 'card', name, role, ...opts });

const C = (at, action, more = {}) => ({ at, ...more, action });

export const SEGMENTS = [
	// The landing page: who I am, what the app does, and why.
	{
		id: 'intro',
		chapter: 'Introduction',
		text: "Hi, I'm Ellie Aboutorabi. I'm an AI-enabled accountant, and in this video I'll show you prompt to column, a small app I built that adds a new column to a spreadsheet with a single prompt.",
		cues: [
			C('Hi', card('Ellie Aboutorabi', 'AI-enabled accountant', { show: 0.35, hide: 8.6 })),
			C('prompt to column', glide(T.headline, { dur: 1.1 }))
		]
	},
	{
		id: 'what',
		text: "You write one prompt, like this one, and the app runs it once for every row of your sheet. Each answer lands in a new column. Here, that's a sentiment label for every customer message.",
		cues: [
			C('like this one', glide(T.demoPrompt, { dur: 0.9 })),
			C('new column', glide(T.demoColumn)),
			C('every customer message', glide(T.demoLabel(2), { dur: 0.9 }))
		]
	},
	{
		id: 'why',
		chapter: 'Why I built it',
		text: "So why did I build it? In accounting and finance, the tables are big: transactions, expense claims, customer messages, survey answers. Language models are great at reading a row and making a judgement call, like a category, an approve or reject, a score, or a one-line summary. But when you have hundreds of thousands, or even millions, of rows, sending every single row to an expensive frontier model adds up very quickly. And for most of these jobs, you don't need the biggest model at all.",
		cues: [C('So why', glide(T.rest, { dur: 1.2 }))]
	},
	{
		id: 'ollama',
		chapter: 'What Ollama is',
		text: "That's where Ollama comes in. Ollama is a free tool that runs open models, like Gemma, Llama or Mistral, right on your own computer. It can also run bigger open models in Ollama's cloud, which comes with a free allowance. So instead of paying per token to a big AI provider, you can run these jobs on a local model for free, or on a cloud model within that allowance.",
		cues: [C('Ollama comes in', glide(T.pill, { dur: 1.0 }))]
	},
	{
		id: 'facts',
		text: 'With a local model, nothing leaves your computer. You decide the exact shape of every answer. And your sheet comes in as a CSV, and goes out as CSV or JSON.',
		cues: [
			C('nothing leaves', glide(T.fact(0), { dur: 1.0 })),
			C('exact shape', glide(T.fact(1))),
			C('comes in as', glide(T.fact(2)))
		]
	},

	// A workspace, then the projects page.
	{
		id: 'signup',
		chapter: 'Creating a workspace',
		pause: 0.6,
		text: "Let's try it. First, I'll create a workspace. It's just a name and a passphrase that keep my projects separate from anyone else using this browser. Everything stays in the browser, so there's nothing to sign up for.",
		cues: [
			C("Let's try", click(T.authName, { dur: 1.1 })),
			C('just a name', type('ellie', { delay: 0.25 })),
			C('passphrase', click(T.authPass)),
			C('passphrase', type('ledger-and-ink', { delay: 0.35, cps: 16 })),
			C('sign up for', click(T.create, { dur: 0.8, delay: 0.55 }))
		]
	},
	{
		id: 'projects',
		pause: 0.9,
		text: "This is my projects page. I can drop in any CSV file, or start from one of three sample sheets: support tickets, expense requests, and research notes. Let's begin with the support tickets.",
		cues: [
			C('drop in any', glide(T.dropzone, { dur: 0.9 })),
			C('support tickets', glide(T.sample('Support tickets'))),
			C('expense requests', glide(T.sample('Expense requests'))),
			C('research notes', glide(T.sample('Research notes'))),
			C('the support tickets', click(T.sample('Support tickets'), { dur: 0.9, delay: 0.5 }))
		]
	},

	// Support tickets: the tour, then a classification run.
	{
		id: 'sheet',
		chapter: 'Example 1: support tickets',
		pause: 1.1,
		text: 'The workspace has two parts. On the right is the sheet: fifteen support tickets, each with a ticket number, the customer, their plan, the channel, and the message itself.',
		cues: [
			C('On the right', glide(T.grid, { dur: 0.9 })),
			C('ticket number', glide(T.cell(1, 0, [0.45, 0.5]))),
			C('the customer', glide(T.cell(1, 1, [0.4, 0.5]), { dur: 0.5 })),
			C('their plan', glide(T.cell(1, 2, [0.3, 0.5]), { dur: 0.45 })),
			C('the channel', glide(T.cell(1, 3, [0.3, 0.5]), { dur: 0.45 })),
			C('the message', glide(T.cell(1, 4, [0.35, 0.5]), { dur: 0.5 }))
		]
	},
	{
		id: 'reader',
		text: 'When a message is too long to read, I click the cell, and the bar above the sheet shows the whole thing.',
		cues: [
			C('I click', click(T.cell(0, 4, [0.55, 0.5]), { dur: 0.7, delay: 0.25 })),
			C('the bar above', glide(T.readerText, { dur: 0.8 }))
		]
	},
	{
		id: 'panel',
		text: "On the left is the panel where I describe the new column. This sample opens with a classification job already set up, so let's go through it from the top.",
		cues: [C('On the left', glide(T.panelTop, { dur: 1.1 }))]
	},
	{
		id: 'name',
		chapter: 'Setting up the column',
		text: "First, the name of the new column. I'll call it Sentiment.",
		cues: [
			C('the name', click(T.columnName, { dur: 0.6 })),
			C("I'll call it", key('ControlOrMeta+a', { delay: 0.25 })),
			C("I'll call it", type('Sentiment', { delay: 0.5, cps: 14 }))
		]
	},
	{
		id: 'job',
		text: 'Next to it is the job. There are five to choose from: classify, approve or reject, summarize, score, or a custom prompt of your own. Each one fills in a sensible first draft for everything below it.',
		cues: [
			C('the job', click(T.job, { dur: 0.6 })),
			C('classify', glide(T.option('Classify'), { dur: 0.45 })),
			C('approve or reject', glide(T.option('Approve or reject'), { dur: 0.4 })),
			C('summarize', glide(T.option('Summarize'), { dur: 0.4 })),
			C('score', glide(T.option('Score'), { dur: 0.4 })),
			C('custom prompt', glide(T.option('Custom'), { dur: 0.4 })),
			C('everything below', key('Escape', { delay: 0.6, blur: true })),
			C('everything below', glide(T.editor([0.55, 0.45]), { dur: 0.8, delay: 0.9 }))
		]
	},
	{
		id: 'prompt',
		text: "Then comes the prompt. It's plain text, and anything inside double curly braces is a column from the sheet. For each row, those are swapped for that row's values. To add one, I can type two curly braces, use Insert column, or simply click a column header in the sheet.",
		cues: [
			C('Then comes', glide(T.editor([0.3, 0.1]), { dur: 0.6 })),
			C('double curly braces', glide(T.token('Message'), { dur: 0.7 })),
			C('swapped', glide(T.token('Customer'), { dur: 0.6 })),
			C('type two', glide(T.editor([0.62, 0.62]), { dur: 0.6 })),
			C('Insert column', glide(T.insertColumn, { dur: 0.6 })),
			C('column header', glide(T.header('Customer', [0.5, 0.5]), { dur: 1.0 }))
		]
	},
	{
		id: 'answer',
		text: 'Below the prompt, I choose the shape of the answer. For sentiment, I want a label, and only one of these three: positive, neutral, or negative. I could also ask for a yes or no, a number, or a short piece of text.',
		cues: [
			C('Below the prompt', glide(T.radio('Label'), { dur: 1.1 })),
			C('positive', glide(T.tag(0), { dur: 0.45 })),
			C('neutral', glide(T.tag(1), { dur: 0.4 })),
			C('negative', glide(T.tag(2), { dur: 0.4 })),
			C('yes or no', glide(T.radio('Yes'), { dur: 0.5 })),
			C('a number', glide(T.radio('Number'), { dur: 0.4 })),
			C('short piece', glide(T.radio('Text'), { dur: 0.4 }))
		]
	},
	{
		id: 'shape',
		text: 'The app tells the model exactly what shape it wants, and checks every reply. With a local model, Ollama even holds the model to that shape while it writes. Anything that still comes back a little off gets repaired, or asked for again. So every cell gets a clean label, not a chatty sentence.',
		cues: [C('clean label', glide(T.tag(1), { dur: 0.8 }))]
	},
	{
		id: 'rows',
		text: "Rules are optional extra instructions. Here, the model is told to judge only what the text says. And under Rows to run, I can pick every row, just the first few for a quick test, a range, the rows I've ticked, or only the cells that are still empty.",
		cues: [
			C('Rules are', glide(T.rules, { dur: 0.7 })),
			C('Rows to run', click(T.rows, { dur: 0.6 })),
			C('every row', glide(T.option('Every row'), { dur: 0.4 })),
			C('first few', glide(T.option('First few'), { dur: 0.4 })),
			C('a range', glide(T.option('A range'), { dur: 0.4 })),
			C('ticked', glide(T.option('Ticked rows'), { dur: 0.4 })),
			C('still empty', glide(T.option('Empty results'), { dur: 0.4 })),
			C('still empty', key('Escape', { delay: 0.9, blur: true }))
		]
	},

	// The dock: model, settings, preview, run.
	{
		id: 'model',
		chapter: 'Choosing a model',
		pause: 0.6,
		text: "At the bottom of the panel is everything about the run itself. The green dot means the app can reach Ollama. And this is the model picker. It lists every model Ollama has: cloud models, marked cloud, and the ones on my own machine. For this demo, I'll use Gemma 4, running in Ollama's cloud.",
		cues: [
			C('At the bottom', glide(T.dock, { dur: 0.9 })),
			C('green dot', glide(T.conn, { dur: 0.6 })),
			C('model picker', click(T.model, { dur: 0.6 })),
			C('marked cloud', glide(T.badge('gpt-oss', 'cloud'), { dur: 0.6 })),
			C('my own machine', glide(T.option('lfm2'), { dur: 0.6 })),
			C('Gemma 4', click(T.option('gemma4:31b'), { dur: 0.7, delay: 0.35 }))
		]
	},
	{
		id: 'settings',
		text: 'The gear holds the run settings: how many rows to send at once, the temperature, and the address of Ollama.',
		cues: [
			C('The gear', click(T.settings, { dur: 0.6 })),
			C('how many rows', glide(T.field('concurrency'), { dur: 0.6 })),
			C('the temperature', glide(T.field('temperature'), { dur: 0.5 })),
			C('the address', glide(T.field('host'), { dur: 0.5 })),
			C('the address', key('Escape', { delay: 1.5, blur: true }))
		]
	},
	{
		id: 'preview',
		chapter: 'Previewing a row',
		pause: 0.6,
		text: 'Before I run anything, I like to preview it. This shows the exact instructions the model gets, and my prompt, filled in with the first row. I can test that one row without touching the sheet.',
		cues: [
			C('preview it', click(T.preview, { dur: 1.0 })),
			C('exact instructions', glide(T.system, { dur: 0.8 })),
			C('filled in', glide(T.rowPrompt, { dur: 0.7 })),
			C('test that', click(T.testRow, { dur: 0.8 }))
		]
	},
	{
		id: 'tested',
		pause: 0.4,
		text: "Negative. That's right. This customer has been shipping reports with the wrong times for three weeks.",
		cues: [
			C('Negative', glide(T.answer, { dur: 0.5 })),
			C('three weeks', click(T.closePreview, { dur: 0.8, delay: 0.5 }))
		]
	},
	{
		id: 'run',
		chapter: 'Running the prompt',
		pause: 0.5,
		text: "Now let's run it on all fifteen rows.",
		cues: [C('all fifteen', click(T.run, { dur: 0.9 }))]
	},
	{
		id: 'running',
		pause: 0.5,
		text: 'The line along the top of the panel shows the progress, and I can pause or stop the run at any time. The answers stream into the new column as they come back.',
		cues: [
			C('The line along', glide(T.dockEdge, { dur: 0.8 })),
			C('pause or stop', glide(T.pause, { dur: 0.6 })),
			C('stream into', glide(T.cell(5, 5, [0.5, 0.5]), { dur: 1.1 }))
		]
	},
	{
		id: 'done',
		text: "And it's done. Fifteen rows, in about eight seconds. Each row is its own small request, so the same setup works for fifteen rows, or for fifteen thousand.",
		cues: [C("it's done", glide(T.dock, { dur: 0.6 }))]
	},
	{
		id: 'tally',
		chapter: 'Reading the results',
		text: "To see how the answers are spread, I'll open the menu on the new column. Eight negative, four positive, and three neutral. Clicking one ticks those rows in the sheet, so I can review them, or run a different prompt on just those. I'll clear the ticks for now.",
		cues: [
			C('open the menu', click(T.columnMenu('Sentiment'), { dur: 1.0 })),
			C('Eight negative', glide(T.tally('negative'), { dur: 0.6 })),
			C('four positive', glide(T.tally('positive'), { dur: 0.45 })),
			C('three neutral', glide(T.tally('neutral'), { dur: 0.45 })),
			C('Clicking one', click(T.tally('negative'), { dur: 0.5, delay: 0.3 })),
			C('review them', glide(T.cell(4, 5, [0.5, 0.5]), { dur: 0.8 })),
			C('clear the ticks', click(T.untick, { dur: 0.9, delay: 0.2 }))
		]
	},
	{
		id: 'export',
		text: "When I'm happy, Export saves the whole sheet, with the new column, as CSV or JSON.",
		cues: [
			C('Export', click(T.exportButton, { dur: 0.9 })),
			C('as CSV', click(T.csv, { dur: 0.6, delay: 0.1 }))
		]
	},

	// Expense requests: approve or reject, tested on five rows first.
	{
		id: 'expenses',
		chapter: 'Example 2: expense requests',
		pause: 0.9,
		text: "On to the second example. I'll go back to my projects, and open the expense requests.",
		cues: [
			C('go back', click(T.projects, { dur: 0.9 })),
			C('expense requests', click(T.sample('Expense requests'), { dur: 0.8, delay: 0.3 }))
		]
	},
	{
		id: 'claims',
		pause: 1.0,
		text: 'Each row is an expense claim: the amount, the category, the policy cap for that category, and a justification. The job here is approve or reject. The prompt spells out the policy, and the answer is a yes or no, written into the sheet as Approve or Reject.',
		cues: [
			C('the amount', glide(T.cell(1, 3, [0.75, 0.5]), { dur: 0.9 })),
			C('the category', glide(T.cell(1, 4, [0.25, 0.5]), { dur: 0.5 })),
			C('the policy cap', glide(T.cell(1, 5, [0.8, 0.5]), { dur: 0.5 })),
			C('a justification', glide(T.cell(1, 6, [0.3, 0.5]), { dur: 0.6 })),
			C('approve or reject', glide(T.job, { dur: 1.0 })),
			C('spells out', glide(T.editor([0.42, 0.9]), { dur: 0.8 })),
			C('Approve or Reject', glide(T.field('true-label'), { dur: 0.9 }))
		]
	},
	{
		id: 'firstfew',
		chapter: 'Testing on a few rows',
		text: "With real money involved, I'd rather test a few rows first. So under Rows to run, I'll pick the first few, and make it five.",
		cues: [
			C('Rows to run', click(T.rows, { dur: 0.8 })),
			C('the first few', click(T.option('First few'), { dur: 0.5 })),
			C('make it five', click(T.firstCount, { dur: 0.6 })),
			C('make it five', key('ControlOrMeta+a', { delay: 0.25 })),
			C('make it five', type('5', { delay: 0.45 }))
		]
	},
	{ id: 'andrun', pause: 0.3, text: 'And run.', cues: [C('run', click(T.run, { dur: 0.9 }))] },
	{
		id: 'decisions',
		pause: 2.4,
		text: "These look right. The icon licence and the books are within their caps, so they're approved. The trip to Lisbon is over the travel cap and wasn't pre-approved, the client dinner is more than double its cap, and the charger doesn't have an amount yet. So all three are rejected.",
		cues: [
			C('icon licence', glide(T.cell(0, 7, [0.5, 0.5]), { dur: 0.9 })),
			C('the books', glide(T.cell(2, 7, [0.5, 0.5]), { dur: 0.5 })),
			C('trip to Lisbon', glide(T.cell(1, 7, [0.5, 0.5]), { dur: 0.5 })),
			C('client dinner', glide(T.cell(3, 7, [0.5, 0.5]), { dur: 0.5 })),
			C('the charger', glide(T.cell(4, 7, [0.5, 0.5]), { dur: 0.45 }))
		]
	},
	{
		id: 'empty',
		text: "To finish the rest, I'll switch Rows to run to empty results, which only runs the rows that don't have an answer yet. And run the other ten.",
		cues: [
			C('switch Rows', click(T.rows, { dur: 0.8 })),
			C('empty results', click(T.option('Empty results'), { dur: 0.5 })),
			C('the other ten', click(T.run, { dur: 0.8 }))
		]
	},
	{
		id: 'resume',
		pause: 0.5,
		text: 'Empty results is also how you pick up a long run that you stopped part way through.',
		cues: [
			C('Empty results', glide(T.cell(7, 7, [0.5, 0.5]), { dur: 1.0 })),
			C('stopped part way', glide(T.cell(12, 7, [0.5, 0.5]), { dur: 0.9 }))
		]
	},

	// Research notes: summaries.
	{
		id: 'research',
		chapter: 'Example 3: research notes',
		pause: 0.9,
		text: "The last example is research notes: long interview notes from a user study. The job here is summarize, and the answer is free text, kept under twenty-five words. I'll run all twelve notes.",
		cues: [
			C('The last example', click(T.projects, { dur: 0.9 })),
			C('research notes', click(T.sample('Research notes'), { dur: 0.9 })),
			C('long interview', glide(T.cell(1, 4, [0.35, 0.5]), { dur: 0.9, delay: 0.3 })),
			C('summarize', glide(T.job, { dur: 0.9 })),
			C('twenty-five words', glide(T.field('max-words'), { dur: 0.7 })),
			C('all twelve', click(T.run, { dur: 0.9 }))
		]
	},
	{
		id: 'summaries',
		pause: 0.6,
		text: 'Each long note turns into one sentence that I can actually scan. And just like before, clicking a cell shows the full summary in the bar at the top.',
		cues: [
			C('Each long note', glide(T.cell(1, 4, [0.4, 0.5]), { dur: 0.9 })),
			C('one sentence', glide(T.cell(1, 5, [0.4, 0.5]), { dur: 0.7 })),
			C('clicking a cell', click(T.cell(3, 5, [0.4, 0.5]), { dur: 0.7 })),
			C('the full summary', glide(T.readerText, { dur: 0.9 }))
		]
	},

	// How it was built, and a recap.
	{
		id: 'built',
		chapter: 'How I built it',
		pause: 0.8,
		text: "A quick word on how I built it. Prompt to column is a Svelte Kit app, written in TypeScript, with Svelte 5 and Tailwind CSS. It runs entirely in your browser. The CSV is read locally, projects are saved in the browser's own storage, and the only calls it makes go to Ollama. I built it with Claude Code, Anthropic's AI coding assistant. I described what I needed, and together we worked through the design, the code, and the tests.",
		cues: [
			C('A quick word', glide({ x: 1230, y: 700 }, { dur: 1.4 })),
			C(
				'A quick word',
				card('Built with Claude Code', 'SvelteKit, Svelte 5, TypeScript and Tailwind CSS', {
					side: 'right',
					show: 1.2,
					hide: 26
				})
			),
			C('go to Ollama', glide(T.model, { dur: 1.1 })),
			C('Claude Code', glide({ x: 1180, y: 640 }, { dur: 1.3 }))
		]
	},
	{
		id: 'recap',
		chapter: 'Recap',
		pause: 0.6,
		text: 'So, to recap. For high-volume jobs, like classifying messages, checking claims against a policy, or summarizing notes, prompt to column lets you use free and local models, instead of paying a premium on every single row. Your data can stay on your own machine, every answer comes back in the shape you choose, and you can test on a few rows before you run the whole sheet. Thanks for watching.',
		cues: [
			C('So, to recap', click(T.projects, { dur: 1.0 })),
			C('classifying messages', glide(T.project('Support tickets'), { dur: 0.9 })),
			C('checking claims', glide(T.project('Expense requests'), { dur: 0.7 })),
			C('summarizing notes', glide(T.project('Research notes'), { dur: 0.7 })),
			C('Your data', glide({ x: 1240, y: 640 }, { dur: 1.6 }))
		]
	}
];

/** The narration text as it should read in captions. */
export function captionText(text) {
	return text.replace(/[Pp]rompt to column/g, 'prompt2column').replace(/Svelte Kit/g, 'SvelteKit');
}
