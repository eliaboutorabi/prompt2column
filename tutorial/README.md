# Tutorial video

Everything needed to render the prompt2column walkthrough: the script, Ellie's
narration (ElevenLabs, voice "Eli"), and a recorder that drives the real app.

## How it's made

- **`story.mjs`**: the narration, split into segments, with a cue for every
  pointer move, click and keystroke. A cue fires on a phrase, so a click lands
  on the word that mentions it.
- **`narration.mjs`**: voices each segment with ElevenLabs and keeps
  per-character timings. Audio is cached in `out/voice/` by text, so only
  changed lines are paid for again. The key comes from `ELEVENLABS_API_KEY` in
  the repo's `.env`.
- **`engine.mjs`** and **`overlay.js`**: record the app one frame at a time. The
  page's clock, animations and network all follow video time, so every frame is
  exact however long it takes to capture. The overlay draws what a headless
  browser can't: the pointer, click rings and the name cards.
- **`prerun.mjs`** and **`fixtures/`**: the three samples were run once through
  the real `gemma4:31b-cloud` model, through the app itself. The recording
  replays those replies with their real latencies, so the answers on screen are
  the model's own and the timing stays exact.
- **`render.mjs`**: puts it together: timeline, recording, narration mix
  (levelled to -14 LUFS), captions and chapters.

## Rendering

```bash
node tutorial/render.mjs --rehearse --voice --stills
```

A 1x rehearsal with the real narration, plus a still at every cue in
`out/stills/` for checking.

```bash
node tutorial/render.mjs --final
```

The 4K render (3840x2160, 30 fps). Writes `out/prompt2column-tutorial.mp4`, with
captions (`.srt`), YouTube chapters and a timed transcript next to it.

```bash
node tutorial/render.mjs --final --mix-only
```

Redoes only the sound and captions on an existing render.

To refresh the recorded model replies (needs Ollama running and signed in):

```bash
node tutorial/prerun.mjs
```
