// Neon Bars — a cyberpunk screensaver skin for Mymoode (moode-tweaks add-on).
// Three neon bar meters (L / SUB / R) fed by CamillaDSP's playback levels, a hanging
// "DONKEY ♡ ベイビー" sign, a living city, and bass / treble / volume sliders.
//
// Pick "Neon Bars" in the VU style menu. The skin draws its own full-screen canvas over
// the screensaver while it's active and stops completely otherwise.
// Needs extras.js (window.MymoodeExtras) for tone, volume and status.
(() => {
    'use strict';
    const STYLE = 'neon_bars';
    const W = 1600, H = 900, HORIZON = 600;
    const F = { neon: '"NB Tilt Neon"', disp: '"NB Orbitron"', mono: '"NB Share Tech Mono"', jp: '"NB Noto Sans JP"' };

    // ---------- fonts (bundled, offline) ----------
    const fontsReady = Promise.all([
        ['NB Tilt Neon', 'fonts/TiltNeon.woff2', '400'],
        ['NB Orbitron', 'fonts/Orbitron.woff2', '400 900'],
        ['NB Share Tech Mono', 'fonts/ShareTechMono.woff2', '400'],
        ['NB Noto Sans JP', 'fonts/NotoSansJP.woff2', '100 900'],
    ].map(([fam, url, weight]) => new FontFace(fam, `url(${url})`, { weight }).load()
        .then(f => document.fonts.add(f)).catch(() => {})));

    const PAL = {
        sky: ['#010307', '#03101a', '#062130', '#0f3a48'],
        far: '#0d2a36', mid: '#06161f', near: '#02090e',
        winWarm: '#ffc27a', winCool: '#8fe9ff',
        cyan: ['#00a8ff', '#3ff3ff'], mag: ['#c21cc0', '#ff4fe6'],
        warn: '#ffb020', hot: '#fff7e6',
        text: 'rgba(200, 240, 255, 0.55)',
    };

    // ---------- helpers ----------
    const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    function withAlpha(col, a) {
        if (col.startsWith('#')) { const v = parseInt(col.slice(1), 16); return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`; }
        return col.replace('rgb(', 'rgba(').replace(')', `,${a})`);
    }
    function mix(a, b, t) {
        const ch = s => { const v = parseInt(s.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
        const A = ch(a), B = ch(b);
        return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
    }
    function roundRect(g, x, y, w, h, r) {
        g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    let BLUR = 1;   // lowered in lite mode
    function glowText(g, txt, x, y, font, col, alpha = 1, blur = 26) {
        g.save();
        g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = alpha;
        g.shadowColor = col; g.shadowBlur = blur * BLUR; g.fillStyle = col; g.fillText(txt, x, y);
        g.shadowBlur = blur * 0.3 * BLUR; g.fillStyle = mix(col, '#ffffff', 0.6); g.fillText(txt, x, y);
        g.restore();
    }

    // ---------- static city (pre-rendered once) ----------
    const LANES = [
        { y: 548, dir: 1, speed: 140, col: '#fff2d6', n: 16, size: 1.6 },
        { y: 556, dir: -1, speed: 120, col: '#ff3b30', n: 16, size: 1.6 },
        { y: 578, dir: 1, speed: 210, col: '#fff2d6', n: 12, size: 2.2 },
        { y: 586, dir: -1, speed: 190, col: '#ff3b30', n: 12, size: 2.2 },
    ];
    function makeLayer(seed, minH, maxH, minW, maxW, gap) {
        const r = rng(seed), out = [];
        for (let x = -30; x < W + 30;) {
            const w = minW + r() * (maxW - minW), h = minH + r() * (maxH - minH);
            out.push({ x, w, h, spire: r() < 0.16, r: r() });
            x += w + gap * r();
        }
        return out;
    }
    const farL = makeLayer(7, 90, 260, 40, 120, 4);
    const midL = makeLayer(42, 140, 330, 50, 130, 8);
    const nearL = makeLayer(99, 200, 470, 80, 170, 14);

    let city = null;
    function buildCity() {
        city = document.createElement('canvas');
        city.width = W; city.height = H;
        const g = city.getContext('2d');
        const sky = g.createLinearGradient(0, 0, 0, HORIZON);
        sky.addColorStop(0, PAL.sky[0]); sky.addColorStop(0.5, PAL.sky[1]);
        sky.addColorStop(0.85, PAL.sky[2]); sky.addColorStop(1, PAL.sky[3]);
        g.fillStyle = sky; g.fillRect(0, 0, W, HORIZON);
        for (const [x, rad, a] of [[280, 420, 0.16], [1250, 520, 0.14], [820, 300, 0.08]]) {
            const p = g.createRadialGradient(x, HORIZON, 0, x, HORIZON, rad);
            p.addColorStop(0, `rgba(255,60,200,${a})`); p.addColorStop(1, 'rgba(255,60,200,0)');
            g.fillStyle = p; g.fillRect(0, 0, W, HORIZON);
        }
        const building = (b, col, detail, rr) => {
            const top = HORIZON - b.h, x = b.x, w = b.w;
            g.fillStyle = col; g.beginPath();
            const kind = rr();
            if (kind < 0.30) {
                const s1 = w * 0.16, s2 = w * 0.30, h1 = b.h * 0.10, h2 = b.h * 0.20;
                g.moveTo(x, HORIZON); g.lineTo(x, top + h2); g.lineTo(x + s1, top + h2); g.lineTo(x + s1, top + h1);
                g.lineTo(x + s2, top + h1); g.lineTo(x + s2, top); g.lineTo(x + w - s2, top); g.lineTo(x + w - s2, top + h1);
                g.lineTo(x + w - s1, top + h1); g.lineTo(x + w - s1, top + h2); g.lineTo(x + w, top + h2); g.lineTo(x + w, HORIZON);
            } else if (kind < 0.45) {
                g.moveTo(x, HORIZON); g.lineTo(x, top + b.h * 0.12); g.lineTo(x + w, top); g.lineTo(x + w, HORIZON);
            } else if (kind < 0.55) {
                g.moveTo(x, HORIZON); g.lineTo(x, top + b.h * 0.25); g.lineTo(x + w / 2, top); g.lineTo(x + w, top + b.h * 0.25); g.lineTo(x + w, HORIZON);
            } else {
                g.rect(x, top, w, b.h);
            }
            g.fill();
            if (b.spire) { g.fillRect(x + w / 2 - 2, top - 70, 4, 72); g.fillRect(x + w / 2 - 8, top - 24, 16, 3); }
            if (detail === 'bands') {
                for (let y = top + 16; y < HORIZON - 8; y += 18 + rr() * 26) {
                    g.fillStyle = withAlpha(rr() < 0.75 ? PAL.winWarm : PAL.winCool, 0.07 + rr() * 0.12);
                    g.fillRect(x + 3, y, w - 6, 2);
                }
                return;
            }
            const cols = Math.max(2, Math.floor((w - 14) / 9)), cw = (w - 14) / cols;
            let run = 0;
            for (let y = top + b.h * 0.22; y < HORIZON - 10; y += 11) {
                if (run <= 0 && rr() < (detail === 'dense' ? 0.24 : 0.15)) run = 1 + Math.floor(rr() * 4);
                if (run-- > 0) {
                    const c = rr() < 0.78 ? PAL.winWarm : PAL.winCool;
                    for (let i = 0; i < cols; i++) {
                        if (rr() < 0.38) continue;
                        g.fillStyle = withAlpha(c, 0.16 + rr() * 0.42);
                        g.fillRect(x + 7 + i * cw, y, cw - 3, 5);
                    }
                }
            }
            if (rr() < 0.25) {
                const ec = rr() < 0.55 ? '#3ff3ff' : '#ff4fe6';
                g.save(); g.shadowColor = ec; g.shadowBlur = 12; g.fillStyle = ec;
                g.fillRect(rr() < 0.5 ? x + 1 : x + w - 3, top + b.h * 0.16, 2, b.h * 0.6);
                g.restore();
            }
        };
        const layer = (bs, col, detail, seed) => { const rr = rng(seed); for (const b of bs) building(b, col, detail, rr); };
        layer(farL, PAL.far, 'bands', 11);
        const hz = g.createLinearGradient(0, HORIZON - 320, 0, HORIZON);
        hz.addColorStop(0, 'rgba(40,200,255,0)'); hz.addColorStop(1, 'rgba(40,200,255,0.13)');
        g.fillStyle = hz; g.fillRect(0, HORIZON - 320, W, 320);
        layer(midL, PAL.mid, 'normal', 23);
        const fog = g.createLinearGradient(0, HORIZON - 140, 0, HORIZON);
        fog.addColorStop(0, 'rgba(30,120,150,0)'); fog.addColorStop(1, 'rgba(30,120,150,0.22)');
        g.fillStyle = fog; g.fillRect(0, HORIZON - 140, W, 140);
        layer(nearL, PAL.near, 'dense', 37);
        for (const y of LANES.map(l => l.y)) {
            g.fillStyle = '#01060a'; g.fillRect(0, y + 3, W, 5);
            g.fillStyle = 'rgba(120,220,255,0.10)'; g.fillRect(0, y + 3, W, 1);
        }
        const fl = g.createLinearGradient(0, HORIZON, 0, H);
        fl.addColorStop(0, '#04141c'); fl.addColorStop(1, '#010306');
        g.fillStyle = fl; g.fillRect(0, HORIZON, W, H - HORIZON);
        const hl = g.createLinearGradient(0, HORIZON - 3, 0, HORIZON + 3);
        hl.addColorStop(0, 'rgba(80,220,255,0)'); hl.addColorStop(0.5, 'rgba(80,220,255,0.30)'); hl.addColorStop(1, 'rgba(80,220,255,0)');
        g.fillStyle = hl; g.fillRect(0, HORIZON - 3, W, 6);
    }

    // ---------- living city ----------
    const cars = LANES.flatMap((l, li) => [...Array(l.n)].map(() => ({ li, x: Math.random() * W, v: l.speed * (0.8 + Math.random() * 0.4) })));
    const beacons = [...midL, ...nearL].filter(b => b.spire).map(b => ({ x: b.x + b.w / 2, y: HORIZON - b.h - 72, ph: b.r * 6 }));
    const shopSigns = [
        { x: 92, y: 232, txt: '電脳', col: '#3ff3ff' },
        { x: 268, y: 300, txt: '薬', col: '#7dff9a' },
        { x: 1188, y: 372, txt: '酒', col: '#ff4fe6' },
        { x: 1508, y: 250, txt: 'ラーメン', col: '#ffb020' },
    ];
    const hSigns = [
        { x: 330, y: 452, txt: 'ホテル', col: '#ff4fe6' },
        { x: 1310, y: 474, txt: '寿司', col: '#3ff3ff' },
    ];

    function drawSearchlights(g, t) {
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const [x, ph, col] of [[210, 0, '120,230,255'], [1420, 2.1, '255,120,230'], [1010, 4.2, '120,230,255']]) {
            const a = Math.sin(t * 0.18 + ph) * 0.32 - Math.PI / 2, len = 760, spread = 0.045;
            const gr = g.createLinearGradient(x, HORIZON, x + Math.cos(a) * len, HORIZON + Math.sin(a) * len);
            gr.addColorStop(0, `rgba(${col},0.10)`); gr.addColorStop(1, `rgba(${col},0)`);
            g.fillStyle = gr; g.beginPath(); g.moveTo(x, HORIZON);
            g.lineTo(x + Math.cos(a - spread) * len, HORIZON + Math.sin(a - spread) * len);
            g.lineTo(x + Math.cos(a + spread) * len, HORIZON + Math.sin(a + spread) * len);
            g.closePath(); g.fill();
        }
        g.restore();
    }
    function drawFlares(g, t) {
        for (const [x, y, ph] of [[54, 352, 0], [152, 378, 3.7]]) {
            const c = (t + ph) % 7, k = c < 1.6 ? Math.sin(c / 1.6 * Math.PI) : 0;
            g.fillStyle = '#071b24'; g.fillRect(x - 3, y, 6, 40);
            if (k <= 0.01) continue;
            g.save(); g.globalCompositeOperation = 'lighter';
            const r = 22 + 40 * k + Math.random() * 6;
            const fg = g.createRadialGradient(x, y - r * 0.6, 0, x, y - r * 0.6, r);
            fg.addColorStop(0, `rgba(255,230,170,${0.9 * k})`); fg.addColorStop(0.35, `rgba(255,140,40,${0.6 * k})`); fg.addColorStop(1, 'rgba(255,90,20,0)');
            g.fillStyle = fg; g.beginPath(); g.arc(x, y - r * 0.6, r, 0, Math.PI * 2); g.fill();
            g.restore();
        }
    }
    function drawTraffic(g, dt) {
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const c of cars) {
            const l = LANES[c.li];
            c.x += l.dir * c.v * dt;
            if (c.x > W + 40) c.x = -40; else if (c.x < -40) c.x = W + 40;
            const trail = l.dir * -22 * l.size;
            const gr = g.createLinearGradient(c.x, 0, c.x + trail, 0);
            gr.addColorStop(0, withAlpha(l.col, 0.9)); gr.addColorStop(1, withAlpha(l.col, 0));
            g.fillStyle = gr; g.fillRect(Math.min(c.x, c.x + trail), l.y - l.size / 2, Math.abs(trail), l.size);
        }
        g.restore();
    }

    const spinners = [];
    let nextSpinner = 2;
    function spawnSpinner() {
        const dir = Math.random() < 0.5 ? 1 : -1, depth = 0.5 + Math.random() * 0.7;
        spinners.push({ x: dir > 0 ? -60 : W + 60, y: 140 + Math.random() * 230, dir, depth, v: 90 + Math.random() * 90, ph: Math.random() * 6 });
    }
    function drawSpinners(g, t, dt) {
        if ((nextSpinner -= dt) <= 0) { spawnSpinner(); nextSpinner = 5 + Math.random() * 7; }
        for (let i = spinners.length - 1; i >= 0; i--) {
            const s = spinners[i];
            s.x += s.dir * s.v * s.depth * dt;
            const y = s.y + Math.sin(t * 1.3 + s.ph) * 4, sc = s.depth * 1.6;
            if (s.x < -120 || s.x > W + 120) { spinners.splice(i, 1); continue; }
            g.save(); g.translate(s.x, y); g.scale(s.dir * sc, sc);
            g.globalCompositeOperation = 'lighter';
            const cone = g.createLinearGradient(0, 4, 0, 90);
            cone.addColorStop(0, 'rgba(120,230,255,0.16)'); cone.addColorStop(1, 'rgba(120,230,255,0)');
            g.fillStyle = cone; g.beginPath(); g.moveTo(-6, 4); g.lineTo(6, 4); g.lineTo(26, 90); g.lineTo(-26, 90); g.closePath(); g.fill();
            g.globalCompositeOperation = 'source-over';
            g.fillStyle = '#0a1318'; g.beginPath();
            g.moveTo(-26, 2); g.quadraticCurveTo(-18, -9, 4, -9); g.quadraticCurveTo(24, -8, 30, 0); g.lineTo(26, 5); g.lineTo(-22, 6); g.closePath(); g.fill();
            const blink = ((t * 2 + s.ph) % 1) < 0.15;
            g.shadowBlur = 10 * BLUR;
            g.shadowColor = '#fff2d6'; g.fillStyle = '#fff2d6'; g.fillRect(26, -1, 5, 2);
            g.shadowColor = '#ff3b30'; g.fillStyle = blink ? '#ff5a4f' : '#5a1410'; g.fillRect(-25, -2, 3, 3);
            g.shadowColor = '#3ff3ff'; g.fillStyle = '#3ff3ff'; g.fillRect(-10, 5, 16, 1.5);
            g.restore();
        }
    }
    function drawBeacons(g, t) {
        for (const b of beacons) {
            const on = ((t + b.ph) % 2.2) < 0.18;
            g.save(); g.shadowColor = '#ff2a2a'; g.shadowBlur = on ? 16 * BLUR : 0;
            g.fillStyle = on ? '#ff4a4a' : '#3a0d14';
            g.beginPath(); g.arc(b.x, b.y, 3, 0, Math.PI * 2); g.fill(); g.restore();
        }
    }
    function drawShopSigns(g) {
        for (const s of shopSigns) {
            const n = [...s.txt].length, bw = 40, bh = n * 32 + 16, bx = s.x - bw / 2, by = s.y - 30;
            const fl = Math.random() < 0.004 ? 0.25 : 1;
            g.save();
            roundRect(g, bx, by, bw, bh, 4); g.fillStyle = 'rgba(2,6,10,0.88)'; g.fill();
            g.globalAlpha = 0.75 * fl;
            g.shadowColor = s.col; g.shadowBlur = 10 * BLUR; g.lineWidth = 1.5; g.strokeStyle = s.col; g.stroke();
            g.fillRect(s.x - 1, by - 14, 2, 14);
            g.font = `500 24px ${F.jp}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            [...s.txt].forEach((ch, i) => {
                g.shadowBlur = 16 * BLUR; g.fillStyle = s.col; g.fillText(ch, s.x, by + 24 + i * 32);
                g.shadowBlur = 4 * BLUR; g.fillStyle = mix(s.col, '#ffffff', 0.5); g.fillText(ch, s.x, by + 24 + i * 32);
            });
            g.restore();
        }
        for (const s of hSigns) {
            const fl = Math.random() < 0.003 ? 0.3 : 0.8;
            g.save();
            g.font = `700 22px ${F.jp}, sans-serif`;
            const w = g.measureText(s.txt).width + 26;
            roundRect(g, s.x - w / 2, s.y - 18, w, 36, 4); g.fillStyle = 'rgba(2,6,10,0.88)'; g.fill();
            g.globalAlpha = fl; g.shadowColor = s.col; g.shadowBlur = 10 * BLUR; g.strokeStyle = s.col; g.lineWidth = 1.2; g.stroke();
            g.restore();
            glowText(g, s.txt, s.x, s.y + 1, `700 22px ${F.jp}, sans-serif`, s.col, fl, 14);
        }
    }

    const ICO = (() => {
        const p = (1 + Math.sqrt(5)) / 2;
        const v = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]];
        const e = [];
        for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
            if (Math.abs(Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]) - 2) < 0.01) e.push([i, j]);
        }
        return { v, e };
    })();
    function drawHologram(g, t) {
        const cx = 1352, cy = 210, R = 58, glitch = Math.random() < 0.02;
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = glitch ? 0.35 : 0.85;
        const beam = g.createLinearGradient(cx, cy + 150, cx, cy - 20);
        beam.addColorStop(0, 'rgba(255,80,230,0.18)'); beam.addColorStop(1, 'rgba(255,80,230,0)');
        g.fillStyle = beam; g.beginPath(); g.moveTo(cx - 4, cy + 150); g.lineTo(cx + 4, cy + 150); g.lineTo(cx + 80, cy - 40); g.lineTo(cx - 80, cy - 40); g.closePath(); g.fill();
        const a = t * 0.6, b = t * 0.37;
        const P = ICO.v.map(([x, y, z]) => {
            const X = x * Math.cos(a) - z * Math.sin(a); let Z = x * Math.sin(a) + z * Math.cos(a);
            const Y = y * Math.cos(b) - Z * Math.sin(b); Z = y * Math.sin(b) + Z * Math.cos(b);
            const s = R / (3.6 - Z * 0.4) * 1.8;
            return [cx + X * s + (glitch ? (Math.random() - 0.5) * 10 : 0), cy + Y * s];
        });
        g.strokeStyle = '#ff6fe8'; g.lineWidth = 1.4; g.shadowColor = '#ff4fe6'; g.shadowBlur = 12 * BLUR;
        g.beginPath();
        for (const [i, j] of ICO.e) { g.moveTo(...P[i]); g.lineTo(...P[j]); }
        g.stroke();
        g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0;
        g.fillStyle = 'rgba(2,6,10,0.35)';
        for (let y = cy - 70; y < cy + 70; y += 4) g.fillRect(cx - 80, y + (t * 20) % 4, 160, 1.5);
        g.restore();
        g.save();
        roundRect(g, cx - 90, cy + 86, 180, 26, 3); g.fillStyle = 'rgba(2,6,10,0.85)'; g.fill();
        g.beginPath(); g.rect(cx - 86, cy + 86, 172, 26); g.clip();
        const msg = 'ネオン · ドリーム · オフワールド · ';
        g.font = `500 15px ${F.jp}, sans-serif`; g.textBaseline = 'middle';
        const mw = g.measureText(msg).width, off = (t * 40) % mw;
        g.shadowColor = '#3ff3ff'; g.shadowBlur = 8 * BLUR; g.fillStyle = '#9ff8ff';
        for (let x = cx - 86 - off; x < cx + 90; x += mw) g.fillText(msg, x, cy + 100);
        g.restore();
    }

    // ---------- the DONKEY ♡ ベイビー sign ----------
    const SIGN = { x: 800, y: 86, w: 560, h: 104 };
    let signStutter = { idx: -1, until: 0 };
    function heartPath(g, x, y, s) {
        g.beginPath();
        g.moveTo(x, y + s * 0.35);
        g.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.42);
        g.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
        g.closePath();
    }
    function drawSign(g, t) {
        const { x, y, w, h } = SIGN, L = x - w / 2, T = y - h / 2;
        g.strokeStyle = '#0c1a21'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(L + 60, 0); g.lineTo(L + 60, T); g.moveTo(L + w - 60, 0); g.lineTo(L + w - 60, T); g.stroke();
        g.save();
        roundRect(g, L, T, w, h, 10);
        const bp = g.createLinearGradient(0, T, 0, T + h);
        bp.addColorStop(0, '#0d1a20'); bp.addColorStop(1, '#050b0f');
        g.fillStyle = bp; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(160,230,255,0.14)'; g.stroke();
        g.beginPath(); g.moveTo(L + 12, T + 1.5); g.lineTo(L + w - 12, T + 1.5); g.strokeStyle = 'rgba(255,255,255,0.10)'; g.stroke();
        for (const [sx, sy] of [[L + 14, T + 14], [L + w - 14, T + 14], [L + 14, T + h - 14], [L + w - 14, T + h - 14]]) {
            g.beginPath(); g.arc(sx, sy, 3.5, 0, Math.PI * 2); g.fillStyle = '#1b2a31'; g.fill();
        }
        g.restore();
        g.save(); g.globalCompositeOperation = 'lighter';
        const spill = g.createRadialGradient(x, y, 10, x, y, w * 0.55);
        spill.addColorStop(0, 'rgba(60,220,255,0.10)'); spill.addColorStop(1, 'rgba(60,220,255,0)');
        g.fillStyle = spill; g.fillRect(L, T, w, h);
        g.restore();

        if (t > signStutter.until && Math.random() < 0.004) signStutter = { idx: Math.floor(Math.random() * 4), until: t + 0.35 + Math.random() * 0.5 };
        const stut = t < signStutter.until;
        const fontD = `400 62px ${F.neon}, sans-serif`, fontK = `700 50px ${F.jp}, sans-serif`;
        g.save(); g.font = fontD; const dw = g.measureText('DONKEY').width; g.font = fontK; const kw = g.measureText('ベイビー').width; g.restore();
        const gap = 58, x0 = x - (dw + gap + kw) / 2;
        glowText(g, 'DONKEY', x0 + dw / 2, y + 2, fontD, '#3ff3ff', 1, 30);
        const hx = x0 + dw + gap / 2, hy = y + 4, beat = 1 + 0.08 * Math.max(0, Math.sin(t * 6.2)) ** 8;
        g.save(); g.shadowColor = '#ff4fe6'; g.shadowBlur = 22 * BLUR; g.lineWidth = 3.2; g.strokeStyle = '#ff6fea';
        heartPath(g, hx, hy, 15 * beat); g.stroke();
        g.shadowBlur = 6 * BLUR; g.lineWidth = 1.2; g.strokeStyle = '#ffe0fb'; heartPath(g, hx, hy, 15 * beat); g.stroke();
        g.restore();
        g.save(); g.font = fontK;
        let cxk = x0 + dw + gap;
        [...'ベイビー'].forEach((ch, i) => {
            const cw = g.measureText(ch).width;
            const a = stut && i === signStutter.idx ? (Math.random() < 0.5 ? 0.12 : 0.55) : 1;
            glowText(g, ch, cxk + cw / 2, y + 2, fontK, '#ff4fe6', a, 28);
            cxk += cw;
        });
        g.restore();
    }

    // ---------- distant motorbike riders (pass behind the meter panel) ----------
    const STREET_Y = 634, RIDER_SCALE = 0.62;
    const riders = [];
    let nextRider = 6;
    function spawnRider(delayX = 0) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        riders.push({ dir, x: dir > 0 ? -160 - delayX : W + 160 + delayX, v: 650 + Math.random() * 250,
            rim: Math.random() < 0.5 ? '#3ff3ff' : '#ff4fe6', ph: Math.random() * 6 });
    }
    function drawBike(g, r, t, refl) {
        g.save(); g.translate(0, Math.sin(t * 3 + r.ph) * 1.2);
        g.save(); g.globalCompositeOperation = 'lighter';
        const tr = g.createLinearGradient(-50, 0, -470, 0);
        tr.addColorStop(0, 'rgba(255,50,40,0.85)'); tr.addColorStop(1, 'rgba(255,50,40,0)');
        g.fillStyle = tr; g.fillRect(-470, -20, 422, 3.5);
        const tr2 = g.createLinearGradient(-50, 0, -260, 0);
        tr2.addColorStop(0, withAlpha(r.rim, 0.5)); tr2.addColorStop(1, withAlpha(r.rim, 0));
        g.fillStyle = tr2; g.fillRect(-260, -4, 214, 2);
        if (!refl) {
            const ug = g.createRadialGradient(0, 2, 2, 0, 2, 90);
            ug.addColorStop(0, withAlpha(r.rim, 0.30)); ug.addColorStop(1, withAlpha(r.rim, 0));
            g.fillStyle = ug; g.fillRect(-90, -10, 180, 24);
            const hb = g.createLinearGradient(58, 0, 330, 0);
            hb.addColorStop(0, 'rgba(255,245,225,0.28)'); hb.addColorStop(1, 'rgba(255,245,225,0)');
            g.fillStyle = hb; g.beginPath(); g.moveTo(58, -16); g.lineTo(330, -40); g.lineTo(330, 6); g.lineTo(58, -8); g.closePath(); g.fill();
        }
        g.restore();
        for (const wx of [-34, 36]) {
            g.beginPath(); g.arc(wx, -14, 14, 0, Math.PI * 2); g.fillStyle = '#05080b'; g.fill();
            g.save(); g.shadowColor = r.rim; g.shadowBlur = 12 * BLUR; g.lineWidth = 2.2; g.strokeStyle = r.rim;
            g.beginPath(); g.arc(wx, -14, 11, 0, Math.PI * 2); g.stroke(); g.restore();
        }
        g.fillStyle = '#0b1217';
        g.beginPath();
        g.moveTo(-50, -14); g.quadraticCurveTo(-46, -30, -20, -30); g.lineTo(6, -28);
        g.quadraticCurveTo(38, -36, 56, -18); g.quadraticCurveTo(60, -10, 50, -8);
        g.lineTo(-44, -8); g.closePath(); g.fill();
        g.save(); g.shadowColor = r.rim; g.shadowBlur = 8 * BLUR; g.strokeStyle = withAlpha(r.rim, 0.9); g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(-40, -27); g.lineTo(4, -26); g.quadraticCurveTo(34, -33, 50, -19); g.stroke(); g.restore();
        g.fillStyle = '#070b0e';
        g.beginPath(); g.moveTo(-24, -30); g.quadraticCurveTo(-18, -52, 6, -52); g.lineTo(22, -44); g.lineTo(30, -32); g.lineTo(18, -30); g.lineTo(0, -40); g.lineTo(-8, -30); g.closePath(); g.fill();
        g.beginPath(); g.arc(14, -56, 8.5, 0, Math.PI * 2); g.fill();
        g.save(); g.shadowColor = r.rim; g.shadowBlur = 8 * BLUR; g.strokeStyle = withAlpha(r.rim, 0.75); g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(-24, -31); g.quadraticCurveTo(-18, -52, 6, -52); g.stroke();
        g.beginPath(); g.arc(14, -56, 8.5, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
        g.restore();
        g.save(); g.shadowColor = '#3ff3ff'; g.shadowBlur = 8 * BLUR; g.fillStyle = '#7ff8ff'; g.fillRect(16, -59, 7, 2); g.restore();
        g.fillRect(-22, -30, 6, 16);
        g.save(); g.shadowBlur = 14 * BLUR;
        g.shadowColor = '#fff2d6'; g.fillStyle = '#fff6e6'; g.fillRect(55, -16, 4, 4);
        g.shadowColor = '#ff3b30'; g.fillStyle = '#ff5045'; g.fillRect(-52, -22, 4, 4);
        g.restore();
        g.restore();
    }
    function drawRiders(g, t, dt) {
        if ((nextRider -= dt) <= 0) {
            spawnRider();
            if (Math.random() < 0.3) spawnRider(140 + Math.random() * 120);
            nextRider = 10 + Math.random() * 15;
        }
        for (let i = riders.length - 1; i >= 0; i--) {
            const r = riders[i];
            r.x += r.dir * r.v * RIDER_SCALE * dt;
            if (r.x < -700 || r.x > W + 700) { riders.splice(i, 1); continue; }
            g.save(); g.translate(r.x, STREET_Y); g.scale(r.dir * RIDER_SCALE, -RIDER_SCALE); g.globalAlpha = 0.22; drawBike(g, r, t, true); g.restore();
            g.save(); g.translate(r.x, STREET_Y); g.scale(r.dir * RIDER_SCALE, RIDER_SCALE); drawBike(g, r, t, false); g.restore();
        }
    }

    // ---------- foreground: subtle, slow, low contrast ----------
    function drawGroundReflections(g, t) {
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const s of [...shopSigns, ...hSigns]) {
            const wob = Math.sin(t * 1.7 + s.x) * 3, a = 0.07 + 0.03 * Math.sin(t * 2.3 + s.x * 0.1);
            const gr = g.createLinearGradient(0, 650, 0, H);
            gr.addColorStop(0, withAlpha(s.col, a)); gr.addColorStop(1, withAlpha(s.col, 0));
            g.fillStyle = gr;
            g.beginPath();
            g.moveTo(s.x - 10, 650); g.lineTo(s.x + 10, 650);
            g.quadraticCurveTo(s.x + 14 + wob, 780, s.x + 6 - wob, H); g.lineTo(s.x - 6 - wob, H);
            g.quadraticCurveTo(s.x - 14 + wob, 780, s.x - 10, 650);
            g.fill();
        }
        g.restore();
    }
    const ripples = [];
    let nextRipple = 1.5;
    function drawRipples(g, dt) {
        if ((nextRipple -= dt) <= 0) {
            const left = Math.random() < 0.5;
            ripples.push({ x: left ? 40 + Math.random() * 380 : 1180 + Math.random() * 380, y: 690 + Math.random() * 190, age: 0 });
            nextRipple = 1.2 + Math.random() * 2.5;
        }
        g.save(); g.lineWidth = 1;
        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i]; r.age += dt;
            if (r.age > 2.2) { ripples.splice(i, 1); continue; }
            const k = r.age / 2.2;
            for (const [off, al] of [[0, 1], [0.25, 0.6]]) {
                const kk = Math.max(0, k - off); if (kk <= 0) continue;
                const rx = 6 + kk * 46;
                g.strokeStyle = `rgba(150,230,255,${0.22 * (1 - kk) * al})`;
                g.beginPath(); g.ellipse(r.x, r.y, rx, rx * 0.22, 0, 0, Math.PI * 2); g.stroke();
            }
        }
        g.restore();
    }
    const VENTS = [{ x: 300, y: 866 }, { x: 1336, y: 856 }];
    const steam = [];
    let steamClock = 0;
    function drawVentsAndSteam(g, t, dt, lite) {
        for (const v of VENTS) {
            g.save();
            g.globalCompositeOperation = 'lighter';
            const glow = g.createRadialGradient(v.x, v.y, 2, v.x, v.y, 46);
            glow.addColorStop(0, `rgba(255,140,60,${0.20 + 0.04 * Math.sin(t * 3 + v.x)})`); glow.addColorStop(1, 'rgba(255,140,60,0)');
            g.fillStyle = glow; g.beginPath(); g.ellipse(v.x, v.y, 46, 12, 0, 0, Math.PI * 2); g.fill();
            g.globalCompositeOperation = 'source-over';
            g.beginPath(); g.ellipse(v.x, v.y, 30, 7, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(2,6,9,0.85)'; g.fill();
            g.strokeStyle = 'rgba(120,200,230,0.18)'; g.lineWidth = 1; g.stroke();
            g.strokeStyle = 'rgba(255,150,80,0.25)';
            for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(v.x + i * 10, v.y - 5); g.lineTo(v.x + i * 10, v.y + 5); g.stroke(); }
            g.restore();
        }
        if (lite) return;
        steamClock += dt;
        while (steamClock > 0.22) {
            steamClock -= 0.22;
            for (const v of VENTS) steam.push({ x: v.x + (Math.random() - 0.5) * 30, y: v.y - 4, age: 0, life: 3 + Math.random() * 2, ph: Math.random() * 6, vy: 22 + Math.random() * 14 });
        }
        g.save();
        for (let i = steam.length - 1; i >= 0; i--) {
            const p = steam[i]; p.age += dt;
            if (p.age > p.life) { steam.splice(i, 1); continue; }
            const k = p.age / p.life;
            p.y -= p.vy * dt; p.x += Math.sin(t * 0.8 + p.ph) * 8 * dt;
            const r = 12 + k * 58, a = 0.07 * Math.sin(Math.PI * k);
            const sg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            sg.addColorStop(0, `rgba(170,215,230,${a})`); sg.addColorStop(1, 'rgba(170,215,230,0)');
            g.fillStyle = sg; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
        }
        g.restore();
    }
    const motes = [...Array(28)].map(() => ({ x: Math.random() * W, y: 620 + Math.random() * 270, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 4, ph: Math.random() * 6 }));
    function drawMotes(g, t, dt) {
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const m of motes) {
            m.x += m.vx * dt; m.y += m.vy * dt;
            if (m.y < 600) { m.y = 895; m.x = Math.random() * W; }
            g.fillStyle = `rgba(200,240,255,${0.25 + 0.25 * Math.sin(t * 1.5 + m.ph)})`; g.fillRect(m.x, m.y, 1.6, 1.6);
        }
        g.restore();
    }

    // ---------- meters ----------
    const SEGS = 24, SEG_H = 8.5, SEG_GAP = 9;
    const COLS = [
        { key: 'L', jp: '左', x: 560, w: 120, col: PAL.cyan },
        { key: 'SUB', jp: '低音', x: 730, w: 140, col: PAL.mag },
        { key: 'R', jp: '右', x: 920, w: 120, col: PAL.cyan },
    ];
    const METER_BOTTOM = 650, METER_TOP = METER_BOTTOM - SEGS * (SEG_H + SEG_GAP) + SEG_GAP;
    const SCALE = [[-40, 0], [-30, 4], [-20, 9], [-12, 14], [-6, 18], [-3, 20], [0, 22], [3, 24]];
    function dbToSeg(db) {
        if (db <= SCALE[0][0]) return 0;
        for (let i = 1; i < SCALE.length; i++) {
            const [d1, s1] = SCALE[i], [d0, s0] = SCALE[i - 1];
            if (db <= d1) return s0 + (s1 - s0) * (db - d0) / (d1 - d0);
        }
        return SEGS;
    }
    const segY = i => METER_BOTTOM - (i + 1) * SEG_H - i * SEG_GAP;
    function segColor(col, i) {
        if (i >= dbToSeg(-2)) return PAL.hot;
        if (i >= dbToSeg(-6)) return PAL.warn;
        return mix(col[0], col[1], i / SEGS);
    }

    // CamillaDSP playback levels: index 0/1 = L/R, 2 = sub (only with a 3-channel config)
    const level = [-60, -60, -60], peak = [-60, -60, -60], peakHold = [0, 0, 0];
    let live = null, liveAt = 0, nCh = 0, ws = null, wsTimer = null, pollTimer = null;
    function wsConnect() {
        if (!running) return;
        const uri = localStorage.getItem('camilla_ws_uri') || `ws://${location.hostname}:1234`;
        try { ws = new WebSocket(uri); } catch (_) { wsTimer = setTimeout(wsConnect, 2000); return; }
        ws.onopen = () => {
            clearInterval(pollTimer);
            pollTimer = setInterval(() => ws && ws.readyState === 1 && ws.send(JSON.stringify('GetSignalLevels')), 50);
        };
        ws.onmessage = e => {
            try {
                const v = JSON.parse(e.data).GetSignalLevels;
                if (v && v.result === 'Ok' && v.value && v.value.playback_rms) {
                    live = v.value.playback_rms; nCh = live.length; liveAt = performance.now();
                }
            } catch (_) {}
        };
        // CamillaDSP restarts with every stream, so expect disconnects and keep retrying
        ws.onclose = () => { clearInterval(pollTimer); ws = null; if (running) wsTimer = setTimeout(wsConnect, 1500); };
        ws.onerror = () => { try { ws.close(); } catch (_) {} };
    }
    function wsDisconnect() {
        clearTimeout(wsTimer); clearInterval(pollTimer);
        if (ws) { ws.onclose = null; try { ws.close(); } catch (_) {} ws = null; }
        live = null;
    }
    const hasSignal = () => live && performance.now() - liveAt < 1000;
    function ballistics(dt) {
        const target = hasSignal() ? live : [];
        for (let i = 0; i < 3; i++) {
            const tg = Math.max(-60, target[i] ?? -60);
            const k = tg > level[i] ? 1 - Math.exp(-dt / 0.03) : 1 - Math.exp(-dt / 0.30);
            level[i] += (tg - level[i]) * k;
            if (level[i] >= peak[i]) { peak[i] = level[i]; peakHold[i] = 1.4; }
            else if ((peakHold[i] -= dt) <= 0) peak[i] -= 14 * dt;
        }
    }
    const subOffline = () => hasSignal() && nCh < 3;

    function drawMeters(g, reflection) {
        if (!reflection) {
            const px = 470, py = METER_TOP - 64, pw = 660, ph = METER_BOTTOM - METER_TOP + 140;
            g.save();
            roundRect(g, px, py, pw, ph, 16);
            const pg = g.createLinearGradient(0, py, 0, py + ph);
            pg.addColorStop(0, 'rgba(6, 18, 26, 0.93)'); pg.addColorStop(1, 'rgba(2, 7, 11, 0.96)');
            g.fillStyle = pg; g.fill();
            g.lineWidth = 1.2; g.strokeStyle = 'rgba(120, 230, 255, 0.16)'; g.stroke();
            g.beginPath(); g.moveTo(px + 16, py + 1); g.lineTo(px + pw - 16, py + 1); g.strokeStyle = 'rgba(255,255,255,0.10)'; g.stroke();
            for (const [sx, sy] of [[px + 16, py + 16], [px + pw - 16, py + 16], [px + 16, py + ph - 16], [px + pw - 16, py + ph - 16]]) {
                g.beginPath(); g.arc(sx, sy, 4, 0, Math.PI * 2); g.fillStyle = '#16262e'; g.fill();
                g.beginPath(); g.moveTo(sx - 2.5, sy); g.lineTo(sx + 2.5, sy); g.strokeStyle = '#061015'; g.lineWidth = 1.2; g.stroke();
            }
            g.restore();
        }
        COLS.forEach(c => {
            const idx = c.key === 'SUB' ? 2 : (c.key === 'L' ? 0 : 1);
            const dead = c.key === 'SUB' && subOffline();
            const lit = dead ? 0 : dbToSeg(level[idx]), pk = dead ? 0 : Math.round(dbToSeg(peak[idx]));
            for (let i = 0; i < SEGS; i++) {
                const y = segY(i), on = i < lit, col = segColor(c.col, i);
                roundRect(g, c.x, y, c.w, SEG_H, SEG_H / 2);
                if (on) {
                    g.save(); g.shadowColor = col; g.shadowBlur = (reflection ? 10 : 22) * BLUR; g.fillStyle = col; g.fill(); g.restore();
                    roundRect(g, c.x + 6, y + SEG_H * 0.32, c.w - 12, SEG_H * 0.36, SEG_H * 0.18);
                    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill();
                } else {
                    g.fillStyle = withAlpha(col, 0.05); g.fill();
                    g.lineWidth = 0.8; g.strokeStyle = withAlpha(col, 0.10); g.stroke();
                }
            }
            if (pk > 0 && pk <= SEGS && pk > lit) {
                const y = segY(pk - 1) + SEG_H / 2;
                g.save(); g.shadowColor = '#ffffff'; g.shadowBlur = 14 * BLUR; g.fillStyle = '#ffffff'; g.fillRect(c.x - 6, y - 1.5, c.w + 12, 3); g.restore();
            }
            if (dead && !reflection) {
                g.save(); g.font = `500 12px ${F.disp}, sans-serif`; g.letterSpacing = '4px';
                g.textAlign = 'center'; g.fillStyle = withAlpha(c.col[1], 0.6);
                g.fillText('OFFLINE', c.x + c.w / 2 + 2, (METER_TOP + METER_BOTTOM) / 2);
                g.restore();
            }
        });
    }
    function drawScale(g) {
        g.save();
        g.font = `15px ${F.mono}, monospace`; g.fillStyle = PAL.text; g.strokeStyle = 'rgba(200,240,255,0.28)'; g.lineWidth = 1;
        for (const [db] of SCALE.slice(0, -1)) {
            const y = METER_BOTTOM - dbToSeg(db) * (SEG_H + SEG_GAP) + SEG_GAP / 2;
            for (const [x1, x2, tx, al] of [[530, 546, 520, 'right'], [1054, 1070, 1080, 'left']]) {
                g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke();
                g.textAlign = al; g.textBaseline = 'middle'; g.fillText(db, tx, y);
            }
        }
        g.restore();
    }
    function drawLabels(g) {
        g.save(); g.textAlign = 'center';
        COLS.forEach(c => {
            const idx = c.key === 'SUB' ? 2 : (c.key === 'L' ? 0 : 1);
            const cx = c.x + c.w / 2, db = Math.max(-60, level[idx]);
            const txt = (c.key === 'SUB' && subOffline()) ? '--.-' : (db <= -59.5 ? '-inf' : (db > -0.05 ? '+' : '') + db.toFixed(1));
            roundRect(g, cx - 46, METER_TOP - 48, 92, 30, 7);
            g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.08)'; g.stroke();
            g.font = `19px ${F.mono}, monospace`; g.textBaseline = 'middle';
            g.fillStyle = level[idx] > -6 ? PAL.warn : 'rgba(225,248,255,0.88)'; g.fillText(txt, cx, METER_TOP - 33);
            g.font = `700 20px ${F.disp}, sans-serif`; g.fillStyle = c.col[1]; g.textBaseline = 'alphabetic';
            g.letterSpacing = '6px'; g.fillText(c.key, cx + 3, METER_BOTTOM + 40); g.letterSpacing = '0px';
            g.font = `500 13px ${F.jp}, sans-serif`; g.fillStyle = PAL.text; g.fillText(c.jp, cx, METER_BOTTOM + 62);
        });
        g.restore();
    }

    // ---------- now playing + status ----------
    let spotMeta = null, spotMetaAt = 0;
    function nowPlaying() {
        const s = (window.MymoodeExtras && window.MymoodeExtras.status) || {};
        const src = s.active_source || 'MPD';
        if (src === 'SPOTIFY' && performance.now() - spotMetaAt > 5000) {
            spotMetaAt = performance.now();
            fetch('mpd_bridge.php?action=spotmeta').then(r => r.json()).then(d => { spotMeta = d; }).catch(() => {});
        }
        const names = { MPD: 'Library', SPOTIFY: 'Spotify', BLUETOOTH: 'Bluetooth', AIRPLAY: 'AirPlay', ROON: 'Roon', SQUEEZELITE: 'Squeezelite' };
        let title = s.title || '', artist = (s.artist && s.artist !== src) ? s.artist : '';
        if (src === 'SPOTIFY' && spotMeta && spotMeta.title) { title = spotMeta.title; artist = spotMeta.artist || artist; }
        if (!title) title = s.state === 'play' ? (names[src] || src) : 'Idle';
        return { title, artist, source: names[src] || src, playing: s.state === 'play', rate: s.dac_rate };
    }
    function drawStatus(g) {
        const np = nowPlaying();
        g.save();
        g.font = `15px ${F.mono}, monospace`; g.fillStyle = PAL.text; g.textAlign = 'right';
        g.fillText(new Date().toTimeString().slice(0, 8), 1560, 44);
        const rate = np.rate ? (parseInt(np.rate) / 1000).toFixed(1) + ' kHz' : '-- kHz';
        g.fillText(`${rate} · ${nCh || '-'} CH · CAMILLADSP`, 1560, 66);
        g.fillText(hasSignal() ? 'LIVE' : 'NO SIGNAL', 1560, 88);
        const fit = (s, max) => { if (g.measureText(s).width <= max) return s; while (s && g.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; };
        g.textAlign = 'left';
        g.font = `500 11px ${F.disp}, sans-serif`; g.letterSpacing = '4px'; g.fillStyle = 'rgba(160,235,255,0.45)';
        g.fillText('NOW PLAYING', 40, 40);
        g.letterSpacing = '0px';
        g.beginPath(); g.arc(46, 60, 3.5, 0, Math.PI * 2);
        g.shadowColor = '#ff4fe6'; g.shadowBlur = np.playing ? 10 * BLUR : 0;
        g.fillStyle = np.playing ? '#ff4fe6' : 'rgba(255,79,230,0.3)'; g.fill(); g.shadowBlur = 0;
        g.font = `18px ${F.mono}, monospace`; g.fillStyle = 'rgba(230,250,255,0.9)';
        g.fillText(fit(np.title, 400), 58, 66);
        g.font = `15px ${F.mono}, monospace`; g.fillStyle = PAL.text;
        g.fillText(fit([np.artist, np.source].filter(Boolean).join(' · '), 400), 58, 88);
        g.restore();
    }

    // ---------- bass / treble / volume console ----------
    const API = () => window.MymoodeExtras;
    const CONSOLE = { x: 470, y: 744, w: 660, h: 78 }, TRACK_Y = CONSOLE.y + 52;
    const SLIDERS = [
        { k: 'bass', label: 'BASS', x: 500, w: 170, bip: true, col: '#3ff3ff', step: 0.5, fmt: v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' },
        { k: 'treble', label: 'TREBLE', x: 715, w: 170, bip: true, col: '#3ff3ff', step: 0.5, fmt: v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' },
        { k: 'vol', label: 'VOLUME', x: 930, w: 170, bip: false, col: '#ff4fe6', step: 1, fmt: v => Math.round(v) + '%' },
    ];
    const range = s => s.k === 'vol' ? [0, 100] : [-(API()?.tone().limit || 12), API()?.tone().limit || 12];
    const getVal = s => !API() ? 0 : s.k === 'vol' ? API().volume() : API().tone()[s.k];
    function setVal(s, v) {
        if (!API()) return;
        const [mn, mx] = range(s);
        v = Math.min(mx, Math.max(mn, Math.round(v / s.step) * s.step));
        if (s.k === 'vol') API().setVolume(v); else API().setTone(s.k, v);
    }
    let hoverSlider = null, dragSlider = null;
    function drawControls(g) {
        const { x, y, w, h } = CONSOLE;
        g.save();
        roundRect(g, x, y, w, h, 14);
        const cg = g.createLinearGradient(0, y, 0, y + h);
        cg.addColorStop(0, 'rgba(6, 18, 26, 0.94)'); cg.addColorStop(1, 'rgba(2, 7, 11, 0.97)');
        g.fillStyle = cg; g.fill();
        g.lineWidth = 1.2; g.strokeStyle = 'rgba(120, 230, 255, 0.16)'; g.stroke();
        g.beginPath(); g.moveTo(x + 14, y + 1); g.lineTo(x + w - 14, y + 1); g.strokeStyle = 'rgba(255,255,255,0.08)'; g.stroke();
        for (const s of SLIDERS) {
            const active = s === hoverSlider || s === dragSlider, [mn, mx] = range(s), v = getVal(s), f = (v - mn) / (mx - mn);
            g.font = `500 11px ${F.disp}, sans-serif`; g.letterSpacing = '4px'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
            g.fillStyle = active ? withAlpha(s.col, 0.95) : 'rgba(160,235,255,0.55)';
            g.fillText(s.label, s.x, y + 30);
            g.letterSpacing = '0px'; g.font = `16px ${F.mono}, monospace`; g.textAlign = 'right';
            g.fillStyle = 'rgba(230,250,255,0.85)'; g.fillText(s.fmt(v), s.x + s.w, y + 30);
            roundRect(g, s.x, TRACK_Y - 2, s.w, 4, 2); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fill();
            if (s.bip) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(s.x + s.w / 2 - 0.75, TRACK_Y - 7, 1.5, 14); }
            const a = s.bip ? s.x + s.w / 2 : s.x, b = s.x + f * s.w;
            if (Math.abs(b - a) > 0.5) {
                g.save(); g.shadowColor = s.col; g.shadowBlur = 14 * BLUR; g.fillStyle = s.col;
                roundRect(g, Math.min(a, b), TRACK_Y - 2, Math.abs(b - a), 4, 2); g.fill();
                g.restore();
            }
            g.save();
            g.shadowColor = s.col; g.shadowBlur = (active ? 20 : 12) * BLUR;
            roundRect(g, b - 5, TRACK_Y - 10, 10, 20, 5); g.fillStyle = '#081217'; g.fill();
            g.lineWidth = 1.6; g.strokeStyle = s.col; g.stroke();
            g.fillStyle = mix(s.col, '#ffffff', 0.6); g.fillRect(b - 1, TRACK_Y - 5, 2, 10);
            g.restore();
        }
        g.restore();
    }

    // ---------- canvas, lifecycle, input ----------
    let canvas = null, ctx = null, running = false, raf = 0, last = 0, view = { s: 1, ox: 0, oy: 0 };
    let lite = false, perfSum = 0, perfN = 0;

    function toDesign(e) {
        const r = canvas.getBoundingClientRect(), dpr = Math.min(1.5, window.devicePixelRatio || 1);
        return { x: ((e.clientX - r.left) * dpr - view.ox) / view.s, y: ((e.clientY - r.top) * dpr - view.oy) / view.s };
    }
    const sliderAt = p => SLIDERS.find(s => p.x >= s.x - 12 && p.x <= s.x + s.w + 12 && Math.abs(p.y - TRACK_Y) <= 18) || null;
    function setFromX(s, x) {
        const [mn, mx] = range(s), f = Math.min(1, Math.max(0, (x - s.x) / s.w));
        setVal(s, mn + f * (mx - mn));
    }
    function bindInput() {
        // Slider gestures stay on the canvas; everything else bubbles to the screensaver
        // (swipe to change skin, tap for the mini-player).
        canvas.addEventListener('pointerdown', e => {
            const s = sliderAt(toDesign(e)); if (!s) return;
            e.stopPropagation(); e.preventDefault();
            dragSlider = s; canvas.setPointerCapture(e.pointerId); setFromX(s, toDesign(e).x);
        });
        canvas.addEventListener('pointermove', e => {
            const p = toDesign(e);
            if (dragSlider) { e.stopPropagation(); setFromX(dragSlider, p.x); }
            hoverSlider = dragSlider || sliderAt(p);
            canvas.style.cursor = hoverSlider ? 'ew-resize' : '';
        });
        const end = e => { if (dragSlider) { e.stopPropagation(); dragSlider = null; } };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        canvas.addEventListener('dblclick', e => { const s = sliderAt(toDesign(e)); if (s && s.bip) { e.stopPropagation(); setVal(s, 0); } });
        canvas.addEventListener('wheel', e => {
            const s = sliderAt(toDesign(e)); if (!s) return;
            e.preventDefault(); e.stopPropagation();
            setVal(s, getVal(s) + (e.deltaY < 0 ? s.step : -s.step));
        }, { passive: false });
    }

    function frame(ts) {
        if (!running) return;
        const t = ts / 1000, dt = Math.min(0.05, t - (last || t)); last = t;
        // after ~3 s, fall back to lite mode if the device can't hold ~40 fps
        if (!lite && perfN < 180) { perfSum += dt; if (++perfN === 180 && perfSum / perfN > 1 / 40) { lite = true; BLUR = 0.5; } }
        ballistics(dt);

        const dpr = Math.min(1.5, window.devicePixelRatio || 1);
        const cw = Math.round(canvas.clientWidth * dpr), ch = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
        const s = Math.max(cw / W, ch / H);
        view = { s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2 };
        ctx.setTransform(s, 0, 0, s, view.ox, view.oy);

        ctx.drawImage(city, 0, 0);
        if (!lite) drawSearchlights(ctx, t);
        drawFlares(ctx, t);
        drawBeacons(ctx, t);
        drawSpinners(ctx, t, dt);
        drawHologram(ctx, t);
        drawShopSigns(ctx);
        drawTraffic(ctx, dt);

        ctx.save();
        ctx.beginPath(); ctx.rect(0, METER_BOTTOM + 84, W, H); ctx.clip();
        ctx.translate(0, (METER_BOTTOM + 84) * 2 - 20); ctx.scale(1, -1);
        ctx.globalAlpha = 0.20; drawMeters(ctx, true);
        ctx.restore();
        const fade = ctx.createLinearGradient(0, METER_BOTTOM + 84, 0, H);
        fade.addColorStop(0, 'rgba(1,3,6,0)'); fade.addColorStop(0.7, 'rgba(1,3,6,0.92)'); fade.addColorStop(1, 'rgba(1,3,6,1)');
        ctx.fillStyle = fade; ctx.fillRect(0, METER_BOTTOM + 84, W, H - METER_BOTTOM - 84);

        drawGroundReflections(ctx, t);
        if (!lite) drawRipples(ctx, dt);
        drawRiders(ctx, t, dt);
        drawVentsAndSteam(ctx, t, dt, lite);
        if (!lite) drawMotes(ctx, t, dt);
        drawMeters(ctx, false);
        drawScale(ctx);
        drawLabels(ctx);
        drawControls(ctx);
        drawSign(ctx, t);
        drawStatus(ctx);

        const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 1.05);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.62)');
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
        raf = requestAnimationFrame(frame);
    }

    function start() {
        if (running) return;
        const host = document.getElementById('screensaverOverlay');
        if (!host) return;
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'neonBarsCanvas';
            // Mymoode styles "#screensaverOverlay canvas" with position: relative !important and
            // max-width: 48% for its own meters; inline !important wins over that.
            const css = { position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
                'max-width': 'none', 'max-height': 'none', 'z-index': '50', 'touch-action': 'none', margin: '0' };
            for (const [k, v] of Object.entries(css)) canvas.style.setProperty(k, v, 'important');
            host.appendChild(canvas);
            ctx = canvas.getContext('2d');
            bindInput();
        }
        if (!city) buildCity();
        canvas.style.setProperty('display', 'block', 'important');
        running = true; last = 0;
        wsConnect();
        fontsReady.then(() => { if (running) raf = requestAnimationFrame(frame); });
    }
    function stop() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(raf);
        wsDisconnect();
        dragSlider = hoverSlider = null;
        if (canvas) canvas.style.setProperty('display', 'none', 'important');
    }

    // ---------- menu entry + activation ----------
    function addMenuEntry() {
        const sel = document.getElementById('vuStyleSelect');
        if (!sel || sel.querySelector(`option[value="${STYLE}"]`)) return sel;
        const opt = document.createElement('option');
        opt.value = STYLE; opt.textContent = 'Neon Bars · Donkey ベイビー';
        sel.appendChild(opt);
        // Mymoode may have tried to restore this style before the option existed
        try { if (localStorage.getItem('camilla_vu_style') === STYLE) sel.value = STYLE; } catch (_) {}
        return sel;
    }
    function init() {
        const sel = addMenuEntry();
        if (!sel) return;
        setInterval(() => {
            const want = typeof ssActive !== 'undefined' && ssActive && sel.value === STYLE && !document.hidden;
            if (want) start(); else stop();
        }, 250);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
