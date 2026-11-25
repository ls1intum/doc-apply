#!/usr/bin/env python3
"""
Renders the DocApply trailers from the documentation screenshots: a 60-second trailer each for professors and
applicants, and a short trailer for each feature page.

Each cut is a storyboard of scenes. A scene shows one screenshot on a card with a caption, moves a camera over it
and highlights the elements the caption talks about. The videos are 1920x1080, 30 fps, without sound, and are
written next to the documentation pages that embed them. See README.md for the commands and the scene reference.
"""
import argparse
import base64
import io
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = Path(__file__).resolve().parents[2]
DOCS = REPO / "docs" / "docs"
PROFESSOR = DOCS / "professors-and-employees"
APPLICANT = DOCS / "applicants"
LOGO_SVG = REPO / "docs" / "static" / "img" / "docapply-logo.svg"

W, H, FPS = 1920, 1080, 30
DURATION = 60.0  # length of the audience trailers; page trailers last as long as their scenes
OV = 0.6  # transition overlap between scenes in seconds

FONTS = {"sans": "/System/Library/Fonts/Avenir Next.ttc"}
BOLD, DEMI, MEDIUM, REGULAR = 0, 2, 5, 7

NAVY = (10, 28, 54)
NAVY_LIGHT = (22, 58, 104)
ACCENT = (100, 168, 240)
WHITE = (245, 248, 255)
MUTED = (172, 188, 214)

CAPTION_X, CAPTION_W = 110, 560
CARD_X, CARD_Y, CARD_W, CARD_H = 740, 118, 1080, 857


def font(size, face=MEDIUM):
    """Loads the trailer font in the given size and face."""
    return ImageFont.truetype(FONTS["sans"], size, index=face)


def clamp(x):
    return max(0.0, min(1.0, x))


def ease(t):
    """Cubic ease in-out for camera moves and transitions."""
    t = clamp(t)
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def lerp(a, b, k):
    return a + (b - a) * k


def make_background():
    """Draws the dark blue gradient with a soft light in the upper left."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    k = clamp_array((x / W) * 0.45 + (y / H) * 0.55)
    base = np.array(NAVY, np.float32) * (1 - k[..., None]) + np.array(NAVY_LIGHT, np.float32) * k[..., None]
    glow = np.exp(-(((x - W * 0.18) / (W * 0.45)) ** 2 + ((y - H * 0.1) / (H * 0.6)) ** 2))[..., None]
    base = base + glow * np.array([30, 50, 80], np.float32) * 0.6
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB")


def clamp_array(a):
    return np.clip(a, 0.0, 1.0)


def load_logo():
    """Extracts the PNG that the DocApply logo SVG embeds, since Pillow cannot render SVG."""
    match = re.search(r"data:image/png;base64,([A-Za-z0-9+/=\s]+)", LOGO_SVG.read_text())
    return Image.open(io.BytesIO(base64.b64decode(match.group(1)))).convert("RGBA")


BG = make_background()
LOGO = load_logo()
_cache = {}


def load(path):
    """Loads a screenshot once."""
    if path not in _cache:
        _cache[path] = Image.open(path).convert("RGB")
    return _cache[path]


def camera(keys, t):
    """Interpolates the camera keyframes (time fraction, centre x, centre y, width) at scene progress t."""
    if t <= keys[0][0]:
        return keys[0][1:4]
    for a, b in zip(keys, keys[1:]):
        if t <= b[0]:
            k = ease((t - a[0]) / max(1e-6, b[0] - a[0]))
            return tuple(lerp(a[i], b[i], k) for i in range(1, 4))
    return keys[-1][1:4]


def crop_rect(img, cx, cy, wf, cw, ch):
    """Returns the source rectangle of the camera, keeping the card's aspect ratio inside the screenshot."""
    iw, ih = img.size
    sw = wf * iw
    sh = sw * ch / cw
    if sh > ih:
        sh = ih
        sw = sh * cw / ch
    x0 = min(max(cx * iw - sw / 2, 0), iw - sw)
    y0 = min(max(cy * ih - sh / 2, 0), ih - sh)
    return x0, y0, sw, sh


def render_card(img, cam, cw, ch):
    """Renders what the camera sees, letterboxed on white when the screenshot is wider or taller than the card."""
    x0, y0, sw, sh = crop_rect(img, *cam, cw, ch)
    view = img.resize((cw, ch), Image.BICUBIC, box=(x0, y0, x0 + sw, y0 + sh))
    return view, (x0, y0, sw, sh)


def fit_card(img, max_w, max_h):
    """Sizes a card so that the whole screenshot fits into the given area."""
    iw, ih = img.size
    scale = min(max_w / iw, max_h / ih)
    return int(iw * scale), int(ih * scale)


def rounded_mask(w, h, r):
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
    return mask


def place_card(frame, content, x, y, alpha=1.0, radius=16):
    """Pastes a card with rounded corners and a soft shadow."""
    w, h = content.size
    shadow = Image.new("RGBA", (w + 80, h + 80), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((40, 48, w + 40, h + 48), radius, fill=(0, 0, 0, int(110 * alpha)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    frame.alpha_composite(shadow, (int(x) - 40, int(y) - 40))
    mask = rounded_mask(w, h, radius)
    if alpha < 1:
        mask = mask.point(lambda v: int(v * alpha))
    frame.paste(content.convert("RGBA"), (int(x), int(y)), mask)


def spotlight(view, rect, src, k, color=ACCENT):
    """Dims everything outside a highlighted rectangle and outlines it; k fades the highlight in and out."""
    if k <= 0:
        return view
    x0, y0, sw, sh = src
    cw, ch = view.size
    iw, ih = rect[4], rect[5]
    rx0 = (rect[0] * iw - x0) / sw * cw
    ry0 = (rect[1] * ih - y0) / sh * ch
    rx1 = (rect[2] * iw - x0) / sw * cw
    ry1 = (rect[3] * ih - y0) / sh * ch
    pad = 10
    box = (rx0 - pad, ry0 - pad, rx1 + pad, ry1 + pad)
    overlay = Image.new("RGBA", view.size, (8, 20, 40, int(120 * k)))
    hole = Image.new("L", view.size, 255)
    ImageDraw.Draw(hole).rounded_rectangle(box, 12, fill=0)
    overlay.putalpha(Image.fromarray(np.minimum(np.array(hole), int(120 * k)).astype(np.uint8)))
    out = view.convert("RGBA")
    out.alpha_composite(overlay)
    ring = Image.new("RGBA", view.size, (0, 0, 0, 0))
    ImageDraw.Draw(ring).rounded_rectangle(box, 12, outline=color + (int(255 * k),), width=5)
    out.alpha_composite(ring)
    return out.convert("RGB")


def wrap(draw, text, fnt, max_w):
    """Breaks text into lines that fit max_w."""
    lines, line = [], ""
    for word in text.split():
        trial = (line + " " + word).strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def text_block(frame, x, y, text, fnt, color, lt, delay, max_w, line_h, alpha=1.0, center=False):
    """Draws text that fades in and rises slightly, starting delay seconds into the scene; returns the next y."""
    k = ease_out((lt - delay) / 0.6) * alpha
    draw = ImageDraw.Draw(frame)
    for i, line in enumerate(wrap(draw, text, fnt, max_w)):
        lx = x + (max_w - draw.textlength(line, font=fnt)) / 2 if center else x
        ly = y + i * line_h + (1 - k) * 24
        draw.text((lx, ly), line, font=fnt, fill=color + (int(255 * k),))
    return y + len(wrap(draw, text, fnt, max_w)) * line_h


def caption(frame, sc, lt, alpha):
    """Draws the kicker, title and subtitle of a scene on the left."""
    y = 300
    if sc.get("kicker"):
        y = text_block(frame, CAPTION_X, y, sc["kicker"].upper(), font(26, DEMI), ACCENT, lt, 0.15, CAPTION_W, 38, alpha) + 18
    y = text_block(frame, CAPTION_X, y, sc["title"], font(58, BOLD), WHITE, lt, 0.3, CAPTION_W, 70, alpha) + 26
    if sc.get("sub"):
        text_block(frame, CAPTION_X, y, sc["sub"], font(30, REGULAR), MUTED, lt, 0.55, CAPTION_W, 44, alpha)


def brand(frame, alpha=1.0):
    """Draws the small logo and name in the upper left corner."""
    logo = LOGO.resize((54, 54), Image.LANCZOS)
    if alpha < 1:
        logo.putalpha(logo.getchannel("A").point(lambda v: int(v * alpha)))
    frame.alpha_composite(logo, (CAPTION_X, 54))
    ImageDraw.Draw(frame).text((CAPTION_X + 68, 60), "DocApply", font=font(34, DEMI), fill=WHITE + (int(255 * alpha),))


def progress(frame, index, total):
    """Draws one tick per scene below the caption, filled up to the current scene."""
    for i in range(total):
        x = CAPTION_X + i * 34
        color = ACCENT if i <= index else (70, 92, 128)
        ImageDraw.Draw(frame).rounded_rectangle((x, 990, x + 24, 996), 3, fill=color + (255,))


PUSH_IN = [(0, 0.5, 0.5, 1.0), (1, 0.5, 0.5, 0.95)]


def scene_shot(frame, sc, lt):
    """One screenshot on a card with a camera move and highlights."""
    img = load(sc["img"])
    duration = sc["end"] - sc["start"]
    cw, ch = sc.get("card", (CARD_W, CARD_H))
    if sc.get("fit"):
        cw, ch = fit_card(img, CARD_W, CARD_H)
    cam = camera(sc.get("cam", PUSH_IN), lt / duration)
    view, src = render_card(img, cam, cw, ch)
    for start, end, rect, *color in sc.get("spots", []):
        k = min(ease_out((lt - start) / 0.5), ease_out((end - lt) / 0.4))
        view = spotlight(view, rect + img.size, src, k, *(color or [ACCENT]))
    x = CARD_X + (CARD_W - cw) / 2
    y = CARD_Y + (CARD_H - ch) / 2
    place_card(frame, view, x, y)
    caption(frame, sc, lt, 1.0)
    brand(frame)
    progress(frame, sc["index"], sc["total"])


def centered(frame, y, text, fnt, color, lt, delay):
    return text_block(frame, 0, y, text, fnt, color, lt, delay, W, int(fnt.size * 1.25), center=True)


def scene_intro(frame, sc, lt):
    """The logo, the audience and a one-line promise."""
    k = ease_out(lt / 0.8)
    size = int(lerp(150, 190, k))
    logo = LOGO.resize((size, size), Image.LANCZOS)
    logo.putalpha(logo.getchannel("A").point(lambda v: int(v * k)))
    frame.alpha_composite(logo, ((W - size) // 2, 250 - size // 2 + 40))
    y = centered(frame, 430, sc["title"], font(96, BOLD), WHITE, lt, 0.35)
    centered(frame, y + 20, sc["sub"], font(40, REGULAR), MUTED, lt, 0.8)


def scene_outro(frame, sc, lt):
    """The logo and where to read more."""
    k = ease_out(lt / 0.8)
    logo = LOGO.resize((150, 150), Image.LANCZOS)
    logo.putalpha(logo.getchannel("A").point(lambda v: int(v * k)))
    frame.alpha_composite(logo, ((W - 150) // 2, 260))
    y = centered(frame, 450, sc["title"], font(80, BOLD), WHITE, lt, 0.3)
    centered(frame, y + 24, sc["sub"], font(38, MEDIUM), ACCENT, lt, 0.7)


KINDS = {"shot": scene_shot, "intro": scene_intro, "outro": scene_outro}


def draw_scene(sc, lt):
    frame = BG.convert("RGBA")
    KINDS[sc["kind"]](frame, sc, lt)
    return frame


def transition(layer, style, p, entering):
    """Moves a scene in or out during the overlap; p runs from 0 to 1."""
    k = ease(p) if entering else 1 - ease(p)
    if style == "slide":
        dx = int((1 - k) * 160) * (1 if entering else -1)
        moved = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        moved.paste(layer, (dx, 0))
        layer = moved
    elif style == "zoom":
        s = lerp(0.94, 1.0, k) if entering else lerp(1.06, 1.0, k)
        w, h = int(W * s), int(H * s)
        scaled = layer.resize((w, h), Image.BILINEAR)
        layer = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        layer.paste(scaled, ((W - w) // 2, (H - h) // 2))
    layer.putalpha(layer.getchannel("A").point(lambda v: int(v * k)))
    return layer


def frame_at(t, scenes):
    """Composites the scenes that are visible at time t."""
    frame = BG.convert("RGBA")
    for sc in scenes:
        if not sc["start"] <= t < sc["end"]:
            continue
        lt = t - sc["start"]
        layer = draw_scene(sc, lt)
        if lt < OV and sc["start"] > 0:
            layer = transition(layer, sc.get("tin", "fade"), lt / OV, True)
        elif sc["end"] - t < OV and sc is not scenes[-1]:
            layer = transition(layer, sc.get("tin_next", "fade"), (sc["end"] - t) / OV, True)
        frame.alpha_composite(layer)
    return frame.convert("RGB")


def timeline(scenes, duration=None):
    """Adds start and end times from the scene lengths, with OV seconds of overlap, and checks the total length if given."""
    t = 0.0
    shots = [s for s in scenes if s["kind"] == "shot"]
    for i, sc in enumerate(scenes):
        sc["start"] = max(0.0, t - (OV if i else 0))
        sc["end"] = sc["start"] + sc["len"] + (OV if i else 0)
        t = sc["end"]
        if sc["kind"] == "shot":
            sc["index"], sc["total"] = shots.index(sc), len(shots)
        if i + 1 < len(scenes):
            sc["tin_next"] = scenes[i + 1].get("tin", "fade")
    if duration and abs(t - duration) > 0.05:
        sys.exit(f"The scenes last {t:.2f} s instead of {duration:.0f} s; adjust their lengths.")
    scenes[-1]["end"] = duration or t
    return scenes


def r(x0, y0, x1, y1):
    """A highlight rectangle in fractions of the screenshot size."""
    return (x0, y0, x1, y1)


STILL = [(0, 0.5, 0.5, 1.0)]


def professor():
    """The professor cut: posting a position with AI, reviewing applications and running interviews."""
    img = PROFESSOR / "images"
    return [
        dict(kind="intro", len=4.0, title="DocApply for professors", sub="Recruit your doctoral candidates, from the job posting to the interview"),
        dict(kind="shot", len=5.5, tin="zoom", img=img / "manage-jobs" / "my-positions.png",
             kicker="Positions", title="All your positions in one place", sub="Drafts, published and closed positions with their status at a glance",
             spots=[(2.0, 5.2, r(0.46, 0.19, 0.58, 0.56))]),
        dict(kind="shot", len=6.0, tin="slide", img=img / "create-job" / "job-creation-form-1.png",
             kicker="Create a position", title="Let AI write the description", sub="Describe the key facts, and the assistant drafts the posting and rates its quality",
             cam=[(0, 0.5, 0.5, 1.0), (0.3, 0.5, 0.5, 1.0), (0.62, 0.82, 0.3, 0.36), (1, 0.82, 0.3, 0.36)],
             spots=[(1.2, 2.6, r(0.1, 0.77, 0.64, 0.93)), (3.9, 5.8, r(0.72, 0.14, 0.96, 0.41))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "ai-writing-and-translation" / "position-details-translation.png", fit=True,
             kicker="Translation", title="English and German, automatically", sub="Write in one language; DocApply translates the other one for you",
             cam=STILL, spots=[(1.2, 5.2, r(0.3, 0.19, 0.6, 0.27))]),
        dict(kind="shot", len=5.5, tin="zoom", img=img / "application-review" / "application-overview.png",
             kicker="Applications", title="Every application at a glance", sub="Search, filter by position and status, and open any application",
             spots=[(2.0, 5.2, r(0.03, 0.065, 0.46, 0.115))]),
        dict(kind="shot", len=6.5, tin="slide", img=img / "application-review" / "application-review-1.png",
             kicker="Review", title="Review candidates side by side", sub="Education, motivation and documents on one page, with ratings and internal comments",
             spots=[(1.4, 3.6, r(0.3, 0.14, 0.7, 0.38)), (3.9, 6.2, r(0.67, 0.37, 0.95, 0.95))]),
        dict(kind="shot", len=5.0, tin="slide", img=img / "application-review" / "application-review-document-dialog.png", fit=True,
             kicker="Documents", title="Read CVs and transcripts in place", sub="Switch between the documents without downloading them", cam=STILL),
        dict(kind="shot", len=6.5, tin="zoom", img=img / "interview" / "process-overview.png",
             kicker="Interviews", title="Plan interviews in a calendar", sub="Invite candidates, and they book a free slot themselves",
             spots=[(1.4, 3.8, r(0.04, 0.08, 0.96, 0.56)), (4.1, 6.2, r(0.04, 0.66, 0.5, 0.7))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "interview" / "slot-creation.png", fit=True,
             kicker="Slots", title="Create slots for several days", sub="Choose the dates, the length and the room in one dialog",
             cam=STILL, spots=[(1.2, 3.1, r(0.01, 0.13, 0.34, 0.5)), (3.4, 5.2, r(0.38, 0.09, 0.98, 0.88))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "interview" / "interviewee-assesment.png",
             kicker="Assessment", title="Rate each interview", sub="A score and notes that only your team can see",
             spots=[(1.8, 5.2, r(0.03, 0.08, 0.64, 0.5))]),
        dict(kind="outro", len=4.5, tin="zoom", title="Find your next doctoral candidate", sub="ls1intum.github.io/doc-apply"),
    ]


def applicant():
    """The applicant cut: finding a position, applying with AI help and following the application."""
    img = APPLICANT / "images"
    return [
        dict(kind="intro", len=4.5, title="DocApply for applicants", sub="Find your doctoral position at TUM and apply in a few steps"),
        dict(kind="shot", len=6.5, tin="zoom", img=img / "browse-jobs" / "find-positions.png",
             kicker="Find positions", title="Discover open doctoral positions", sub="Search and filter by subject, location and supervisor",
             spots=[(2.0, 6.2, r(0.03, 0.065, 0.65, 0.11))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "browse-jobs" / "job-detail-applicant-1.png",
             kicker="Position details", title="Everything about the position", sub="Research topic, tasks, requirements and the research group",
             cam=STILL, spots=[(1.4, 3.4, r(0.81, 0.15, 0.98, 0.56)), (3.6, 5.2, r(0.89, 0.005, 0.98, 0.055))]),
        dict(kind="shot", len=6.0, tin="slide", img=img / "applying" / "application-form-page1.png",
             kicker="Apply", title="Your profile fills the form", sub="Personal details and documents from your profile are already there",
             spots=[(1.6, 3.6, r(0.15, 0.19, 0.84, 0.45)), (3.8, 5.7, r(0.15, 0.52, 0.84, 0.76))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "ai-extraction" / "personal-information-cv-extraction.png", fit=True,
             kicker="AI extraction", title="Upload your CV, let AI fill in the rest", sub="Check the extracted information and you are done",
             cam=STILL, spots=[(1.4, 5.2, r(0.79, 0.66, 0.98, 0.89))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "applying" / "application-form-page3_1.png",
             kicker="Motivation", title="Tell the group why you", sub="Your motivation, skills and research experience",
             spots=[(1.8, 5.2, r(0.15, 0.5, 0.85, 0.71))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "recommendation-letters" / "recommendation-letters-step.png", fit=True,
             kicker="Recommendations", title="Add your recommenders", sub="They receive a secure link to upload their letter",
             cam=STILL, spots=[(1.4, 5.2, r(0.0, 0.7, 1.0, 0.86))]),
        dict(kind="shot", len=6.0, tin="zoom", img=img / "applying" / "application-form-page4_1.png",
             kicker="Submit", title="Review and submit", sub="A summary of your application before you send it",
             cam=STILL, spots=[(1.4, 3.6, r(0.03, 0.26, 0.6, 0.96)), (3.9, 5.7, r(0.87, 0.955, 0.96, 0.99))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "overview" / "application-overview.png",
             kicker="Track", title="Always know where you stand", sub="The status of every application, from draft to interview",
             spots=[(1.8, 5.2, r(0.55, 0.11, 0.68, 0.58))]),
        dict(kind="shot", len=5.0, tin="slide", img=img / "settings" / "settings-notifications.png",
             kicker="Notifications", title="Never miss a position", sub="Get an email when a position in your subject areas opens",
             spots=[(1.6, 4.7, r(0.12, 0.37, 0.86, 0.53))]),
        dict(kind="outro", len=4.5, tin="zoom", title="Start your doctorate at TUM", sub="ls1intum.github.io/doc-apply"),
    ]


PROF_IMG = PROFESSOR / "images"
APPL_IMG = APPLICANT / "images"


def intro(title, sub):
    """The opening card of a page trailer: the logo, the feature and one line about it."""
    return dict(kind="intro", len=3.0, title=title, sub=sub)


def research_groups():
    """Registering a research group from the FAQ."""
    return [
        intro("Research groups", "Register your group once, then your whole team can recruit"),
        dict(kind="shot", len=7.0, tin="zoom", img=PROF_IMG / "research-groups" / "faq-research-group-registration.png",
             kicker="Registration", title="Register your research group", sub="Fill in the form from the FAQ, and an admin confirms your group",
             spots=[(1.2, 4.0, r(0.18, 0.28, 0.82, 0.55)), (4.3, 7.2, r(0.43, 0.475, 0.57, 0.535))]),
    ]


def create_job():
    """The four steps of creating a position."""
    img = PROF_IMG / "create-job"
    return [
        intro("Create a position", "Four steps from the first idea to the published posting"),
        dict(kind="shot", len=5.0, tin="zoom", img=img / "job-creation-form-1.png",
             kicker="Step 1", title="Basic information", sub="Title, research area, supervisor and the description",
             spots=[(1.0, 3.0, r(0.04, 0.23, 0.64, 0.5)), (3.2, 5.3, r(0.04, 0.75, 0.64, 0.93))]),
        dict(kind="shot", len=4.5, tin="slide", img=img / "job-creation-form-2.png",
             kicker="Step 2", title="Employment terms", sub="Deadline, start date, workload, funding and recommendations",
             spots=[(1.0, 2.8, r(0.15, 0.19, 0.93, 0.36)), (3.0, 4.8, r(0.15, 0.48, 0.93, 0.56))]),
        dict(kind="shot", len=4.5, tin="slide", img=img / "job-creation-form-3.png",
             kicker="Step 3", title="Banner image", sub="Pick an image from your group's collection or upload a new one",
             spots=[(1.2, 4.8, r(0.16, 0.56, 0.84, 0.87))]),
        dict(kind="shot", len=5.0, tin="slide", img=img / "job-creation-form-4_1.png",
             kicker="Step 4", title="Check and publish", sub="See the posting as applicants will, then publish it",
             cam=STILL, spots=[(1.0, 3.0, r(0.63, 0.33, 0.97, 0.73)), (3.2, 5.3, r(0.87, 0.955, 0.98, 0.99))]),
    ]


def ai_writing():
    """The AI assistant in the job form: drafting, quality score and translation."""
    form = PROF_IMG / "create-job" / "job-creation-form-1.png"
    return [
        intro("AI writing and translation", "Let the assistant draft, check and translate your posting"),
        dict(kind="shot", len=5.0, tin="zoom", img=form,
             kicker="Draft", title="AI writes the description", sub="Start from the key facts, and the assistant writes or improves the text",
             spots=[(1.0, 2.8, r(0.39, 0.715, 0.645, 0.755)), (3.0, 5.3, r(0.04, 0.75, 0.64, 0.93))]),
        dict(kind="shot", len=5.0, tin="zoom", img=form, cam=[(0, 0.82, 0.3, 0.45), (0.42, 0.82, 0.3, 0.45), (0.56, 0.82, 0.5, 0.45), (1, 0.82, 0.5, 0.45)],
             kicker="Check", title="Quality score and compliance", sub="A score and concrete hints for clear, inclusive and correct postings",
             spots=[(1.0, 2.8, r(0.72, 0.14, 0.96, 0.41)), (3.0, 5.3, r(0.72, 0.43, 0.96, 0.69))]),
        dict(kind="shot", len=5.0, tin="slide", img=PROF_IMG / "ai-writing-and-translation" / "position-details-translation.png", fit=True,
             kicker="Translate", title="English and German, automatically", sub="Write in one language; DocApply translates the other one",
             cam=STILL, spots=[(1.0, 5.3, r(0.3, 0.19, 0.6, 0.27))]),
        dict(kind="shot", len=4.5, tin="slide", img=PROF_IMG / "create-job" / "job-creation-form-4_2.png",
             kicker="Summary", title="Both languages before you publish", sub="Check the German text next to the English one",
             spots=[(1.0, 4.8, r(0.02, 0.0, 0.62, 0.46))]),
    ]


def manage_jobs():
    """The positions list and the detail page of a position."""
    img = PROF_IMG / "manage-jobs"
    return [
        intro("Manage positions", "Keep track of every position your group has posted"),
        dict(kind="shot", len=5.0, tin="zoom", img=img / "my-positions.png",
             kicker="Positions", title="All your positions in one list", sub="Search, filter and see the status of every position",
             spots=[(1.2, 5.3, r(0.46, 0.19, 0.58, 0.56))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "job-detail-professor-1.png",
             kicker="Details", title="Everything about a position", sub="The description and key facts, with export and close at the top",
             cam=STILL, spots=[(1.0, 3.2, r(0.63, 0.15, 0.97, 0.49)), (3.4, 5.8, r(0.785, 0.005, 0.965, 0.06))]),
        dict(kind="shot", len=4.5, tin="slide", img=img / "job-detail-professor-2.png",
             kicker="Languages", title="In English and German", sub="Applicants read the posting in the language they choose",
             spots=[(1.0, 4.8, r(0.02, 0.0, 0.62, 0.56))]),
    ]


def application_review():
    """Finding, reviewing and deciding on applications."""
    img = PROF_IMG / "application-review"
    return [
        intro("Review applications", "Read, compare and decide on candidates in one place"),
        dict(kind="shot", len=5.0, tin="zoom", img=img / "application-overview.png",
             kicker="Overview", title="Every application at a glance", sub="Search, filter by position and status, and open any application",
             spots=[(1.2, 5.3, r(0.03, 0.065, 0.46, 0.115))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "application-review-1.png",
             kicker="Review", title="Candidates side by side", sub="Ratings and internal comments next to the application",
             spots=[(1.0, 3.2, r(0.3, 0.14, 0.7, 0.38)), (3.4, 5.8, r(0.67, 0.37, 0.95, 0.95))]),
        dict(kind="shot", len=5.0, tin="slide", img=img / "application-review-2.png",
             kicker="Decide", title="Accept, reject or invite", sub="Education, motivation and documents, then one click to decide",
             spots=[(1.0, 3.0, r(0.66, 0.31, 0.98, 0.97)), (3.2, 5.3, r(0.61, 0.235, 0.965, 0.285))]),
        dict(kind="shot", len=4.5, tin="slide", img=img / "application-review-document-dialog.png", fit=True,
             kicker="Documents", title="Read documents in place", sub="CVs, transcripts and letters without downloading them", cam=STILL),
    ]


def interview():
    """Planning interviews, creating slots and assessing candidates."""
    img = PROF_IMG / "interview"
    return [
        intro("Interviews", "From the invitation to the assessment"),
        dict(kind="shot", len=5.0, tin="zoom", img=img / "interview-overview.png",
             kicker="Overview", title="Interviews for all positions", sub="How many candidates are invited and booked, and what comes next",
             spots=[(1.0, 3.0, r(0.03, 0.15, 0.97, 0.37)), (3.2, 5.3, r(0.08, 0.53, 0.5, 0.76))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "process-overview.png",
             kicker="Plan", title="Slots in a calendar", sub="Invite candidates, and they book a free slot themselves",
             spots=[(1.0, 3.4, r(0.04, 0.08, 0.96, 0.56)), (3.6, 5.8, r(0.04, 0.66, 0.5, 0.7))]),
        dict(kind="shot", len=5.0, tin="slide", img=img / "slot-creation.png", fit=True,
             kicker="Slots", title="Create slots for several days", sub="Choose the dates, the length and the room in one dialog",
             cam=STILL, spots=[(1.0, 2.9, r(0.01, 0.13, 0.34, 0.5)), (3.1, 5.3, r(0.38, 0.09, 0.98, 0.88))]),
        dict(kind="shot", len=4.5, tin="slide", img=img / "interviewee-assesment.png",
             kicker="Assess", title="Rate each interview", sub="A score and notes that only your team can see",
             spots=[(1.2, 4.8, r(0.03, 0.08, 0.64, 0.5))]),
    ]


def settings():
    """The applicant settings: profile, saved application data and notifications."""
    img = APPL_IMG / "settings"
    return [
        intro("Settings", "Your profile, your documents and your notifications"),
        dict(kind="shot", len=5.0, tin="zoom", img=img / "settings-general.png",
             kicker="General", title="Profile picture and preferences", sub="A photo, passkeys, the theme and the AI features",
             spots=[(1.0, 3.0, r(0.13, 0.13, 0.87, 0.23)), (3.2, 5.3, r(0.13, 0.6, 0.87, 0.73))]),
        dict(kind="shot", len=4.0, tin="slide", img=img / "settings-profile-picture-dialog.png", fit=True,
             kicker="Profile picture", title="Crop and save your photo", sub="Professors see it with your applications",
             cam=STILL, spots=[(1.0, 4.3, r(0.69, 0.86, 0.855, 0.935))]),
        dict(kind="shot", len=5.0, tin="slide", img=img / "settings-application-information-1.png",
             kicker="Application information", title="Fill it in once", sub="Your CV and contact details prefill every future application",
             spots=[(1.0, 3.0, r(0.14, 0.26, 0.86, 0.4)), (3.2, 5.3, r(0.14, 0.415, 0.86, 0.5))]),
        dict(kind="shot", len=5.0, tin="slide", img=img / "settings-notifications.png",
             kicker="Notifications", title="Never miss a position", sub="Get an email when a position in your subject areas opens",
             spots=[(1.2, 5.3, r(0.12, 0.355, 0.86, 0.53))]),
    ]


def browse_positions():
    """Searching positions and reading a position."""
    img = APPL_IMG / "browse-jobs"
    return [
        intro("Browse positions", "Find the doctoral position that fits you"),
        dict(kind="shot", len=5.5, tin="zoom", img=img / "find-positions.png",
             kicker="Search", title="Discover open positions", sub="Search and filter by subject, location and supervisor",
             spots=[(1.2, 5.8, r(0.03, 0.065, 0.65, 0.11))]),
        dict(kind="shot", len=5.0, tin="slide", img=img / "job-detail-applicant-1.png",
             kicker="Details", title="Everything about the position", sub="Research topic, tasks, requirements and key facts",
             cam=STILL, spots=[(1.0, 3.0, r(0.81, 0.15, 0.98, 0.56)), (3.2, 5.3, r(0.89, 0.005, 0.98, 0.055))]),
        dict(kind="shot", len=4.5, tin="slide", img=img / "job-detail-applicant-2.png",
             kicker="Research group", title="Get to know the group", sub="Who they are, where they work and how to reach them",
             spots=[(1.0, 4.8, r(0.62, 0.06, 0.97, 0.52))]),
    ]


def apply():
    """The application form from personal information to submitting."""
    img = APPL_IMG / "applying"
    return [
        intro("Apply", "Send your application in a few steps"),
        dict(kind="shot", len=5.0, tin="zoom", img=img / "application-form-page1.png",
             kicker="Personal information", title="Your profile fills the form", sub="Contact details and documents are already there",
             spots=[(1.0, 3.0, r(0.15, 0.19, 0.84, 0.49)), (3.2, 5.3, r(0.15, 0.52, 0.84, 0.76))]),
        dict(kind="shot", len=5.0, tin="slide", img=img / "application-form-page2.png",
             kicker="Education", title="Degrees and grades", sub="Upload your certificates and add your study programs",
             spots=[(1.0, 3.0, r(0.15, 0.24, 0.84, 0.45)), (3.2, 5.3, r(0.15, 0.58, 0.84, 0.88))]),
        dict(kind="shot", len=5.0, tin="slide", img=img / "application-form-page3_1.png",
             kicker="Application details", title="Tell the group why you", sub="Your motivation, skills and research experience",
             spots=[(1.2, 5.3, r(0.15, 0.5, 0.85, 0.71))]),
        dict(kind="shot", len=5.0, tin="slide", img=img / "application-form-page4_1.png",
             kicker="Summary", title="Review and submit", sub="Check everything once more, then send it",
             cam=STILL, spots=[(1.0, 3.0, r(0.03, 0.26, 0.6, 0.96)), (3.2, 5.3, r(0.87, 0.955, 0.96, 0.99))]),
    ]


def ai_extraction():
    """Filling in personal and education details from uploaded documents."""
    img = APPL_IMG / "ai-extraction"
    return [
        intro("AI extraction", "Upload your documents and let AI fill in the form"),
        dict(kind="shot", len=5.5, tin="zoom", img=img / "personal-information-cv-extraction.png", fit=True,
             kicker="CV", title="Personal details from your CV", sub="Check the extracted information and you are done",
             cam=STILL, spots=[(1.2, 5.8, r(0.79, 0.66, 0.98, 0.89))]),
        dict(kind="shot", len=5.5, tin="slide", img=img / "education-certificate-extraction.png", fit=True,
             kicker="Certificates", title="Degrees from your transcripts", sub="Study programs, universities and grades in one click",
             cam=STILL, spots=[(1.0, 3.0, r(0.785, 0.395, 0.955, 0.46)), (3.2, 5.8, r(0.0, 0.5, 1.0, 0.94))]),
    ]


def recommendation_letters():
    """Adding recommenders to an application."""
    return [
        intro("Recommendation letters", "Your recommenders upload their letters themselves"),
        dict(kind="shot", len=7.0, tin="zoom", img=APPL_IMG / "recommendation-letters" / "recommendation-letters-step.png", fit=True,
             kicker="Recommenders", title="Add your recommenders", sub="They receive a secure link to upload their letter",
             cam=STILL, spots=[(1.0, 3.6, r(0.0, 0.22, 1.0, 0.55)), (3.8, 7.2, r(0.0, 0.7, 1.0, 0.86))]),
    ]


def application_dashboard():
    """Following the status of the own applications."""
    return [
        intro("Your applications", "Follow every application from draft to decision"),
        dict(kind="shot", len=7.0, tin="zoom", img=APPL_IMG / "overview" / "application-overview.png",
             kicker="Track", title="Always know where you stand", sub="The status of every application, and what you can do next",
             spots=[(1.0, 3.8, r(0.55, 0.11, 0.68, 0.58)), (4.0, 7.2, r(0.88, 0.12, 0.97, 0.57))]),
    ]


PAGE_TRAILERS = {
    "research-groups": (research_groups, PROFESSOR),
    "create-job": (create_job, PROFESSOR),
    "ai-writing-and-translation": (ai_writing, PROFESSOR),
    "manage-jobs": (manage_jobs, PROFESSOR),
    "application-review": (application_review, PROFESSOR),
    "interview": (interview, PROFESSOR),
    "settings": (settings, APPLICANT),
    "browse-positions": (browse_positions, APPLICANT),
    "apply": (apply, APPLICANT),
    "ai-extraction": (ai_extraction, APPLICANT),
    "recommendation-letters": (recommendation_letters, APPLICANT),
    "application-dashboard": (application_dashboard, APPLICANT),
}


CUTS = {
    "professor": (professor, PROFESSOR / "videos" / "trailer-professor.mp4", DURATION),
    "applicant": (applicant, APPLICANT / "videos" / "trailer-applicant.mp4", DURATION),
}
for page, (storyboard, audience) in PAGE_TRAILERS.items():
    CUTS[page] = (storyboard, audience / "videos" / f"trailer-{page}.mp4", None)


def render(name, storyboard, target, duration, preview):
    """Renders one cut to an MP4 file, or stills at the given timestamps."""
    scenes = timeline(storyboard(), duration)
    duration = scenes[-1]["end"]
    if preview:
        target.parent.mkdir(parents=True, exist_ok=True)
        for t in preview:
            path = target.parent / f"{name}-{t:05.1f}s.png"
            frame_at(t, scenes).save(path)
            print(f"wrote {path}")
        return
    ffmpeg = shutil.which("ffmpeg") or sys.exit("ffmpeg is required: brew install ffmpeg")
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "frames.raw"
        with raw.open("wb") as out:
            for i in range(int(duration * FPS)):
                out.write(frame_at(i / FPS, scenes).tobytes())
                if i % FPS == 0:
                    print(f"\r{name}: {i // FPS:2d}/{int(duration)} s", end="", flush=True)
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                        "-i", str(raw), "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-tune", "animation",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target)], check=True)
    print(f"\r{name}: wrote {target} ({target.stat().st_size / 1e6:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--cut", choices=sorted(CUTS), action="append", help="the cut to render (default: all)")
    parser.add_argument("--out", type=Path, help="a directory for the videos instead of the documentation folders")
    parser.add_argument("--preview", help="comma-separated timestamps in seconds; writes stills instead of a video")
    parser.add_argument("--font", help="another font file, for systems without Avenir Next")
    args = parser.parse_args()
    if args.font:
        FONTS["sans"] = args.font
        global BOLD, DEMI, MEDIUM, REGULAR
        BOLD = DEMI = MEDIUM = REGULAR = 0
    preview = [float(t) for t in args.preview.split(",")] if args.preview else None
    for name in args.cut or sorted(CUTS):
        storyboard, target, duration = CUTS[name]
        if args.out or preview:
            target = (args.out or REPO / "build" / "trailers") / target.name
        render(name, storyboard, target, duration, preview)


if __name__ == "__main__":
    main()
