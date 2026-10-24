#!/usr/bin/env python3
"""Compose the 5 Claude UGC scenes (1080x1920, captions burned, VO+music mixed) + master concat."""
import subprocess
import os

BASE = "/home/z/my-project/download/claude-ugc"
STOCK = f"{BASE}/stock"
FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

# name, src file, src seek, scene dur, vo file, vo delay ms, caption, src is portrait?
SCENES = [
    ("scene1", f"{STOCK}/mixkit-6208-720.mp4",   10.0, 6.6, "vo1", 300, "Drowning in emails?",     False),
    ("scene2", f"{STOCK}/mixkit-101542-vert.mp4", 0.5, 5.8, "vo2", 300, "Email drafted in seconds", True),
    ("scene3", f"{STOCK}/mixkit-49938-720.mp4",   8.5, 5.2, "vo3", 300, "Long doc? Summarized.",    True),
    ("scene4", f"{STOCK}/mixkit-41287-720.mp4",   0.5, 3.6, "vo4", 400, "Actually caught up.",      True),
    ("scene5", f"{STOCK}/mixkit-42323-1080.mp4",  6.0, 5.8, "vo5", 500, "Try Claude - claude.ai",   True),
]

os.makedirs(f"{BASE}/clips", exist_ok=True)

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("CMD FAILED:", " ".join(cmd)[:400])
        print(r.stderr[-1500:])
        raise SystemExit(1)

offset = 0.0
for name, src, seek, dur, vo, vdelay, caption, portrait in SCENES:
    esc = caption.replace(":", "\\:").replace("'", "\\'").replace(",", "\\,").replace("-", "\\-")
    alpha = "if(lt(t\\,0.25)\\,t/0.25\\,1)"
    vf = []
    if portrait:
        vf.append("scale=1080:1920:flags=lanczos")
    else:
        # 1280x720 landscape -> center-crop 9:16 then upscale
        vf.append("crop=405:720:(iw-405)/2:0,scale=1080:1920:flags=lanczos")
    vf.append("unsharp=5:5:0.4:5:5:0.0")
    vf.append("eq=contrast=1.05:saturation=1.14")
    vf.append(
        f"drawtext=fontfile={FONT}:text='{esc}':fontsize=78:fontcolor=white:"
        f"borderw=6:bordercolor=black@0.85:shadowx=0:shadowy=6:shadowcolor=black@0.5:"
        f"x=(w-text_w)/2:y=h-560:alpha='{alpha}'"
    )
    vf.append("fps=30,format=yuv420p")

    moff = offset
    af = (
        f"[1:a]volume=0.30,atrim=0:{dur}[mus];"
        f"[2:a]volume=2.0,adelay={vdelay}|{vdelay}[vo];"
        f"[mus][vo]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.88[a]"
    )
    out = f"{BASE}/clips/{name}.mp4"
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-ss", str(seek), "-t", str(dur), "-i", src,          # 0 video (+ its audio, ignored)
        "-ss", str(moff), "-t", str(dur + 0.5), "-i", f"{BASE}/music.wav",  # 1 music
        "-i", f"{BASE}/{vo}.mp3",                              # 2 vo
        "-filter_complex",
        f"[0:v]{','.join(vf)}[v];{af}",
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "21",
        "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart", "-shortest", out,
    ]
    run(cmd)
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out],
                           capture_output=True, text=True).stdout.strip()
    print(f"{name}: {probe}s  caption='{caption}'  music@{moff:.1f}")
    offset += dur

# master concat
with open(f"{BASE}/clips/concat.txt", "w") as f:
    for name, *_ in SCENES:
        f.write(f"file '{BASE}/clips/{name}.mp4'\n")
run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", f"{BASE}/clips/concat.txt",
     "-c", "copy", f"{BASE}/claude-ugc-master.mp4"])
probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "csv=p=0",
                        f"{BASE}/claude-ugc-master.mp4"], capture_output=True, text=True).stdout.strip()
print("MASTER:", probe)
