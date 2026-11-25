---
name: trailers
description: Render or update the documentation trailers (the 60-second professor and applicant trailers and the short trailer on each feature page) that supporting_scripts/trailer/render_trailer.py builds from the documentation screenshots.
---

# Documentation trailers

`supporting_scripts/trailer/render_trailer.py` renders the professor and applicant trailers and a short trailer for each feature page from the screenshots in `docs/docs/`. Read `supporting_scripts/trailer/README.md` first: it has the requirements, the commands and the scene reference.

## When a trailer needs work

- **A PR changes a screenshot a trailer uses.** Search for the file name in `render_trailer.py`; a screenshot often appears in an audience trailer and a page trailer. Update every trailer that uses it in the same PR.
- **A PR adds a feature page.** Add a page trailer to `PAGE_TRAILERS` and embed it below the page heading.
- **A PR changes UI that a trailer shows.** Check the affected scenes and captions.

## Update a trailer

1. Set up once: `python3 -m venv .venv-trailer && .venv-trailer/bin/pip install -r supporting_scripts/trailer/requirements.txt`.
2. Render stills of the affected scenes with `--cut <cut> --preview <seconds,...>` and look at them in `build/trailers/`. A new screenshot usually has another layout, so fix the `cam` crops and the `spots` and rewrite captions that no longer match the application.
3. Every frame where the camera rests shows whole rows, headings and controls, and every highlight sits on the element the caption names.
4. Captions are short, in English, describe only what the documentation states, and never hardcode anything but the default platform name `DocApply`.
5. Render the affected cuts with the default output paths, commit the videos, and say in the PR what changed in them.

The committed videos need the macOS font Avenir Next. Without it, ask someone with macOS to render them for the same PR.
