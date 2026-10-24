# Cullyard 0.1.0 build report

24 October 2026. The same report, with the video inline, is at `web/report.html`.

## Summary

| Area | Result |
| --- | --- |
| MCP tools | 11 tools over stdio |
| File kinds | 10 kinds; unknown extensions are listed as `other`, never refused |
| Automated tests | 13 of 13 pass with `npm test` on Windows 11, Node 24 ([test-output.txt](test-output.txt)) |
| Recorded agent run | 10 of 11 files sorted into 4 lanes, 1 WebP copy, 1 three-second trim, sealed and verified ([agent-transcript.txt](agent-transcript.txt)) |
| Devnet seal | Memo read back from the chain on 24 October 2026, equal to the local SHA-256 |
| Languages | English by default, Indonesian on the desk and the site |

## Devnet seal

- Signature: [49XyVeqwpvCKmWLq5X6jU8jhDYY4ZAV3eQfJVEcG1RsmwQenkDPU94BUhwWfXgF3j6rHS7TjA8rXLqcevH4dHVXm](https://explorer.solana.com/tx/49XyVeqwpvCKmWLq5X6jU8jhDYY4ZAV3eQfJVEcG1RsmwQenkDPU94BUhwWfXgF3j6rHS7TjA8rXLqcevH4dHVXm?cluster=devnet)
- Memo: `cullyard:v1 log=46935d623104460f457298f182c262b9d908fb1a419479c98d7d3b5f050e06d1 entries=10`
- Slot 514323020, 23 Oct 2026 17:33:29 UTC, no error
- Signer: `AsrL4uc9Ct7rhCASJXMhCtAX3k76RgkSsoe3pZFsBdyM`

## Screenshots

The workspace path in the desk header was covered in every image because it contained a local user name.

| | |
| --- | --- |
| ![Before](../web/img/01-desk-inbox.jpg) 1. Eleven files in Inbox | ![Mid-run](../web/img/02-desk-sorting.jpg) 2. Mid-run, frame from the walkthrough |
| ![Sorted](../web/img/03-desk-sorted.jpg) 3. Sorted, with the agent's Client docs lane | ![Sealed](../web/img/04-desk-sealed.jpg) 4. Sealed, feed links to the transaction |
| ![Indonesian](../web/img/05-desk-indonesian.jpg) 5. Same state in Indonesian | ![Mobile](../web/img/06-desk-mobile.jpg) 6. Phone width |

## Media

- Walkthrough of the recorded run: `web/media/walkthrough.mp4` (66 s, 1440 × 860; captured at about 1 fps and smoothed to 30 fps, not sped up)
- Product film: `video/cullyard-marketing.mp4` (51 s, 1920 × 1080, no sound)
- Pitch deck: `pitch/cullyard-pitch.pdf`, slides as PNG in `pitch/slides/`

## Limits

- Cullyard does not judge photos itself. The agent decides.
- Trim uses stream copy, so cuts land on the nearest keyframe.
- Some RAW formats show only kind and size, depending on the bundled decoder.
- A trim through MCP took about 34 s end to end on the test machine, mostly process start-up.
- Seals use devnet only and are not a legal record.
- Only Windows 11 was tested for this release.
