#!/usr/bin/env python3
"""Clone a longer-paragraph Aphelion demo VO from the Vitalie speaker reference.

Not macOS say / Daniel. Intermediates stay under the goal scratch or demo/renders
(gitignored). Do not commit wavs.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

BANK = Path.home() / "VoiceBank" / "vitalie-cervinschi"
sys.path.insert(0, str(BANK / "scripts"))

from clone import clone_text  # noqa: E402
from enhance import compress, de_ess, highpass, lowpass, normalize_peak, trim_silence  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "demo" / "renders"
MASTER = WORK / "aphelion-vo.wav"
REF = BANK / "enhanced" / "speaker-ref-22s.wav"
MODEL_ID = "mlx-community/Spark-TTS-0.5B-bf16"

LINES = [
    {
        "scene": "hook",
        "speak": (
            "Judges have seen privacy demos that hide a salary. "
            "Aphelion hides the sky. A Compact circuit on Midnight files a detection "
            "without publishing right ascension, declination, or the raw strain."
        ),
    },
    {
        "scene": "instrument",
        "speak": (
            "What you are looking at is the instrument: a photon ring around a spinning mass. "
            "The disk you see is the same physics that produces the private photometry."
        ),
    },
    {
        "scene": "circuit",
        "speak": (
            "The observer keeps a secret. The instrument keeps a secret. "
            "The ledger is allowed to learn only the class, the S N R band, the epoch, "
            "and a nullifier, so no one can file the same observation twice."
        ),
    },
    {
        "scene": "close",
        "speak": (
            "That is why Midnight exists. Prove the universe answered. Never publish the sky. "
            "This is Aphelion."
        ),
    },
]


def engineer(x: np.ndarray, sr: int) -> np.ndarray:
    x = np.asarray(x, dtype=np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x = highpass(x, sr, 70.0)
    x = lowpass(x, sr, min(12000.0, 0.46 * sr))
    x = de_ess(x, sr, reduce=0.28)
    x = compress(x, sr, threshold=0.22, ratio=2.0)
    x = trim_silence(x, sr, floor_db=-50.0, pad_ms=220)
    x = normalize_peak(x, peak_db=-2.4)
    return x.astype(np.float32)


def main() -> int:
    WORK.mkdir(parents=True, exist_ok=True)
    chunks = []
    sr_out = 24000
    timings = []
    t = 0.4
    for i, line in enumerate(LINES, 1):
        raw = WORK / f"{i:02d}-{line['scene']}.raw.wav"
        clone_text(line["speak"], raw, ref_audio=REF, model=MODEL_ID)
        audio, sr = sf.read(raw, always_2d=False)
        audio = np.asarray(audio, dtype=np.float32)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != sr_out and len(audio) > 8:
            n = int(round(len(audio) * sr_out / sr))
            audio = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(audio)), audio).astype(
                np.float32
            )
            sr = sr_out
        audio = engineer(audio, sr)
        breath = np.zeros(int(sr * 0.32), dtype=np.float32)
        chunks.append(audio)
        chunks.append(breath)
        timings.append({"scene": line["scene"], "t": t, "text": line["speak"]})
        t += len(audio) / sr + 0.32
    master = np.concatenate(chunks) if chunks else np.zeros(sr_out, dtype=np.float32)
    peak = float(np.max(np.abs(master)) + 1e-9)
    if peak > 0.95:
        master = master * (0.95 / peak)
    sf.write(MASTER, master, sr_out, subtype="PCM_16")
    (WORK / "timings.json").write_text(json.dumps(timings, indent=2), encoding="utf-8")
    print(MASTER)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
