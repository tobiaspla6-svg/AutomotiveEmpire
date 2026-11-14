#!/usr/bin/env python3
"""Concept-media ingest for Automotive Empire (visual-production workflow).

Offline only: no network, no Higgsfield access, no credentials. Pillow + NumPy.
Concept media are 2D pictures/videos. They are NOT 3D models and never enter the game (geometry is always "none").

  ingest.py validate
  ingest.py add FILE --kind K [--family F --view V] --prompt-id ID --prompt-file P --model NAME [options]
  ingest.py overlay GENERATED BLUEPRINT --wheels fx,fy,rx,ry --bp-wheels fx,fy,rx,ry --out OUT
  ingest.py blender-refs FAMILY [--stage DIR]
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CONCEPTS = os.path.join(ROOT, "assets-src", "concepts")
MANIFEST = os.path.join(CONCEPTS, "manifest.json")
BLUEPRINTS = os.path.join(ROOT, "assets-src", "sedan-ref", "references")

KINDS = {"vehicle-view", "background", "ui-mood", "motorsport", "video", "video-still"}
VIEWS = {"front34", "side", "front", "rear", "rear34"}
USES = {"marketing", "store-art", "blender-reference", "internal-mood", "trailer", "ui-background"}
STILL_DIRS = {"vehicle-view": "vehicles", "background": "backgrounds", "ui-mood": "ui-mood", "motorsport": "motorsport", "video-still": "video-stills"}
REQUIRED = ["id", "kind", "sha256", "source", "model", "generated_at", "prompt_id", "prompt_sha256", "rights", "intended_use", "geometry", "status"]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load():
    if not os.path.exists(MANIFEST):
        return {"schema": 1, "assets": []}
    with open(MANIFEST) as f:
        return json.load(f)


def save(m):
    with open(MANIFEST, "w") as f:
        json.dump(m, f, indent=2, ensure_ascii=False)
        f.write("\n")


def problems(m):
    out = []
    if m.get("schema") != 1:
        out.append("manifest.schema must be 1")
    seen = set()
    for a in m.get("assets", []):
        i = a.get("id", "?")
        for k in REQUIRED:
            if k not in a:
                out.append(f"{i}: missing field '{k}'")
        if i in seen:
            out.append(f"{i}: duplicate id")
        seen.add(i)
        if a.get("kind") not in KINDS:
            out.append(f"{i}: kind must be one of {sorted(KINDS)}")
        if a.get("geometry") != "none":
            out.append(f"{i}: geometry must be \"none\" (concept media are not 3D)")
        if a.get("kind") == "vehicle-view" and a.get("view") not in VIEWS:
            out.append(f"{i}: view must be one of {sorted(VIEWS)}")
        bad = set(a.get("intended_use", [])) - USES
        if bad:
            out.append(f"{i}: unknown intended_use {sorted(bad)}")
        src = a.get("source", {})
        if src.get("provider") and not src.get("job_id") and not src.get("surface"):
            out.append(f"{i}: source needs a surface or job_id")
        r = a.get("rights", {})
        for k in ("basis", "terms_retrieved", "third_party_inputs", "trademark_screen"):
            if k not in r:
                out.append(f"{i}: rights.{k} missing")
        if a.get("kind") == "video":
            if not a.get("storage", {}).get("location"):
                out.append(f"{i}: video needs storage.location (videos are not committed to git)")
        else:
            f = a.get("file")
            p = os.path.join(CONCEPTS, f) if f else None
            if not p or not os.path.exists(p):
                out.append(f"{i}: file missing ({f})")
            elif sha256(p) != a.get("sha256"):
                out.append(f"{i}: sha256 mismatch for {f}")
        pf = os.path.join(CONCEPTS, "prompts", f"{a.get('prompt_id')}.txt")
        if not os.path.exists(pf):
            out.append(f"{i}: prompt file prompts/{a.get('prompt_id')}.txt missing")
        elif sha256(pf) != a.get("prompt_sha256"):
            out.append(f"{i}: prompt sha256 mismatch")
    return out


def cmd_validate(_):
    m = load()
    pr = problems(m)
    for p in pr:
        print("  FAIL", p)
    print(f"{len(m.get('assets', []))} asset(s), {len(pr)} problem(s)")
    return 1 if pr else 0


def cmd_add(a):
    from PIL import Image
    if a.kind not in KINDS or a.kind == "video":
        sys.exit("add handles stills; videos are stored outside git: add their entry by hand with storage.location")
    if a.kind == "vehicle-view" and (not a.family or a.view not in VIEWS):
        sys.exit("vehicle-view needs --family and --view (" + ", ".join(sorted(VIEWS)) + ")")
    for u in a.use:
        if u not in USES:
            sys.exit(f"--use must be one of {sorted(USES)}")
    if not a.use:
        sys.exit("--use is required (intended use)")
    if not os.path.exists(a.file) or not os.path.exists(a.prompt_file):
        sys.exit("FILE and --prompt-file must exist")
    try:
        datetime.fromisoformat(a.generated_at.replace("Z", "+00:00"))
    except ValueError:
        sys.exit("--generated-at must be an ISO date-time, e.g. 2026-11-15T10:00:00Z")
    m = load()
    sub = STILL_DIRS[a.kind]
    name = f"{a.view}.webp" if a.kind == "vehicle-view" else re.sub(r"[^A-Za-z0-9._-]+", "-", a.name or os.path.splitext(os.path.basename(a.file))[0]) + ".webp"
    rel = os.path.join(sub, a.family, name) if a.kind == "vehicle-view" else os.path.join(sub, name)
    dest = os.path.join(CONCEPTS, rel)
    aid = a.id or (f"{a.family.split('-')[0].upper()}-{a.view}" if a.kind == "vehicle-view" else os.path.splitext(name)[0])
    if any(x["id"] == aid for x in m["assets"]):
        sys.exit(f"id {aid} already in the manifest (use --id for a variant)")
    im = Image.open(a.file)
    im.load()
    original = sha256(a.file)
    if max(im.size) > 2560:
        s = 2560 / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    im.convert("RGB").save(dest, "WEBP", quality=90, method=6)
    pdst = os.path.join(CONCEPTS, "prompts", f"{a.prompt_id}.txt")
    os.makedirs(os.path.dirname(pdst), exist_ok=True)
    shutil.copyfile(a.prompt_file, pdst)
    entry = {
        "id": aid, "kind": a.kind, "family": a.family, "view": a.view, "file": rel.replace(os.sep, "/"),
        "sha256": sha256(dest), "bytes": os.path.getsize(dest), "width": im.width, "height": im.height, "original_sha256": original,
        "source": {"provider": "Higgsfield", "surface": a.surface, "job_id": a.job_id},
        "model": {"name": a.model, "version": a.model_version, "mode": a.mode},
        "generated_at": a.generated_at, "prompt_id": a.prompt_id, "prompt_sha256": sha256(pdst), "inputs": a.input,
        "credits_spent": a.credits,
        "rights": {"basis": "Higgsfield Terms of Service", "terms_retrieved": a.terms_date, "commercial_use": "permitted per provider terms (verify at sign-up)",
                   "owner_claim": "no ownership claimed by provider", "third_party_inputs": False, "c2pa_present": a.c2pa, "trademark_screen": a.trademark, "notes": a.notes},
        "intended_use": a.use, "geometry": "none", "status": "approved", "qa": {"checklist": "QA-VEH" if a.kind == "vehicle-view" else "QA-GENERAL", "reviewed_by": a.reviewed_by},
    }
    entry = {k: v for k, v in entry.items() if v is not None}
    m["assets"].append(entry)
    pr = problems(m)
    if pr:
        sys.exit("refusing to write the manifest:\n  " + "\n  ".join(pr))
    save(m)
    print(f"added {aid}: {rel} ({entry['bytes'] // 1024} KB)")
    return 0


def parse4(s):
    v = [float(x) for x in s.split(",")]
    if len(v) != 4:
        sys.exit("--wheels needs fx,fy,rx,ry (front and rear wheel-centre pixels)")
    return v


def cmd_overlay(a):
    from PIL import Image
    import numpy as np
    g, b = Image.open(a.generated).convert("RGBA"), Image.open(a.blueprint).convert("RGBA")
    gf, gy_f, gr, gy_r = parse4(a.wheels)
    bf, by_f, br, by_r = parse4(a.bp_wheels)
    # scale so the wheelbase matches, then translate so the front wheel centres coincide (side view, front to the left)
    wb_g, wb_b = abs(gf - gr), abs(bf - br)
    s = wb_b / wb_g
    g2 = g.resize((round(g.width * s), round(g.height * s)), Image.LANCZOS)
    ox, oy = round(bf - gf * s), round(by_f - gy_f * s)
    canvas = Image.new("RGBA", b.size, (255, 255, 255, 255))
    canvas.paste(g2, (ox, oy), g2)
    out = Image.blend(canvas.convert("RGB"), b.convert("RGB"), 0.5)
    out.save(a.out)
    # report: how far the generated silhouette extends beyond the wheel centres, relative to the wheelbase
    arr = np.asarray(g.convert("L"), dtype=float)
    dark = arr < (arr.mean() - 0.5 * arr.std())  # crude body mask on a plain background; use a clean plate for reliable numbers
    xs = np.where(dark.any(axis=0))[0]
    ys = np.where(dark.any(axis=1))[0]
    if len(xs) and len(ys):
        left, right, top = xs.min(), xs.max(), ys.min()
        front_oh = abs(gf - left) / wb_g
        rear_oh = abs(right - gr) / wb_g
        roof = (gy_f - top) / wb_g
        print(f"generated: front overhang {front_oh:.3f} wb, rear overhang {rear_oh:.3f} wb, wheel-centre-to-roof {roof:.3f} wb")
    print(f"scale to blueprint {s:.3f}; overlay written to {a.out}. Judge against the tolerances in docs/visual-production/03-prompts.md.")
    return 0


def cmd_blender_refs(a):
    d = os.path.join(CONCEPTS, "vehicles", a.family)
    if not os.path.isdir(d):
        sys.exit(f"no folder {os.path.relpath(d, ROOT)}")
    ref = d
    if a.stage:
        os.makedirs(a.stage, exist_ok=True)
        for f in os.listdir(d):
            shutil.copyfile(os.path.join(d, f), os.path.join(a.stage, f))
        for stem in ("top",):  # parametric blueprint view that AI does not produce
            for ext in (".png",):
                s = os.path.join(BLUEPRINTS, stem + ext)
                if os.path.exists(s) and not os.path.exists(os.path.join(a.stage, stem + ext)):
                    shutil.copyfile(s, os.path.join(a.stage, stem + ext))
        ref = a.stage
        print("staged", sorted(os.listdir(a.stage)))
    print("blender -b --factory-startup --python tools/blender/sedan/build.py -- --no-export --references=" + os.path.relpath(ref, ROOT))
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    s = p.add_subparsers(dest="cmd", required=True)
    s.add_parser("validate").set_defaults(fn=cmd_validate)
    a = s.add_parser("add")
    a.add_argument("file"); a.add_argument("--kind", required=True); a.add_argument("--family"); a.add_argument("--view"); a.add_argument("--name"); a.add_argument("--id")
    a.add_argument("--prompt-id", required=True); a.add_argument("--prompt-file", required=True); a.add_argument("--model", required=True); a.add_argument("--model-version"); a.add_argument("--mode", default="image")
    a.add_argument("--surface", required=True, choices=["mcp", "cli", "web"]); a.add_argument("--job-id"); a.add_argument("--generated-at", required=True)
    a.add_argument("--credits", type=float); a.add_argument("--use", action="append", default=[]); a.add_argument("--input", action="append", default=[])
    a.add_argument("--terms-date", default="2026-11-14"); a.add_argument("--c2pa", default="unknown"); a.add_argument("--trademark", default="pending", choices=["pending", "pass", "fail"])
    a.add_argument("--notes", default=""); a.add_argument("--reviewed-by", default="")
    a.set_defaults(fn=cmd_add)
    o = s.add_parser("overlay")
    o.add_argument("generated"); o.add_argument("blueprint"); o.add_argument("--wheels", required=True, help="fx,fy,rx,ry in the generated image")
    o.add_argument("--bp-wheels", required=True, help="fx,fy,rx,ry in the blueprint"); o.add_argument("--out", required=True)
    o.set_defaults(fn=cmd_overlay)
    r = s.add_parser("blender-refs"); r.add_argument("family"); r.add_argument("--stage"); r.set_defaults(fn=cmd_blender_refs)
    a = p.parse_args()
    sys.exit(a.fn(a))


if __name__ == "__main__":
    main()
