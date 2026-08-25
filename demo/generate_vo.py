#!/usr/bin/env python3
"""Walkthrough VO from the new VoiceBank recordings.

Uses a clean speaker reference built from identity + Harvard + prosody
takes — never the old session tape that leaked “untitled document”,
“nothing uploaded”, and the pangram into Spark.

Each line is Spark + adapter + stylebank, then Whisper-checked.
Leaked corpus phrases fail the line. Not macOS say / Daniel.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

BANK = Path.home() / "VoiceBank" / "vitalie-cervinschi"
sys.path.insert(0, str(BANK / "scripts"))

from enhance import clean_register  # noqa: E402
from synth import FORBIDDEN, heard_text, spark_clone  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "demo" / "renders"
MASTER = WORK / "aphelion-vo.wav"
CLEAN_REF = WORK / "speaker-ref-clean-18s.wav"

# New library takes (Aug 19–23). Skip Voice Memo titles and the old
# Cedars / museum / pangram session tape.
REF_TAKES = [
    BANK / "takes" / "A03-neutral.m4a.m4a",
    BANK / "takes" / "A01-name.m4a.m4a",
    BANK / "takes" / "H01.m4a.m4a",
    BANK / "takes" / "H03.m4a.m4a",
    BANK / "takes" / "H05.m4a.m4a",
    BANK / "takes" / "S06-prosody-001.m4a",
]

LEAK = re.compile(
    r"untitled|nothing uploaded|lazy (dog|talk)|quick brown fox|"
    r"museum of the work|agent orchestra|jerobok|talk naturally|"
    r"do not read|sentence types|hello,? jero",
    re.I,
)

LINES = [
    {
        "scene": "open",
        "click": None,
        "speak": (
            "This is Aphelion on Midnight. The viewport is a photon ring. "
            "Mass, spin, and distance change the disk you see."
        ),
        "need": ("aphelion", "midnight", "photon"),
    },
    {
        "scene": "private",
        "click": None,
        "speak": (
            "The left panel is private. Right ascension, declination, "
            "and both secrets stay in the witness."
        ),
        "need": ("private", "secrets", "witness"),
    },
    {
        "scene": "observe",
        "click": "observeBtn",
        "speak": (
            "Observe computes private photometry. The sky stays redacted. "
            "Only a hash of the strain is shown."
        ),
        "need": ("observe", "private", "redacted"),
    },
    {
        "scene": "accredit",
        "click": "issueBtn",
        "speak": (
            "Accredit publishes an attestation root. "
            "The instrument secret never reaches the ledger."
        ),
        "need": ("accredit", "attestation", "ledger"),
    },
    {
        "scene": "file",
        "click": "fileBtn",
        "speak": (
            "File circuit proves the accredited instrument cleared the public "
            "S N R band. The ledger learns class, band, epoch, and a nullifier. "
            "Not the sky."
        ),
        "need": ("circuit", "ledger", "nullifier"),
    },
    {
        "scene": "confirm",
        "click": "confirmBtn",
        "speak": (
            "Confirm sets the public status to confirmed. "
            "Prove the universe answered. Never publish the sky."
        ),
        "need": ("confirm", "public", "sky"),
    },
]


def _decode_take(path: Path, sr_out: int = 24000) -> np.ndarray:
    ffmpeg = Path.home() / ".local" / "bin" / "ffmpeg"
    tmp = WORK / f"_take-{path.stem.replace(' ', '_')}.wav"
    WORK.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        [str(ffmpeg), "-y", "-i", str(path), "-ac", "1", "-ar", str(sr_out), str(tmp)],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0 or not tmp.is_file():
        raise RuntimeError(f"ffmpeg failed on {path}: {r.stderr[-400:]}")
    x, sr = sf.read(tmp, always_2d=False)
    tmp.unlink(missing_ok=True)
    x = np.asarray(x, dtype=np.float32)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != sr_out and len(x) > 8:
        x = resample_poly(x.astype(np.float64), sr_out, sr).astype(np.float32)
    return x


def build_clean_ref() -> Path:
    WORK.mkdir(parents=True, exist_ok=True)
    parts = []
    for take in REF_TAKES:
        if not take.is_file():
            raise FileNotFoundError(take)
        audio = _decode_take(take)
        audio = clean_register(audio, 24000)
        # drop a little edge silence so Voice Memo tails do not dominate
        n = max(1, int(0.08 * 24000))
        if len(audio) > 4 * n:
            audio = audio[n:-n]
        parts.append(audio)
        parts.append(np.zeros(int(0.12 * 24000), dtype=np.float32))
    cat = np.concatenate(parts)
    # Keep ~18s of mid-file speech for Spark's speaker prompt.
    target = int(18 * 24000)
    if len(cat) > target:
        start = max(0, (len(cat) - target) // 5)
        cat = cat[start : start + target]
    cat = clean_register(cat, 24000)
    peak = float(np.max(np.abs(cat)) + 1e-9)
    cat = (cat * (0.92 / peak)).astype(np.float32)
    sf.write(CLEAN_REF, cat, 24000, subtype="PCM_16")
    heard = heard_text(CLEAN_REF)
    if LEAK.search(heard or ""):
        raise RuntimeError(f"clean ref still leaks corpus: {heard!r}")
    (WORK / "speaker-ref-clean.json").write_text(
        json.dumps({"path": str(CLEAN_REF), "heard": heard, "takes": [str(p) for p in REF_TAKES]}, indent=2),
        encoding="utf-8",
    )
    return CLEAN_REF


def _ok(heard: str, need: tuple[str, ...]) -> bool:
    if LEAK.search(heard or ""):
        return False
    bag = set(re.findall(r"[a-z0-9]+", heard.lower()))
    hits = sum(1 for w in need if w in bag)
    return hits >= 2


def render_line(line: dict, dest: Path, ref: Path) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    last = {}
    for attempt in range(5):
        wav = spark_clone(
            line["speak"],
            dest,
            ref_audio=ref,
            apply_adapter=True,
            seed_offset=attempt * 97,
        )
        audio, sr = sf.read(wav, always_2d=False)
        audio = np.asarray(audio, dtype=np.float32)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != 24000:
            audio = resample_poly(audio.astype(np.float64), 24000, sr).astype(np.float32)
            sr = 24000
            sf.write(wav, audio, sr, subtype="PCM_16")
        heard = heard_text(wav)
        last = {
            "scene": line["scene"],
            "text": line["speak"],
            "click": line["click"],
            "heard": heard,
            "attempt": attempt,
            "wav": str(wav),
            "duration": float(len(audio) / sr),
            "ok": _ok(heard, line["need"]),
            "forbidden": [n for n in FORBIDDEN if n in heard.lower()],
        }
        dest.with_suffix(".json").write_text(json.dumps(last, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"scene": line["scene"], "ok": last["ok"], "heard": heard[:180]}))
        if last["ok"] and not last["forbidden"]:
            return last
    raise RuntimeError(f"could not get a clean take for {line['scene']}: {last.get('heard')!r}")


def engineer(x: np.ndarray, sr: int) -> np.ndarray:
    from enhance import compress, de_ess, highpass, lowpass, normalize_peak, trim_silence

    x = np.asarray(x, dtype=np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x = highpass(x, sr, 70.0)
    x = lowpass(x, sr, min(12000.0, 0.46 * sr))
    x = de_ess(x, sr, reduce=0.28)
    x = compress(x, sr, threshold=0.22, ratio=2.0)
    x = trim_silence(x, sr, floor_db=-50.0, pad_ms=180)
    x = normalize_peak(x, peak_db=-2.4)
    return x.astype(np.float32)


def main() -> int:
    WORK.mkdir(parents=True, exist_ok=True)
    ref = build_clean_ref()
    chunks = []
    timings = []
    t = 0.6
    sr_out = 24000
    for i, line in enumerate(LINES, 1):
        raw = WORK / f"{i:02d}-{line['scene']}.raw.wav"
        report = render_line(line, raw, ref)
        audio, sr = sf.read(raw, always_2d=False)
        audio = np.asarray(audio, dtype=np.float32)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != sr_out:
            audio = resample_poly(audio.astype(np.float64), sr_out, sr).astype(np.float32)
            sr = sr_out
        audio = engineer(audio, sr)
        breath = np.zeros(int(sr * 0.42), dtype=np.float32)
        chunks.append(audio)
        chunks.append(breath)
        timings.append(
            {
                "scene": line["scene"],
                "click": line["click"],
                "t": t,
                "duration": float(len(audio) / sr),
                "text": line["speak"],
                "heard": report["heard"],
            }
        )
        t += len(audio) / sr + 0.42
    master = np.concatenate(chunks)
    peak = float(np.max(np.abs(master)) + 1e-9)
    if peak > 0.95:
        master = master * (0.95 / peak)
    sf.write(MASTER, master, sr_out, subtype="PCM_16")
    master_heard = heard_text(MASTER)
    if LEAK.search(master_heard or ""):
        raise RuntimeError(f"master still leaks: {master_heard!r}")
    (WORK / "timings.json").write_text(
        json.dumps({"heard": master_heard, "lines": timings}, indent=2),
        encoding="utf-8",
    )
    print(MASTER)
    print(master_heard)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
