# Documentation trailers

`render_trailer.py` renders two 60-second trailers (1920×1080, 30 fps, without sound) from the documentation screenshots:

- **professor**: positions, writing and translating a job description with AI, reviewing applications and documents, planning interview slots and assessing interviews.
- **applicant**: finding a position, applying with the profile and AI extraction, motivation, recommenders, submitting, tracking applications and job notifications.

They are written to `docs/docs/professors-and-employees/videos/trailer-professor.mp4` and `docs/docs/applicants/videos/trailer-applicant.mp4`, and the account creation page of each audience embeds them. Each is about 6 MB, so keep the encoding settings to keep the Git history small.

The trailers only show screenshots from `docs/docs/`. When those change, the trailers change too.

## Requirements

- Python 3.11 or newer
- `ffmpeg` on the `PATH` (`brew install ffmpeg`)
- The font Avenir Next, which macOS ships. On other systems, pass another font file with `--font`; the result then looks different, so render the committed videos on macOS.

Install the Python dependencies from the repository root:

```bash
python3 -m venv .venv-trailer
.venv-trailer/bin/pip install -r supporting_scripts/trailer/requirements.txt
```

## Render

```bash
# Both cuts, replacing the videos the documentation embeds (about two minutes per cut)
.venv-trailer/bin/python supporting_scripts/trailer/render_trailer.py

# One cut into another directory, for example to share it
.venv-trailer/bin/python supporting_scripts/trailer/render_trailer.py --cut applicant --out ~/Downloads

# Stills at given timestamps (seconds) in build/trailers/, for checking crops and highlights quickly
.venv-trailer/bin/python supporting_scripts/trailer/render_trailer.py --cut professor --preview 8,20.5,40
```

## Change a trailer

The storyboards are the functions `professor()` and `applicant()`. Each scene is a dictionary with:

- `kind`: `intro`, `shot` (one screenshot on a card) or `outro`
- `len`: the length in seconds; the scenes overlap by 0.6 s and must add up to exactly 60 s, otherwise the script stops
- `tin`: the transition into the scene: `fade`, `slide` or `zoom`
- `kicker`, `title`, `sub`: the caption on the left
- `img`: the screenshot; `fit=True` sizes the card to the whole screenshot, which suits dialogs and crops
- `cam`: camera keyframes `(time fraction, centre x, centre y, width)`, relative to the screenshot size. Without `cam`, the camera pushes in slightly; `STILL` keeps it still.
- `spots`: highlights `(start s, end s, r(x0, y0, x1, y1))` in screenshot fractions; everything else is dimmed

Every frame where the camera rests, and the last frame of a scene, shows whole rows, headings and controls, and every highlight sits on the element the caption names. To find the fractions, draw a grid over the screenshot.
