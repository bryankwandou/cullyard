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
| `move_to_lane` | Moves a file into a lane folder; never overwrites |
| `resize_image` | Writes a resized WebP, JPG, PNG or AVIF copy |
| `trim_media` | Cuts a time range from video or audio without re-encoding |
| `log_digest` | SHA-256 of the sort log, computed locally |
| `seal_run` | Writes that hash into a Solana devnet memo |
| `verify_seal` | Recomputes the hash and checks it against the chain |
| `list_kinds` | The file kinds Cullyard recognises |

Rules the server enforces: paths outside the workspace are refused, moves never overwrite, edits always write a new file, and the original is never touched.

## A real run

`scripts/demo-agent.mjs` drives the real server over stdio, the same way an agent does. It scans eleven sample files, creates a "Client docs" lane, sorts ten of them, resizes one photo to 1200 px WebP, trims three seconds from a clip, seals the log on devnet and verifies the seal. The full output is in [docs/agent-transcript.txt](docs/agent-transcript.txt), and the recorded desk is in [web/media/walkthrough.mp4](web/media/walkthrough.mp4).

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

Thirteen tests cover file kinds, scanning, lanes, path traversal, no-overwrite moves, resizing, video probing, the desk's upload and cross-origin guard, the seal digest, and a full MCP stdio round trip.

## Layout

```
bin/        command-line entry (MCP over stdio, plus the desk)
src/        scan, lanes, edit, seal, MCP server, desk server
desk/       the browser desk (plain HTML, CSS, JS; English and Indonesian)
web/        landing page, screenshots, walkthrough video, proof.json
scripts/    sample generator and the demo agent
test/       node:test suites
docs/       report and agent transcript
pitch/      pitch deck
video/      marketing video
```

## What it does not do yet

- It does not judge photos by itself. Your agent decides; Cullyard gives it the facts and the hands.
- There is no timeline editor. Trim and resize are single steps.
- Seals use devnet only.

## License

MIT
