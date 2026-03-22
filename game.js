// ── Gravity Orbit Simulation ── v2: Juice, Evolution & Destruction ──────────

(() => {
    'use strict';

    // ── Canvas Setup ───────────────────────────────────────────────────────
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let W, H, dpr;

    function resize() {
        dpr = window.devicePixelRatio || 1;
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize);
    resize();

    // ── Constants ──────────────────────────────────────────────────────────
    const G = 800;
    const MIN_DIST = 5;
    const TRAIL_LENGTH = 120;
    const OFFSCREEN_MARGIN = 600;
    const DEFAULT_MASS = 40;
    const LAUNCH_SCALE = 0.35;
    const MAX_BODIES = 200;

    // Evolution thresholds
    const STAR_MASS = 300;
    const BLACK_HOLE_MASS = 1200;

    // ── Color Palette ──────────────────────────────────────────────────────
    const PALETTE = [
        { h: 210, s: 90, l: 65 },
        { h: 280, s: 80, l: 68 },
        { h: 340, s: 85, l: 65 },
        { h: 15,  s: 90, l: 60 },
        { h: 45,  s: 95, l: 62 },
        { h: 160, s: 75, l: 55 },
        { h: 120, s: 70, l: 58 },
        { h: 190, s: 85, l: 60 },
    ];

    const STAR_COLOR = { h: 45, s: 100, l: 80 };
    const BLACK_HOLE_COLOR = { h: 270, s: 90, l: 25 };

    function randomColor() {
        return PALETTE[Math.floor(Math.random() * PALETTE.length)];
    }

    function hslStr(c, a = 1) {
        return `hsla(${c.h}, ${c.s}%, ${c.l}%, ${a})`;
    }

    // ── Audio Engine (Web Audio API) ──────────────────────────────────────
    let audioCtx = null;
    let masterGain = null;
    let ambientOsc = null;
    let audioStarted = false;

    function initAudio() {
        if (audioStarted) return;
        audioStarted = true;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(audioCtx.destination);

        // ambient drone
        ambientOsc = audioCtx.createOscillator();
        const ambientGain = audioCtx.createGain();
        ambientGain.gain.value = 0.02;
        ambientOsc.type = 'sine';
        ambientOsc.frequency.value = 55;
        ambientOsc.connect(ambientGain);
        ambientGain.connect(masterGain);
        ambientOsc.start();
    }

    function playMergeSound(mass) {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const intensity = Math.min(mass / BLACK_HOLE_MASS, 1);

        // deep bass rumble
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(40 + intensity * 20, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);
        gain.gain.setValueAtTime(0.15 + intensity * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8 + intensity * 0.4);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 1.2 + intensity * 0.4);

        // impact crack
        const noise = audioCtx.createOscillator();
        const noiseGain = audioCtx.createGain();
        noise.type = 'sawtooth';
        noise.frequency.setValueAtTime(150 + Math.random() * 100, now);
        noise.frequency.exponentialRampToValueAtTime(30, now + 0.15);
        noiseGain.gain.setValueAtTime(0.08 + intensity * 0.12, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        noise.connect(noiseGain);
        noiseGain.connect(masterGain);
        noise.start(now);
        noise.stop(now + 0.2);
    }

    function playEvolutionSound(type) {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;

        if (type === 'star') {
            // rising shimmer
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.6);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 1.0);

            // harmonic
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(330, now);
            osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.6);
            gain2.gain.setValueAtTime(0.06, now);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc2.connect(gain2);
            gain2.connect(masterGain);
            osc2.start(now);
            osc2.stop(now + 0.8);
        } else if (type === 'blackhole') {
            // deep ominous drop
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(20, now + 1.5);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 2.0);

            // rumble layer
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(35, now);
            gain2.gain.setValueAtTime(0.08, now);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
            osc2.connect(gain2);
            gain2.connect(masterGain);
            osc2.start(now);
            osc2.stop(now + 2.0);
        }
    }

    function playLaunchSound() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    // ── Screen Shake ────────────────────────────────────────────────────────
    let shakeX = 0, shakeY = 0;
    let shakeIntensity = 0;
    let shakeDuration = 0;
    let shakeTime = 0;

    function triggerShake(intensity, duration) {
        shakeIntensity = Math.max(shakeIntensity, intensity);
        shakeDuration = Math.max(shakeDuration, duration);
        shakeTime = 0;
    }

    function updateShake(dt) {
        if (shakeDuration <= 0) {
            shakeX = 0;
            shakeY = 0;
            return;
        }
        shakeTime += dt;
        if (shakeTime >= shakeDuration) {
            shakeDuration = 0;
            shakeIntensity = 0;
            shakeX = 0;
            shakeY = 0;
            return;
        }
        const decay = 1 - (shakeTime / shakeDuration);
        const intensity = shakeIntensity * decay;
        shakeX = (Math.random() - 0.5) * 2 * intensity;
        shakeY = (Math.random() - 0.5) * 2 * intensity;
    }

    // ── Slow Motion ─────────────────────────────────────────────────────────
    let slowMoFactor = 1;
    let slowMoTarget = 1;
    let slowMoDuration = 0;
    let slowMoTime = 0;

    function triggerSlowMo(factor, duration) {
        slowMoTarget = factor;
        slowMoDuration = duration;
        slowMoTime = 0;
    }

    function updateSlowMo(dt) {
        if (slowMoDuration > 0) {
            slowMoTime += dt;
            if (slowMoTime >= slowMoDuration) {
                slowMoDuration = 0;
                slowMoTarget = 1;
            }
        }
        slowMoFactor += (slowMoTarget - slowMoFactor) * 0.1;
    }

    // ── Achievement / Toast System ─────────────────────────────────────────
    const toastQueue = [];
    let activeToast = null;
    let toastTimer = 0;
    const TOAST_DURATION = 3.0;

    function showToast(title, subtitle) {
        toastQueue.push({ title, subtitle });
    }

    function updateToast(dt) {
        if (activeToast) {
            toastTimer += dt;
            if (toastTimer >= TOAST_DURATION) {
                activeToast = null;
                toastTimer = 0;
            }
        }
        if (!activeToast && toastQueue.length > 0) {
            activeToast = toastQueue.shift();
            toastTimer = 0;
        }
    }

    function drawToast() {
        if (!activeToast) return;
        const progress = toastTimer / TOAST_DURATION;
        let alpha;
        if (progress < 0.15) alpha = progress / 0.15;
        else if (progress > 0.75) alpha = 1 - (progress - 0.75) / 0.25;
        else alpha = 1;

        const y = 100;
        ctx.save();
        ctx.textAlign = 'center';

        // title
        ctx.font = '600 1.1rem Inter, sans-serif';
        ctx.fillStyle = `rgba(255, 220, 100, ${alpha * 0.95})`;
        ctx.shadowColor = `rgba(255, 200, 50, ${alpha * 0.5})`;
        ctx.shadowBlur = 20;
        ctx.fillText(activeToast.title, W / 2, y);
        ctx.shadowBlur = 0;

        // subtitle
        if (activeToast.subtitle) {
            ctx.font = '300 0.75rem Inter, sans-serif';
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
            ctx.fillText(activeToast.subtitle, W / 2, y + 22);
        }
        ctx.restore();
    }

    // ── Stars Background ──────────────────────────────────────────────────
    const stars = [];
    function generateStars() {
        stars.length = 0;
        const count = Math.floor((W * H) / 2800);
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 1.2 + 0.2,
                a: Math.random() * 0.6 + 0.1,
                twinkleSpeed: Math.random() * 0.02 + 0.005,
                twinkleOffset: Math.random() * Math.PI * 2,
            });
        }
    }
    generateStars();
    window.addEventListener('resize', generateStars);

    function drawStars(t) {
        for (const s of stars) {
            const flicker = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset);
            const alpha = s.a * (0.5 + 0.5 * flicker);
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(220, 230, 255, ${alpha})`;
            ctx.fill();
        }
    }

    // ── Particle System ─────────────────────────────────────────────────
    const particles = [];

    function spawnExplosion(x, y, color, count = 30, speed = 4) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const v = Math.random() * speed + 1;
            const life = Math.random() * 0.6 + 0.3;
            particles.push({
                x, y,
                vx: Math.cos(angle) * v,
                vy: Math.sin(angle) * v,
                life,
                maxLife: life,
                r: Math.random() * 2.5 + 0.8,
                color,
            });
        }
    }

    // Ring burst for evolution events
    function spawnRingBurst(x, y, color, radius, count = 50) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const v = radius * 0.06 + Math.random() * 2;
            const life = Math.random() * 0.8 + 0.5;
            particles.push({
                x, y,
                vx: Math.cos(angle) * v,
                vy: Math.sin(angle) * v,
                life,
                maxLife: life,
                r: Math.random() * 3 + 1,
                color,
            });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.vx *= 0.97;
            p.vy *= 0.97;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles() {
        for (const p of particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
            ctx.fillStyle = hslStr(p.color, alpha * 0.9);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * alpha * 3, 0, Math.PI * 2);
            ctx.fillStyle = hslStr(p.color, alpha * 0.15);
            ctx.fill();
        }
    }

    // ── Body Classification ──────────────────────────────────────────────
    function getBodyType(mass) {
        if (mass >= BLACK_HOLE_MASS) return 'blackhole';
        if (mass >= STAR_MASS) return 'star';
        return 'planet';
    }

    // ── Body Class ───────────────────────────────────────────────────────
    class Body {
        constructor(x, y, vx, vy, mass) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.mass = mass || DEFAULT_MASS;
            this.radius = this.calcRadius();
            this.color = randomColor();
            this.trail = [];
            this.alive = true;
            this.type = getBodyType(this.mass);
            this.prevType = this.type;
            this.pulsePhase = Math.random() * Math.PI * 2;
        }

        calcRadius() {
            return Math.pow(this.mass, 0.38) * 1.8 + 2;
        }

        updateType() {
            this.prevType = this.type;
            this.type = getBodyType(this.mass);
        }

        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > TRAIL_LENGTH) this.trail.shift();
            this.pulsePhase += dt * 3;
        }

        draw(time) {
            const r = this.radius;
            const c = this.type === 'star' ? STAR_COLOR
                    : this.type === 'blackhole' ? BLACK_HOLE_COLOR
                    : this.color;

            // ── Trail ──
            if (this.trail.length > 2) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                for (let i = 1; i < this.trail.length; i++) {
                    const alpha = (i / this.trail.length) * 0.55;
                    const width = (i / this.trail.length) * (r * 0.6) + 0.3;
                    ctx.beginPath();
                    ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
                    ctx.lineTo(this.trail[i].x, this.trail[i].y);
                    ctx.strokeStyle = hslStr(c, alpha);
                    ctx.lineWidth = width;
                    ctx.stroke();
                }
            }

            if (this.type === 'blackhole') {
                this.drawBlackHole(time);
            } else if (this.type === 'star') {
                this.drawStar(time);
            } else {
                this.drawPlanet();
            }
        }

        drawPlanet() {
            const r = this.radius;
            const c = this.color;

            // Outer glow
            const glow = ctx.createRadialGradient(this.x, this.y, r * 0.2, this.x, this.y, r * 3.5);
            glow.addColorStop(0, hslStr(c, 0.25));
            glow.addColorStop(0.4, hslStr(c, 0.08));
            glow.addColorStop(1, hslStr(c, 0));
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 3.5, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();

            // Body gradient
            const grad = ctx.createRadialGradient(
                this.x - r * 0.25, this.y - r * 0.25, r * 0.05,
                this.x, this.y, r
            );
            grad.addColorStop(0, hslStr({ h: c.h, s: c.s - 10, l: Math.min(c.l + 28, 95) }, 1));
            grad.addColorStop(0.5, hslStr(c, 1));
            grad.addColorStop(1, hslStr({ h: c.h, s: c.s, l: c.l - 15 }, 0.9));
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Specular highlight
            const spec = ctx.createRadialGradient(
                this.x - r * 0.3, this.y - r * 0.3, 0,
                this.x - r * 0.1, this.y - r * 0.1, r * 0.7
            );
            spec.addColorStop(0, 'rgba(255,255,255,0.45)');
            spec.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
            ctx.fillStyle = spec;
            ctx.fill();
        }

        drawStar(time) {
            const r = this.radius;
            const pulse = 0.9 + 0.1 * Math.sin(this.pulsePhase);
            const pr = r * pulse;

            // Massive corona glow
            const corona = ctx.createRadialGradient(this.x, this.y, pr * 0.3, this.x, this.y, pr * 8);
            corona.addColorStop(0, 'rgba(255, 230, 150, 0.35)');
            corona.addColorStop(0.2, 'rgba(255, 200, 80, 0.15)');
            corona.addColorStop(0.5, 'rgba(255, 160, 40, 0.05)');
            corona.addColorStop(1, 'rgba(255, 100, 20, 0)');
            ctx.beginPath();
            ctx.arc(this.x, this.y, pr * 8, 0, Math.PI * 2);
            ctx.fillStyle = corona;
            ctx.fill();

            // Secondary glow ring
            const ring = ctx.createRadialGradient(this.x, this.y, pr * 0.8, this.x, this.y, pr * 4);
            ring.addColorStop(0, 'rgba(255, 240, 200, 0.3)');
            ring.addColorStop(0.5, 'rgba(255, 200, 100, 0.08)');
            ring.addColorStop(1, 'rgba(255, 150, 50, 0)');
            ctx.beginPath();
            ctx.arc(this.x, this.y, pr * 4, 0, Math.PI * 2);
            ctx.fillStyle = ring;
            ctx.fill();

            // Star body — white-hot center fading to yellow/orange edge
            const body = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, pr);
            body.addColorStop(0, 'rgba(255, 255, 255, 1)');
            body.addColorStop(0.3, 'rgba(255, 250, 220, 1)');
            body.addColorStop(0.7, 'rgba(255, 210, 100, 1)');
            body.addColorStop(1, 'rgba(255, 160, 50, 0.9)');
            ctx.beginPath();
            ctx.arc(this.x, this.y, pr, 0, Math.PI * 2);
            ctx.fillStyle = body;
            ctx.fill();

            // Lens flare spikes
            ctx.save();
            ctx.globalAlpha = 0.12 + 0.05 * Math.sin(this.pulsePhase * 1.3);
            ctx.strokeStyle = 'rgba(255, 240, 200, 0.6)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI + time * 0.0001;
                const len = pr * 5;
                ctx.beginPath();
                ctx.moveTo(
                    this.x + Math.cos(angle) * pr * 0.8,
                    this.y + Math.sin(angle) * pr * 0.8
                );
                ctx.lineTo(
                    this.x + Math.cos(angle) * len,
                    this.y + Math.sin(angle) * len
                );
                ctx.stroke();
            }
            ctx.restore();
        }

        drawBlackHole(time) {
            const r = this.radius;
            const pulse = 0.95 + 0.05 * Math.sin(this.pulsePhase * 2);
            const pr = r * pulse;

            // Gravitational lensing ring (accretion disk)
            ctx.save();
            const diskPulse = 0.8 + 0.2 * Math.sin(this.pulsePhase * 0.7);

            // Outer accretion glow
            const accretion = ctx.createRadialGradient(this.x, this.y, pr * 1.2, this.x, this.y, pr * 6);
            accretion.addColorStop(0, `rgba(180, 100, 255, ${0.25 * diskPulse})`);
            accretion.addColorStop(0.3, `rgba(255, 120, 50, ${0.15 * diskPulse})`);
            accretion.addColorStop(0.6, `rgba(255, 60, 20, ${0.06 * diskPulse})`);
            accretion.addColorStop(1, 'rgba(100, 0, 150, 0)');
            ctx.beginPath();
            ctx.arc(this.x, this.y, pr * 6, 0, Math.PI * 2);
            ctx.fillStyle = accretion;
            ctx.fill();

            // Rotating accretion disk arcs
            ctx.globalAlpha = 0.2 * diskPulse;
            for (let i = 0; i < 3; i++) {
                const startAngle = time * 0.001 * (1 + i * 0.3) + i * 2.1;
                const arcLen = 0.8 + Math.sin(this.pulsePhase + i) * 0.3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, pr * (2.5 + i * 0.8), startAngle, startAngle + arcLen);
                ctx.strokeStyle = i === 0 ? 'rgba(200, 130, 255, 0.8)'
                                : i === 1 ? 'rgba(255, 150, 80, 0.6)'
                                : 'rgba(255, 80, 40, 0.5)';
                ctx.lineWidth = 2.5 - i * 0.5;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.restore();

            // Event horizon — pure black
            ctx.beginPath();
            ctx.arc(this.x, this.y, pr, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();

            // Subtle edge highlight (photon sphere)
            const edge = ctx.createRadialGradient(this.x, this.y, pr * 0.85, this.x, this.y, pr * 1.15);
            edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
            edge.addColorStop(0.5, `rgba(180, 140, 255, ${0.3 * pulse})`);
            edge.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.beginPath();
            ctx.arc(this.x, this.y, pr * 1.15, 0, Math.PI * 2);
            ctx.fillStyle = edge;
            ctx.fill();
        }

        isOffscreen() {
            return (
                this.x < -OFFSCREEN_MARGIN ||
                this.x > W + OFFSCREEN_MARGIN ||
                this.y < -OFFSCREEN_MARGIN ||
                this.y > H + OFFSCREEN_MARGIN
            );
        }
    }

    // ── Game State ───────────────────────────────────────────────────────
    let bodies = [];
    let dragging = false;
    let dragStart = null;
    let dragEnd = null;
    let titleFaded = false;
    let lastTime = performance.now();
    let timeScale = 1;
    let gameMode = 'sandbox'; // 'sandbox' or 'destruction'
    let destructionScore = 0;
    let destructionBodies = 0;
    let destructionLaunched = false;

    // Achievement tracking
    const achievements = {
        firstStar: false,
        firstBlackHole: false,
        binarySystem: false,
        massiveMerge: false,
        fiveBodies: false,
    };

    // ── Destruction Mode ─────────────────────────────────────────────────
    function startDestructionMode() {
        gameMode = 'destruction';
        bodies = [];
        particles.length = 0;
        destructionScore = 0;
        destructionBodies = 0;
        destructionLaunched = false;

        // Spawn a solar system
        const cx = W / 2;
        const cy = H / 2;

        // Central star
        const star = new Body(cx, cy, 0, 0, STAR_MASS + 100);
        star.color = STAR_COLOR;
        star.type = 'star';
        bodies.push(star);

        // Orbiting planets
        const orbits = [
            { dist: 120, mass: 30, speed: 2.8 },
            { dist: 180, mass: 50, speed: 2.2 },
            { dist: 250, mass: 40, speed: 1.8 },
            { dist: 330, mass: 70, speed: 1.5 },
            { dist: 420, mass: 25, speed: 1.2 },
        ];

        for (const o of orbits) {
            const angle = Math.random() * Math.PI * 2;
            const px = cx + Math.cos(angle) * o.dist;
            const py = cy + Math.sin(angle) * o.dist;
            // orbital velocity perpendicular to radius
            const vx = -Math.sin(angle) * o.speed;
            const vy = Math.cos(angle) * o.speed;
            const planet = new Body(px, py, vx, vy, o.mass);
            bodies.push(planet);
            destructionBodies++;
        }

        showToast('DESTRUCTION MODE', 'Launch a rogue planet to destroy the system!');
        updateModeUI();
    }

    function exitDestructionMode() {
        gameMode = 'sandbox';
        bodies = [];
        particles.length = 0;
        destructionScore = 0;
        destructionLaunched = false;
        updateModeUI();
    }

    function updateModeUI() {
        const modeIndicator = document.getElementById('mode-indicator');
        const scoreDisplay = document.getElementById('score-display');
        const scoreValue = document.getElementById('score-value');
        const destructionBtn = document.getElementById('destruction-btn');
        const sandboxBtn = document.getElementById('sandbox-btn');

        if (gameMode === 'destruction') {
            modeIndicator.textContent = 'DESTRUCTION';
            modeIndicator.style.color = 'rgba(255, 100, 80, 0.9)';
            scoreDisplay.style.display = 'flex';
            destructionBtn.style.display = 'none';
            sandboxBtn.style.display = 'inline-block';
        } else {
            modeIndicator.textContent = 'SANDBOX';
            modeIndicator.style.color = 'rgba(255, 255, 255, 0.35)';
            scoreDisplay.style.display = 'none';
            destructionBtn.style.display = 'inline-block';
            sandboxBtn.style.display = 'none';
        }
    }

    // ── Physics ──────────────────────────────────────────────────────────
    function applyGravity(dt) {
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const a = bodies[i];
                const b = bodies[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);
                const softDist = Math.max(dist, MIN_DIST);
                const force = G * a.mass * b.mass / (softDist * softDist);

                const fx = force * (dx / softDist);
                const fy = force * (dy / softDist);

                a.vx += (fx / a.mass) * dt;
                a.vy += (fy / a.mass) * dt;
                b.vx -= (fx / b.mass) * dt;
                b.vy -= (fy / b.mass) * dt;

                // Check for near-collision slow-mo
                const combinedR = a.radius + b.radius;
                if (dist < combinedR * 4 && dist > combinedR) {
                    const totalMass = a.mass + b.mass;
                    if (totalMass > 150) {
                        const proximity = 1 - (dist - combinedR) / (combinedR * 3);
                        const slowAmount = Math.max(0.3, 1 - proximity * 0.5);
                        if (slowAmount < slowMoTarget) {
                            triggerSlowMo(slowAmount, 0.3);
                        }
                    }
                }

                // Collision
                if (dist < combinedR) {
                    mergeBodies(i, j);
                    return;
                }
            }
        }
    }

    function mergeBodies(i, j) {
        const a = bodies[i];
        const b = bodies[j];
        const totalMass = a.mass + b.mass;

        const nvx = (a.vx * a.mass + b.vx * b.mass) / totalMass;
        const nvy = (a.vy * a.mass + b.vy * b.mass) / totalMass;
        const nx = (a.x * a.mass + b.x * b.mass) / totalMass;
        const ny = (a.y * a.mass + b.y * b.mass) / totalMass;

        const mergedColor = a.mass >= b.mass ? a.color : b.color;
        const particleCount = Math.min(Math.floor(totalMass * 0.6), 60);
        spawnExplosion(nx, ny, mergedColor, particleCount, Math.min(totalMass * 0.04, 6));
        spawnExplosion(nx, ny, b.color, Math.floor(particleCount * 0.5), 3);

        // Screen shake proportional to mass
        const shakeAmount = Math.min(totalMass * 0.03, 15);
        const shakeDur = Math.min(0.1 + totalMass * 0.001, 0.5);
        triggerShake(shakeAmount, shakeDur);

        // Sound
        playMergeSound(totalMass);

        // Destruction mode scoring
        if (gameMode === 'destruction' && destructionLaunched) {
            destructionScore += Math.floor(totalMass);
            const scoreEl = document.getElementById('score-value');
            if (scoreEl) scoreEl.textContent = destructionScore;
        }

        const merged = new Body(nx, ny, nvx, nvy, totalMass);
        merged.color = mergedColor;
        merged.trail = a.mass >= b.mass ? [...a.trail] : [...b.trail];
        merged.updateType();

        // Check for evolution events
        const oldTypeA = a.type;
        const oldTypeB = b.type;
        if (merged.type === 'star' && oldTypeA !== 'star' && oldTypeB !== 'star') {
            spawnRingBurst(nx, ny, STAR_COLOR, merged.radius, 60);
            playEvolutionSound('star');
            triggerShake(10, 0.4);
            triggerSlowMo(0.15, 0.8);
            showToast('A STAR IS BORN', `Mass reached ${Math.round(totalMass)} — nuclear fusion ignited`);
            achievements.firstStar = true;
        } else if (merged.type === 'blackhole' && oldTypeA !== 'blackhole' && oldTypeB !== 'blackhole') {
            spawnRingBurst(nx, ny, { h: 270, s: 100, l: 70 }, merged.radius, 80);
            playEvolutionSound('blackhole');
            triggerShake(20, 0.6);
            triggerSlowMo(0.1, 1.2);
            showToast('BLACK HOLE FORMED', 'Gravitational collapse — nothing escapes');
            achievements.firstBlackHole = true;
        } else if (totalMass > 200 && !achievements.massiveMerge) {
            achievements.massiveMerge = true;
            showToast('MASSIVE COLLISION', 'Two giants become one');
        }

        bodies.splice(j, 1);
        bodies.splice(i, 1);
        bodies.push(merged);
    }

    // ── Launch Preview ──────────────────────────────────────────────────
    function drawLaunchPreview() {
        if (!dragging || !dragStart || !dragEnd) return;

        const dx = dragStart.x - dragEnd.x;
        const dy = dragStart.y - dragEnd.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        ctx.save();
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = -performance.now() * 0.03;

        const alpha = Math.min(dist / 100, 0.7);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(dragStart.x, dragStart.y);
        ctx.lineTo(dragStart.x + dx, dragStart.y + dy);
        ctx.stroke();
        ctx.setLineDash([]);

        const previewR = Math.pow(DEFAULT_MASS, 0.38) * 1.8 + 2;
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.005);
        const pglow = ctx.createRadialGradient(
            dragStart.x, dragStart.y, previewR * 0.3,
            dragStart.x, dragStart.y, previewR * 3
        );
        pglow.addColorStop(0, `rgba(255, 255, 255, ${0.2 * pulse})`);
        pglow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(dragStart.x, dragStart.y, previewR * 3, 0, Math.PI * 2);
        ctx.fillStyle = pglow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(dragStart.x, dragStart.y, previewR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + 0.3 * pulse})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (dist > 20) {
            const tipX = dragStart.x + dx;
            const tipY = dragStart.y + dy;
            const angle = Math.atan2(dy, dx);
            const headLen = 10;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(tipX - headLen * Math.cos(angle - 0.4), tipY - headLen * Math.sin(angle - 0.4));
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(tipX - headLen * Math.cos(angle + 0.4), tipY - headLen * Math.sin(angle + 0.4));
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // trajectory preview
        const vx = dx * LAUNCH_SCALE;
        const vy = dy * LAUNCH_SCALE;
        let px = dragStart.x, py = dragStart.y;
        let pvx = vx, pvy = vy;
        const steps = 60;
        const stepDt = 1 / 60;

        for (let s = 0; s < steps; s++) {
            for (const body of bodies) {
                const ddx = body.x - px;
                const ddy = body.y - py;
                const d = Math.sqrt(ddx * ddx + ddy * ddy);
                const sd = Math.max(d, MIN_DIST);
                const f = G * body.mass / (sd * sd);
                pvx += (f * ddx / sd) * stepDt;
                pvy += (f * ddy / sd) * stepDt;
            }
            px += pvx * stepDt;
            py += pvy * stepDt;
            const dotAlpha = (1 - s / steps) * 0.35;
            if (dotAlpha > 0.02) {
                ctx.beginPath();
                ctx.arc(px, py, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${dotAlpha})`;
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // ── Input Handling ──────────────────────────────────────────────────
    function getPos(e) {
        if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    function onDown(e) {
        if (e.target.closest('#hud')) return;
        e.preventDefault();
        initAudio();
        const pos = getPos(e);
        dragging = true;
        dragStart = pos;
        dragEnd = pos;

        if (!titleFaded) {
            titleFaded = true;
            document.getElementById('title-overlay').classList.add('faded');
        }
    }

    function onMove(e) {
        if (!dragging) return;
        e.preventDefault();
        dragEnd = getPos(e);
    }

    function onUp(e) {
        if (!dragging) return;
        e.preventDefault();

        if (dragStart && dragEnd && bodies.length < MAX_BODIES) {
            const dx = dragStart.x - dragEnd.x;
            const dy = dragStart.y - dragEnd.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            let vx = 0, vy = 0;
            if (dist > 5) {
                vx = dx * LAUNCH_SCALE;
                vy = dy * LAUNCH_SCALE;
            }
            bodies.push(new Body(dragStart.x, dragStart.y, vx, vy, DEFAULT_MASS));
            playLaunchSound();

            if (gameMode === 'destruction' && !destructionLaunched) {
                destructionLaunched = true;
                showToast('ROGUE PLANET LAUNCHED', 'Watch the chaos unfold...');
            }

            // Achievement: 5 bodies
            if (bodies.length >= 5 && !achievements.fiveBodies) {
                achievements.fiveBodies = true;
                showToast('CROWDED SPACE', '5 bodies orbiting — things are getting interesting');
            }
        }

        dragging = false;
        dragStart = null;
        dragEnd = null;
    }

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp, { passive: false });

    // Scroll to zoom time
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        timeScale = Math.max(0.25, Math.min(4, timeScale + delta));
        document.getElementById('time-value').textContent = timeScale.toFixed(1) + 'x';
    }, { passive: false });

    // ── Buttons ─────────────────────────────────────────────────────────
    document.getElementById('clear-btn').addEventListener('click', () => {
        if (gameMode === 'destruction') {
            startDestructionMode();
        } else {
            bodies = [];
            particles.length = 0;
        }
    });

    document.getElementById('destruction-btn').addEventListener('click', startDestructionMode);
    document.getElementById('sandbox-btn').addEventListener('click', exitDestructionMode);

    // ── HUD Updates ─────────────────────────────────────────────────────
    const bodyCountEl = document.getElementById('body-count');
    const totalMassEl = document.getElementById('total-mass');

    function updateHUD() {
        bodyCountEl.textContent = bodies.length;
        const totalMass = bodies.reduce((sum, b) => sum + b.mass, 0);
        totalMassEl.textContent = Math.round(totalMass);
    }

    // ── Gravity Field Ripples ─────────────────────────────────────────
    function drawGravityFields(time) {
        for (const body of bodies) {
            // Only show fields for bodies with enough mass to matter
            if (body.mass < 80) continue;

            const r = body.radius;
            const intensity = Math.min((body.mass - 80) / 400, 1); // 0→1 as mass grows
            const ringCount = body.type === 'blackhole' ? 8
                            : body.type === 'star' ? 6
                            : Math.floor(2 + intensity * 3);

            const maxRadius = r * (4 + intensity * 12);
            const speed = body.type === 'blackhole' ? 0.0008
                        : body.type === 'star' ? 0.0012
                        : 0.0015;

            // Color based on body type
            let ringR, ringG, ringB;
            if (body.type === 'blackhole') {
                ringR = 140; ringG = 80; ringB = 255;
            } else if (body.type === 'star') {
                ringR = 255; ringG = 200; ringB = 100;
            } else {
                ringR = body.color.h < 60 || body.color.h > 300 ? 255 : 100;
                ringG = body.color.h > 90 && body.color.h < 200 ? 255 : 150;
                ringB = body.color.h > 180 && body.color.h < 320 ? 255 : 100;
            }

            ctx.save();
            ctx.lineWidth = 1;

            for (let i = 0; i < ringCount; i++) {
                // Each ring expands outward over time then resets
                const phase = ((time * speed + i / ringCount) % 1);
                const ringRadius = r * 1.5 + phase * (maxRadius - r * 1.5);

                // Fade in, then fade out
                let alpha;
                if (phase < 0.15) alpha = phase / 0.15;
                else alpha = 1 - (phase - 0.15) / 0.85;
                alpha *= intensity * 0.2;

                if (alpha < 0.005) continue;

                // Draw dashed ring
                ctx.beginPath();
                const segments = 32;
                const gapRatio = 0.35;
                for (let s = 0; s < segments; s++) {
                    const startAngle = (s / segments) * Math.PI * 2;
                    const endAngle = startAngle + ((1 - gapRatio) / segments) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.arc(body.x, body.y, ringRadius, startAngle, endAngle);
                    ctx.strokeStyle = `rgba(${ringR}, ${ringG}, ${ringB}, ${alpha})`;
                    ctx.stroke();
                }

                // Subtle glow ring behind
                ctx.beginPath();
                ctx.arc(body.x, body.y, ringRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${ringR}, ${ringG}, ${ringB}, ${alpha * 0.3})`;
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.lineWidth = 1;
            }

            ctx.restore();
        }
    }

    // ── Main Loop ───────────────────────────────────────────────────────
    function loop(now) {
        requestAnimationFrame(loop);

        let dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        // Apply time scale and slow-mo
        updateSlowMo(dt);
        dt *= timeScale * slowMoFactor;

        // Update shake
        updateShake(dt);

        // Update toast
        updateToast(dt);

        // ── Clear & background ──
        ctx.save();
        ctx.translate(shakeX, shakeY);

        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fillRect(-20, -20, W + 40, H + 40);

        const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
        bg.addColorStop(0, 'rgba(10, 12, 28, 1)');
        bg.addColorStop(0.5, 'rgba(5, 6, 18, 1)');
        bg.addColorStop(1, 'rgba(0, 0, 2, 1)');
        ctx.fillStyle = bg;
        ctx.fillRect(-20, -20, W + 40, H + 40);

        drawStars(now);

        // ── Physics substeps ──
        const substeps = 3;
        const subDt = dt / substeps;
        for (let s = 0; s < substeps; s++) {
            applyGravity(subDt);
            for (const body of bodies) body.update(subDt);
        }

        bodies = bodies.filter(b => !b.isOffscreen());
        updateParticles(dt);

        // ── Gravity field ripples ──
        drawGravityFields(now);

        for (const body of bodies) body.draw(now);
        drawParticles();
        drawLaunchPreview();

        // Slow-mo vignette
        if (slowMoFactor < 0.7) {
            const vignetteAlpha = (1 - slowMoFactor) * 0.4;
            const vignette = ctx.createRadialGradient(W/2, H/2, W*0.3, W/2, H/2, W*0.8);
            vignette.addColorStop(0, 'rgba(0,0,0,0)');
            vignette.addColorStop(1, `rgba(0,0,0,${vignetteAlpha})`);
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, W, H);
        }

        ctx.restore();

        // Toast (drawn without shake)
        drawToast();

        updateHUD();
    }

    // Init
    updateModeUI();
    requestAnimationFrame(loop);
})();
