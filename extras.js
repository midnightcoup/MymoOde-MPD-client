// Mymoode extras (moode-tweaks add-on)
//  - BASS / TREBLE knobs -> CamillaDSP "Bass"/"Treble" shelf filters (tone.py)
//  - VOLUME knob -> Mymoode's own setVolume()
//  - Transport buttons follow the active player: MPD as before, Bluetooth over AVRCP,
//    and a hint for Spotify/AirPlay, which can't be controlled from here (transport.py)
// Knobs: drag up/down or scroll to turn; double-click resets bass/treble.
(() => {
    const API = 'mpd_bridge.php?action=';
    let LIMIT = 12;
    const SWEEP = 135, PX_PER_DB = 8;
    const state = { bass: 0, treble: 0 };
    const knobs = { bass: [], treble: [] };
    let sendTimer = null;

    const fmt = v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
    const clamp = v => Math.max(-LIMIT, Math.min(LIMIT, Math.round(v * 2) / 2));

    // Keep knob gestures away from the screensaver, whose pointerdown/pointerup on the
    // overlay turns a horizontal drag into a VU-skin change and a tap into controls toggle.
    function dragKnob(el, onMove) {
        let startY = 0;
        Object.assign(el.style, { cursor: 'ns-resize', touchAction: 'none' });
        el.addEventListener('pointerdown', e => {
            e.stopPropagation();
            startY = e.clientY;
            el.setPointerCapture(e.pointerId);
            el.style.transition = 'none';
            onMove(0, true);
        });
        el.addEventListener('pointermove', e => {
            if (!el.hasPointerCapture(e.pointerId)) return;
            e.stopPropagation();
            onMove(startY - e.clientY, false);
        });
        const end = e => { e.stopPropagation(); el.style.transition = ''; };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
        el.addEventListener('click', e => e.stopPropagation());
    }

    // ---- Tone ----
    function render(kind) {
        for (const k of knobs[kind]) {
            k.el.style.transform = `rotate(${(state[kind] / LIMIT) * SWEEP}deg)`;
            k.el.title = `${kind === 'bass' ? 'Bass' : 'Treble'} ${fmt(state[kind])} (double-click to reset)`;
            k.val.textContent = state[kind] === 0 ? '' : fmt(state[kind]);
        }
    }

    function sendTone() {
        clearTimeout(sendTimer);
        sendTimer = setTimeout(() => {
            fetch(`${API}tone&op=set&bass=${state.bass}&treble=${state.treble}`).catch(() => {});
        }, 150);
    }

    function setTone(kind, v) {
        v = clamp(v);
        if (v === state[kind]) return;
        state[kind] = v;
        render(kind);
        sendTone();
    }

    function bindTone(kind, el) {
        const val = document.createElement('div');
        val.className = 'tone-val';
        el.parentElement.appendChild(val);
        knobs[kind].push({ el, val });
        let startV = 0;
        dragKnob(el, (dy, start) => { if (start) startV = state[kind]; else setTone(kind, startV + dy / PX_PER_DB); });
        el.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); setTone(kind, state[kind] + (e.deltaY < 0 ? 0.5 : -0.5)); }, { passive: false });
        el.addEventListener('dblclick', e => { e.stopPropagation(); setTone(kind, 0); });
    }

    // ---- Volume ----
    function bindVolume() {
        const el = document.querySelector('.hw-knob.vol');
        const slider = document.getElementById('volSlider');
        if (!el || !slider || typeof window.setVolume !== 'function') return;
        const angle = v => -SWEEP + (v / 100) * 2 * SWEEP;
        let vol = parseInt(slider.value) || 0, timer = null, lastLocal = 0, startV = 0;
        const render = () => { el.style.transform = `rotate(${angle(vol)}deg)`; el.title = `Volume ${vol}%`; };
        const set = v => {
            v = Math.max(0, Math.min(100, Math.round(v)));
            if (v === vol) return;
            vol = v; render();
            slider.value = v;
            lastLocal = Date.now();
            clearTimeout(timer);
            timer = setTimeout(() => window.setVolume(v), 150);
        };
        dragKnob(el, (dy, start) => { if (start) startV = vol; else set(startV + dy / 2); });
        el.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); set(vol + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
        // Follow changes made elsewhere, but not within 2 s of our own (same rule as Mymoode's wheel)
        setInterval(() => {
            const v = parseInt(slider.value);
            if (Date.now() - lastLocal > 2000 && !isNaN(v) && v !== vol) { vol = v; render(); }
        }, 500);
        render();
    }

    // ---- Transport ----
    function toast(msg) {
        let t = document.getElementById('extrasToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'extrasToast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(t._hide);
        t._hide = setTimeout(() => t.classList.remove('show'), 2500);
    }

    function wrapTransport() {
        const original = window.sendCmd;
        if (typeof original !== 'function') return;
        const TRANSPORT = new Set(['toggle', 'play', 'pause', 'stop', 'next', 'previous', 'repeat', 'random']);
        window.sendCmd = async function (cmd, ...rest) {
            if (!TRANSPORT.has(cmd)) return original.call(this, cmd, ...rest);
            let r;
            try { r = await (await fetch(`${API}transport&cmd=${cmd}`)).json(); }
            catch { r = { route: 'mpd' }; }  // backend unreachable: behave as before
            if (r.route === 'mpd') return original.call(this, cmd, ...rest);
            if (!r.ok) toast(r.error || 'Command failed');
        };
    }

    // Shared with other add-ons (the Neon Bars skin): tone, volume and the latest status
    function exposeApi() {
        const slider = document.getElementById('volSlider');
        let volTimer = null;
        window.MymoodeExtras = {
            status: null,
            tone: () => ({ bass: state.bass, treble: state.treble, limit: LIMIT }),
            setTone: (kind, v) => setTone(kind, v),
            volume: () => (slider ? parseInt(slider.value) || 0 : 0),
            setVolume: v => {
                v = Math.max(0, Math.min(100, Math.round(v)));
                if (slider) slider.value = v;
                clearTimeout(volTimer);
                volTimer = setTimeout(() => typeof window.setVolume === 'function' && window.setVolume(v), 150);
            },
        };
        const original = window.updateNowPlaying;
        if (typeof original === 'function') {
            window.updateNowPlaying = function (d) {
                window.MymoodeExtras.status = d;
                return original.apply(this, arguments);
            };
        }
    }

    function init() {
        exposeApi();
        document.querySelectorAll('.knob-container').forEach(c => {
            // Match by i18n key (labels get translated); the second skin has plain English labels
            const lab = c.querySelector('.hw-label');
            const key = lab?.dataset.i18n || (lab?.textContent || '').trim().toUpperCase();
            const el = c.querySelector('.hw-knob:not(.vol)');
            if (!el) return;
            if (key === 'hw_bass' || key === 'BASS') bindTone('bass', el);
            else if (key === 'hw_treble' || key === 'TREBLE') bindTone('treble', el);
        });
        bindVolume();
        wrapTransport();

        const style = document.createElement('style');
        style.textContent = `
            .tone-val{font:bold 10px "Courier New",monospace;color:var(--hl-color,#ccc);min-height:12px;text-align:center;margin-top:2px}
            #extrasToast{position:fixed;left:50%;bottom:12%;transform:translateX(-50%);z-index:99999;background:rgba(0,0,0,.85);color:#eee;
              padding:10px 18px;border-radius:10px;font:14px system-ui,sans-serif;opacity:0;pointer-events:none;transition:opacity .25s}
            #extrasToast.show{opacity:1}`;
        document.head.appendChild(style);

        fetch(`${API}tone&op=get`).then(r => r.json()).then(d => {
            if (!d.available) {
                [...knobs.bass, ...knobs.treble].forEach(k => { k.el.style.cursor = 'not-allowed'; k.el.title = 'Tone filters are not in the active CamillaDSP config'; });
                return;
            }
            if (d.limit) LIMIT = d.limit;
            state.bass = d.bass; state.treble = d.treble;
            render('bass'); render('treble');
        }).catch(() => {});
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
