#!/usr/bin/env python3
"""Route Mymoode's transport buttons to whichever player actually owns the DAC.

  transport.py CMD    CMD = toggle|play|pause|stop|next|previous|repeat|random

Prints {"ok", "route", ...}. route "mpd" tells the page to send the command to MPD
as before; "bluetooth" means it was sent over AVRCP; "spotify"/"airplay" are
reported as not controllable from here (librespot has no local control interface).

Source detection, most reliable first:
  1. The process playing into the DAC right now: CamillaDSP's parent is
     bluealsa-aplay / librespot / shairport-sync / mpd.
  2. Nothing playing: moode's own flags (btactive, spotactive, aplactive).
"""
import glob
import json
import re
import sqlite3
import subprocess
import sys

DAC_STATUS = "/proc/asound/card*/pcm*p/sub*/status"
DB = "/var/local/www/db/moode-sqlite3.db"
CMDS = {"toggle", "play", "pause", "stop", "next", "previous", "repeat", "random"}
PARENTS = {"bluealsa-aplay": "bluetooth", "librespot": "spotify", "shairport-sync": "airplay", "mpd": "mpd"}


def out(**kw):
    print(json.dumps(kw))
    sys.exit(0)


def comm(pid):
    try:
        with open(f"/proc/{pid}/comm") as f:
            return f.read().strip()
    except OSError:
        return ""


def ppid(pid):
    try:
        with open(f"/proc/{pid}/stat") as f:
            return int(f.read().rsplit(")", 1)[1].split()[1])
    except (OSError, IndexError, ValueError):
        return 0


def playing_source():
    """Which renderer is playing into a sound card right now (any card), or None."""
    for status in glob.glob(DAC_STATUS):
        try:
            with open(status) as f:
                m = re.search(r"owner_pid\s*:\s*(\d+)", f.read())
        except OSError:
            continue
        pid = int(m.group(1)) if m else 0
        for _ in range(4):  # owner may be camilladsp itself; walk up to the renderer
            if not pid:
                break
            name = comm(pid)
            if name in PARENTS:
                return PARENTS[name]
            pid = ppid(pid)
    return None


def flag_source():
    try:
        con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=2)
        flags = dict(con.execute(
            "SELECT param, value FROM cfg_system WHERE param IN ('btactive','spotactive','aplactive')"))
        con.close()
    except sqlite3.Error:
        return "mpd"
    for key, src in (("btactive", "bluetooth"), ("spotactive", "spotify"), ("aplactive", "airplay")):
        if flags.get(key) == "1":
            return src
    return "mpd"


def busctl(*args):
    r = subprocess.run(["sudo", "-n", "busctl", "--system", *args], capture_output=True, text=True, timeout=5)
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def bt_player():
    rc, tree, _ = busctl("tree", "--list", "org.bluez")
    players = [p for p in tree.split() if re.search(r"/dev_[0-9A-F_]+/player\d+$", p)]
    return players[0] if players else None


def bt_get(path, prop):
    rc, val, _ = busctl("get-property", "org.bluez", path, "org.bluez.MediaPlayer1", prop)
    m = re.match(r's "(.*)"', val)
    return m.group(1) if rc == 0 and m else None


def bluetooth(cmd):
    path = bt_player()
    if not path:
        out(ok=False, route="bluetooth",
            error="This Bluetooth device doesn't accept remote control (no AVRCP player)")
    if cmd in ("repeat", "random"):
        prop = "Repeat" if cmd == "repeat" else "Shuffle"
        cur = bt_get(path, prop)
        if cur is None:
            out(ok=False, route="bluetooth", error=f"This Bluetooth device doesn't support {prop.lower()}")
        new = "off" if cur != "off" else "alltracks"
        rc, _, err = busctl("set-property", "org.bluez", path, "org.bluez.MediaPlayer1", prop, "s", new)
        out(ok=rc == 0, route="bluetooth", **({prop.lower(): new} if rc == 0 else {"error": err or "failed"}))
    if cmd == "toggle":
        cmd = "pause" if bt_get(path, "Status") == "playing" else "play"
    method = {"play": "Play", "pause": "Pause", "stop": "Stop", "next": "Next", "previous": "Previous"}[cmd]
    rc, _, err = busctl("call", "org.bluez", path, "org.bluez.MediaPlayer1", method)
    out(ok=rc == 0, route="bluetooth", sent=method, **({} if rc == 0 else {"error": err or "failed"}))


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd not in CMDS:
        out(ok=False, error="unknown command")
    src = playing_source() or flag_source()
    if src == "mpd":
        out(ok=True, route="mpd")
    if src == "bluetooth":
        bluetooth(cmd)
    app = {"spotify": "Spotify app", "airplay": "device that's casting (AirPlay)"}[src]
    out(ok=False, route=src, error=f"Control playback from the {app}")


if __name__ == "__main__":
    main()
