# prompt2column tutorial: transcript

Narrated by Ellie Aboutorabi (ElevenLabs voice "Eli"). Times are from the rendered video (10:08).

## Introduction

**[0:01]** Hi, I'm Ellie Aboutorabi. I'm an AI-enabled accountant, and in this video I'll show you prompt2column, a small app I built that adds a new column to a spreadsheet with a single prompt.

**[0:17]** You write one prompt, like this one, and the app runs it once for every row of your sheet. Each answer lands in a new column. Here, that's a sentiment label for every customer message.

## Why I built it

**[0:33]** So why did I build it? In accounting and finance, the tables are big: transactions, expense claims, customer messages, survey answers. Language models are great at reading a row and making a judgement call, like a category, an approve or reject, a score, or a one-line summary. But when you have hundreds of thousands, or even millions, of rows, sending every single row to an expensive frontier model adds up very quickly. And for most of these jobs, you don't need the biggest model at all.

## What Ollama is

**[1:12]** That's where Ollama comes in. Ollama is a free tool that runs open models, like Gemma, Llama or Mistral, right on your own computer. It can also run bigger open models in Ollama's cloud, which comes with a free allowance. So instead of paying per token to a big AI provider, you can run these jobs on a local model for free, or on a cloud model within that allowance.

**[1:44]** With a local model, nothing leaves your computer. You decide the exact shape of every answer. And your sheet comes in as a CSV, and goes out as CSV or JSON.

## Creating a workspace

**[1:58]** Let's try it. First, I'll create a workspace. It's just a name and a passphrase that keep my projects separate from anyone else using this browser. Everything stays in the browser, so there's nothing to sign up for.

**[2:15]** This is my projects page. I can drop in any CSV file, or start from one of three sample sheets: support tickets, expense requests, and research notes. Let's begin with the support tickets.

## Example 1: support tickets

**[2:33]** The workspace has two parts. On the right is the sheet: fifteen support tickets, each with a ticket number, the customer, their plan, the channel, and the message itself.

**[2:48]** When a message is too long to read, I click the cell, and the bar above the sheet shows the whole thing.

**[2:57]** On the left is the panel where I describe the new column. This sample opens with a classification job already set up, so let's go through it from the top.

## Setting up the column

**[3:13]** First, the name of the new column. I'll call it Sentiment.

**[3:18]** Next to it is the job. There are five to choose from: classify, approve or reject, summarize, score, or a custom prompt of your own. Each one fills in a sensible first draft for everything below it.

**[3:34]** Then comes the prompt. It's plain text, and anything inside double curly braces is a column from the sheet. For each row, those are swapped for that row's values. To add one, I can type two curly braces, use Insert column, or simply click a column header in the sheet.

**[3:56]** Below the prompt, I choose the shape of the answer. For sentiment, I want a label, and only one of these three: positive, neutral, or negative. I could also ask for a yes or no, a number, or a short piece of text.

**[4:15]** The app tells the model exactly what shape it wants, and checks every reply. With a local model, Ollama even holds the model to that shape while it writes. Anything that still comes back a little off gets repaired, or asked for again. So every cell gets a clean label, not a chatty sentence.

**[4:40]** Rules are optional extra instructions. Here, the model is told to judge only what the text says. And under Rows to run, I can pick every row, just the first few for a quick test, a range, the rows I've ticked, or only the cells that are still empty.

## Choosing a model

**[5:02]** At the bottom of the panel is everything about the run itself. The green dot means the app can reach Ollama. And this is the model picker. It lists every model Ollama has: cloud models, marked cloud, and the ones on my own machine. For this demo, I'll use Gemma 4, running in Ollama's cloud.

**[5:26]** The gear holds the run settings: how many rows to send at once, the temperature, and the address of Ollama.

## Previewing a row

**[5:36]** Before I run anything, I like to preview it. This shows the exact instructions the model gets, and my prompt, filled in with the first row. I can test that one row without touching the sheet.

**[5:52]** Negative. That's right. This customer has been shipping reports with the wrong times for three weeks.

## Running the prompt

**[6:01]** Now let's run it on all fifteen rows.

**[6:04]** The line along the top of the panel shows the progress, and I can pause or stop the run at any time. The answers stream into the new column as they come back.

**[6:17]** And it's done. Fifteen rows, in about eight seconds. Each row is its own small request, so the same setup works for fifteen rows, or for fifteen thousand.

## Reading the results

**[6:33]** To see how the answers are spread, I'll open the menu on the new column. Eight negative, four positive, and three neutral. Clicking one ticks those rows in the sheet, so I can review them, or run a different prompt on just those. I'll clear the ticks for now.

**[6:53]** When I'm happy, Export saves the whole sheet, with the new column, as CSV or JSON.

## Example 2: expense requests

**[7:02]** On to the second example. I'll go back to my projects, and open the expense requests.

**[7:09]** Each row is an expense claim: the amount, the category, the policy cap for that category, and a justification. The job here is approve or reject. The prompt spells out the policy, and the answer is a yes or no, written into the sheet as Approve or Reject.

## Testing on a few rows

**[7:31]** With real money involved, I'd rather test a few rows first. So under Rows to run, I'll pick the first few, and make it five.

**[7:42]** And run.

**[7:45]** These look right. The icon licence and the books are within their caps, so they're approved. The trip to Lisbon is over the travel cap and wasn't pre-approved, the client dinner is more than double its cap, and the charger doesn't have an amount yet. So all three are rejected.

**[8:07]** To finish the rest, I'll switch Rows to run to empty results, which only runs the rows that don't have an answer yet. And run the other ten.

**[8:20]** Empty results is also how you pick up a long run that you stopped part way through.

## Example 3: research notes

**[8:28]** The last example is research notes: long interview notes from a user study. The job here is summarize, and the answer is free text, kept under twenty-five words. I'll run all twelve notes.

**[8:44]** Each long note turns into one sentence that I can actually scan. And just like before, clicking a cell shows the full summary in the bar at the top.

## How I built it

**[8:58]** A quick word on how I built it. prompt2column is a SvelteKit app, written in TypeScript, with Svelte 5 and Tailwind CSS. It runs entirely in your browser. The CSV is read locally, projects are saved in the browser's own storage, and the only calls it makes go to Ollama. I built it with Claude Code, Anthropic's AI coding assistant. I described what I needed, and together we worked through the design, the code, and the tests.

## Recap

**[9:33]** So, to recap. For high-volume jobs, like classifying messages, checking claims against a policy, or summarizing notes, prompt2column lets you use free and local models, instead of paying a premium on every single row. Your data can stay on your own machine, every answer comes back in the shape you choose, and you can test on a few rows before you run the whole sheet. Thanks for watching.
