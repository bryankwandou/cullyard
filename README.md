# Cullyard

Tell your agent how to sort. Watch the folders move.

Cullyard is a local MCP server with a desk in the browser. Claude Code, Antigravity or any other MCP client reads every file in a folder, sorts it into lanes (Picks, Maybe, Rejects, or lanes you name), and trims or resizes copies when you ask. The desk at `http://127.0.0.1:4870` shows each move as it happens, and you can drag cards back if you disagree. When a sort is done, the agent can write a SHA-256 of the sort log into a Solana devnet memo, so anyone holding the log can check later that it was not edited.

![Desk after a sort, with the activity feed showing the devnet seal](web/img/04-desk-sealed.jpg)

## What it handles

| Kind | Examples | What the agent sees |
| --- | --- | --- |
| image | jpg, png, webp, heic, avif, gif, tiff | width, height, format |
| raw | cr2, cr3, nef, arw, dng, raf | width, height when the decoder can read it |
| video | mp4, mov, mkv, webm, avi, mts | duration, codec, frame size |
| audio | mp3, flac, wav, m4a, ogg, opus | duration, title, artist |
| pdf | pdf | page count |
| document | docx, xlsx, csv, pptx, md, epub | kind and size |
| archive, design, code, other | zip, psd, blend, py, anything else | kind and size |

Unknown extensions are still listed as `other`. The desk never refuses a file because of its extension.

## Install

You need Node.js 20 or newer. FFmpeg ships inside the package, so trimming works on a clean Windows machine.

Claude Code:

```bash
claude mcp add cullyard -- npx -y github:bryankwandou/cullyard "D:\Shoots\Bali"
```

Antigravity, Cursor, Claude Desktop or any client that reads an `mcpServers` block:

```json
{
  "mcpServers": {
    "cullyard": {
      "command": "npx",
      "args": ["-y", "github:bryankwandou/cullyard", "D:\\Shoots\\Bali"]
    }
  }
}
```

Replace the folder with your own. The desk opens on `127.0.0.1:4870` (set `CULLYARD_PORT` to change it). Pass `--no-desk` if you only want the MCP tools.

To seal runs on devnet, set `CULLYARD_KEYPAIR` to the path of a devnet keypair JSON file. Without it, sorting and editing work the same and `seal_run` returns a clear error.

## Tools

| Tool | What it does |
| --- | --- |
| `scan_workspace` | Lists every file with kind, size, pixel size, duration, tags or page count |
| `describe_file` | Metadata for one file |
| `list_lanes` | Current lanes and which file sits where |
| `create_lane` | Adds a lane, such as "Hero shots" or "Client docs" |
| `move_to_lane` | Moves a file into a lane folder, with an optional reason shown on the desk; never overwrites |
| `assess_photos` | Measures focus, exposure and bursts for every photo, ranks them against each other |
| `contact_sheet` | One numbered grid of up to 16 photos, returned as an image the agent can look at |
| `preview_image` | One photo as an image (up to 1024 px), plus its measurements |
| `resize_image` | Writes a resized WebP, JPG, PNG or AVIF copy |
| `trim_media` | Cuts a time range from video or audio without re-encoding |
| `log_digest` | SHA-256 of the sort log, computed locally |
| `seal_run` | Writes that hash into a Solana devnet memo |
| `verify_seal` | Recomputes the hash and checks it against the chain |
| `list_kinds` | The file kinds Cullyard recognises |

Rules the server enforces: paths outside the workspace are refused, moves never overwrite, edits always write a new file, and the original is never touched.

## How the agent sees photos

Metadata alone cannot tell a sharp frame from a blurred one, so Cullyard gives the agent two kinds of evidence.

**Pictures.** `contact_sheet` and `preview_image` return real images over MCP, so a vision model such as Claude looks at the photos instead of guessing from file names. The sheet numbers each frame, and the legend maps numbers back to files.

**Measurements.** `assess_photos` measures each photo and compares it with the rest of the set:

- Focus: variance of the Laplacian on a contrast-stretched greyscale copy, measured per tile on a 4×4 grid. The sharpest tile counts, so a sharp subject on a soft background still reads as sharp, and a dark frame is not mistaken for a soft one.
- Exposure: mean brightness and the share of clipped shadows and highlights.
- Bursts: a 64-bit difference hash plus a 3×3 colour print. Two frames are one burst only when both match, so the same framing at golden hour and at blue hour stays separate. The sharpest frame of each burst is kept; the others are flagged `duplicate`.
- Flags: `soft` (under 40% of the set's median focus), `dark`, `bright`, `duplicate`. Rank puts clean frames first, sharpest first.

The results are saved in `.cullyard/quality.json`, and the desk shows them on each card, so you see the same evidence the agent used. The numbers are signals, not verdicts: a shallow-focus portrait or a night shot can be a keeper with "bad" numbers, which is why the agent also looks at the picture.

## A real run

`scripts/demo-agent.mjs` drives the real server over stdio, the same way an agent does. It scans twelve sample files, creates a "Client docs" lane, measures the seven photos, looks at them on a contact sheet, sorts photos from what it measured (with a reason on every move), files the other four, resizes the top pick to 1200 px WebP, trims three seconds from a clip, seals the log on devnet and verifies the seal. The full output is in [docs/agent-transcript.txt](docs/agent-transcript.txt), and the recorded desk is in [web/media/walkthrough.mp4](web/media/walkthrough.mp4).

```bash
npm install
node scripts/make-samples.mjs demo-workspace
CULLYARD_KEYPAIR=path/to/devnet-keypair.json node scripts/demo-agent.mjs demo-workspace
```

The seal from the recorded run is in [web/proof.json](web/proof.json) and can be opened on Solana Explorer.

## How the seal works

Every move appends one JSON line to `.cullyard/log.jsonl` inside the workspace. `seal_run` hashes the log with SHA-256 and sends one transaction to the Memo program (`Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo`) with the text:

```
cullyard:v1 log=<sha256> entries=<count>
```

`verify_seal` fetches that transaction, hashes the log lines written before the seal, and compares the two. File names and file contents never go on-chain; only the hash does.

## Tests

```bash
npm test
```

Eighteen tests cover file kinds, scanning, lanes, path traversal, no-overwrite moves, resizing, video probing, the desk's upload and cross-origin guard, the seal digest, photo measurement (blur, a sharp subject on a soft background, dark frames, bursts, colour-separated framings), the contact sheet, and a full MCP stdio round trip that includes the image tools.

## Layout

```
bin/        command-line entry (MCP over stdio, plus the desk)
src/        scan, lanes, edit, look (photo measurement), seal, MCP server, desk server
desk/       the browser desk (plain HTML, CSS, JS; English and Indonesian)
web/        landing page, screenshots, walkthrough video, proof.json
scripts/    sample generator and the demo agent
test/       node:test suites
docs/       report and agent transcript
pitch/      pitch deck
video/      marketing video
```

## What it does not do yet

- The photo thresholds were tuned on generated test images, not yet on a real shoot. Treat flags as hints and check the contact sheet.
- Image tools need an MCP client that shows image results to the model. Claude Code does; other clients were not tested.
- There is no timeline editor. Trim and resize are single steps.
- Seals use devnet only.

## License

MIT
