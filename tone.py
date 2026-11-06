#!/usr/bin/env python3
"""Bass/treble for Mymoode's knobs, stored in the active CamillaDSP config.

Filters follow CamillaGUI's "Equalizer" recommendation, and use its names, so
CamillaGUI's Bass/Treble shortcuts control the same filters:
  Bass:   Biquad Lowshelf  freq=85   q=0.9
  Treble: Biquad Highshelf freq=6500 q=0.7

  tone.py get              -> {"ok", "available", "bass", "treble"}
  tone.py set BASS TREBLE  -> writes gains to the config file (survives the per-stream
                              CamillaDSP restarts) and patches the running instance live
  tone.py install          -> adds the filters at 0 dB if the active config lacks them,
                              migrating the earlier tone_* filters

No automatic headroom: boosts raise the level, so big boosts can clip at high volume.
"""
import json
import os
import sys
import tempfile

import yaml

CONFIG = os.path.realpath("/usr/share/camilladsp/working_config.yml")
LIMIT = 12.0  # dB either way, as in CamillaGUI's shortcut
FILTERS = {
    "Bass": {"type": "Biquad", "description": None,
             "parameters": {"type": "Lowshelf", "freq": 85, "q": 0.9, "gain": 0.0}},
    "Treble": {"type": "Biquad", "description": None,
               "parameters": {"type": "Highshelf", "freq": 6500, "q": 0.7, "gain": 0.0}},
}
LEGACY = {"tone_bass": "Bass", "tone_treble": "Treble", "tone_headroom": None}


def out(**kw):
    print(json.dumps(kw))
    sys.exit(0 if kw.get("ok") else 1)


def load():
    with open(CONFIG) as f:
        return yaml.safe_load(f)


def save(cfg):
    # Atomic replace in the same dir, keeping the original owner/mode
    st = os.stat(CONFIG)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(CONFIG), suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        yaml.safe_dump(cfg, f, default_flow_style=False, sort_keys=True)
    os.chmod(tmp, st.st_mode & 0o777)
    try:
        os.chown(tmp, st.st_uid, st.st_gid)
    except PermissionError:
        pass
    os.replace(tmp, CONFIG)


def in_pipeline(cfg, name):
    return any(name in (s.get("names") or []) for s in cfg.get("pipeline") or [] if s.get("type") == "Filter")


def has_tone(cfg):
    f = cfg.get("filters") or {}
    return all(k in f and in_pipeline(cfg, k) for k in FILTERS) and not any(k in f for k in LEGACY)


def push_live(patch):
    """Patch the running CamillaDSP, if a stream is playing. Not fatal if it isn't."""
    try:
        from camilladsp import CamillaClient
        c = CamillaClient("127.0.0.1", 1234)
        c.connect()
        c.config.patch(patch)
        c.disconnect()
        return True
    except Exception:
        return False


def install(cfg):
    filters = cfg.setdefault("filters", {})
    kept = {}
    # Migrate the earlier tone_* filters, keeping their gains
    for old, new in LEGACY.items():
        if old in filters:
            if new:
                kept[new] = filters[old]["parameters"].get("gain", 0.0)
            del filters[old]
    pipeline = []
    for step in cfg.get("pipeline") or []:
        if step.get("type") == "Filter":
            names = [n for n in step.get("names") or [] if n not in LEGACY]
            if not names:
                continue  # the old tone step
            step["names"] = names
        pipeline.append(step)
    for name, spec in FILTERS.items():
        if name not in filters:
            filters[name] = json.loads(json.dumps(spec))
            filters[name]["parameters"]["gain"] = kept.get(name, 0.0)
    missing = [n for n in FILTERS if not in_pipeline({"pipeline": pipeline}, n)]
    if missing:
        # Before the 2->3 crossover mixer, so bass changes reach the sub too
        pipeline.insert(0, {"type": "Filter", "channels": [0, 1], "names": missing,
                            "bypassed": None, "description": None})
    cfg["pipeline"] = pipeline


def main():
    op = sys.argv[1] if len(sys.argv) > 1 else "get"
    cfg = load()

    if op == "install":
        if has_tone(cfg):
            out(ok=True, changed=False)
        install(cfg)
        save(cfg)
        out(ok=True, changed=True)

    if not has_tone(cfg):
        out(ok=True, available=False, config=os.path.basename(CONFIG))

    f = cfg["filters"]
    if op == "get":
        out(ok=True, available=True, limit=LIMIT,
            bass=f["Bass"]["parameters"]["gain"], treble=f["Treble"]["parameters"]["gain"])

    if op == "set":
        try:
            b, t = (max(-LIMIT, min(LIMIT, round(float(v) * 2) / 2)) for v in sys.argv[2:4])
        except ValueError:
            out(ok=False, error="bass and treble must be numbers")
        f["Bass"]["parameters"]["gain"] = b
        f["Treble"]["parameters"]["gain"] = t
        save(cfg)
        live = push_live({"filters": {"Bass": {"parameters": {"gain": b}},
                                      "Treble": {"parameters": {"gain": t}}}})
        out(ok=True, available=True, bass=b, treble=t, live=live)

    out(ok=False, error="usage: tone.py get | set BASS TREBLE | install")


if __name__ == "__main__":
    main()
