import Phaser from 'phaser';

/**
 * AlchemicalLabScene.js — Scholomance Signal Chamber Background
 *
 * Renders a dark alchemical laboratory environment behind the Thaumaturgy Console.
 * All animations are driven by precise bytecode math in update(time, delta):
 *   - Bottle glows: multi-harmonic sine pulses
 *   - Candle flicker: sum of three incommensurate sine waves (Perlin-like)
 *   - LED indicators: deterministic scrolling column pattern
 *   - Arch portal: slow linear rotation
 *
 * NO tweens. All motion = f(time).
 */
export class AlchemicalLabScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AlchemicalLabScene' });
  }

  init() {
    this._bottleSpecs   = [];
    this._candleSpecs   = [];
    this._leftCols      = [];
    this._rightCols     = [];
    this._archAngle     = 0;
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────

  create() {
    const { width: W, height: H } = this.scale;

    // Generate soft-circle particle texture
    this._makeParticleTex();

    // ── Static layers (drawn once) ───────────────────────────────
    this._bgGfx       = this.add.graphics();
    this._archStatGfx = this.add.graphics();   // static arch rings / ticks
    this._archRotGfx  = this.add.graphics();   // hexagram that rotates
    this._leftGfx     = this.add.graphics();
    this._rightGfx    = this.add.graphics();
    this._bottleGfx   = this.add.graphics();
    this._candleGfx   = this.add.graphics();

    // ── Dynamic layers (cleared + redrawn each frame) ───────────
    this._glowGfx     = this.add.graphics();   // bottle & candle halos
    this._ledGfx      = this.add.graphics();   // indicator column segments

    // ── Top overlay (drawn last) ─────────────────────────────────
    this._vigGfx      = this.add.graphics();

    // Build everything
    this._drawBackground(W, H);
    this._drawArchStatic(W, H);
    this._drawArchRotating(W, H);     // draws initial frame; rotated in update
    this._drawLeftWing(W, H);
    this._drawRightWing(W, H);
    this._buildBottles(W, H);
    this._buildCandleBodies(W, H);
    this._buildParticles(W, H);
    this._drawVignette(W, H);
  }

  // ─────────────────────────────────────────────────────────────────
  // PARTICLE TEXTURE
  // ─────────────────────────────────────────────────────────────────

  _makeParticleTex() {
    const size = 16;
    const half = size / 2;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Soft radial falloff: multiple concentric circles
    for (let r = half; r >= 1; r--) {
      const alpha = Math.pow(1 - r / half, 0.5);
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(half, half, r);
    }
    g.generateTexture('labPt', size, size);
    g.destroy();
  }

  // ─────────────────────────────────────────────────────────────────
  // BACKGROUND  (stone wall)
  // ─────────────────────────────────────────────────────────────────

  _drawBackground(W, H) {
    const g = this._bgGfx;

    g.fillStyle(0x010305, 1);
    g.fillRect(0, 0, W, H);

    // Stone block grid with half-brick offset every other row
    const bw = 72, bh = 36;
    const STONE = [0x030709, 0x040a0f, 0x03060c, 0x050b0e, 0x040810];
    for (let row = 0; row * bh <= H + bh; row++) {
      const offset = (row % 2) * (bw * 0.5);
      for (let col = -1; col * bw <= W + bw; col++) {
        const x = col * bw + offset;
        const y = row * bh;
        const si = (row * 7 + col * 13 + 17) % STONE.length;
        g.fillStyle(STONE[si], 0.6);
        g.fillRect(x, y, bw - 1, bh - 1);
      }
    }

    // Mortar seams
    g.lineStyle(1, 0x020507, 0.8);
    for (let row = 0; row * bh <= H; row++) {
      g.lineBetween(0, row * bh, W, row * bh);
    }

    // Ceiling darkness
    g.fillStyle(0x000000, 0.5);
    g.fillRect(0, 0, W, H * 0.07);

    // Floor darkness
    g.fillStyle(0x000000, 0.4);
    g.fillRect(0, H * 0.88, W, H * 0.12);

    // Subtle teal atmosphere tint on upper third
    for (let y = 0; y < H * 0.35; y += 3) {
      const a = (1 - y / (H * 0.35)) * 0.04;
      g.fillStyle(0x003318, a);
      g.fillRect(0, y, W, 3);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // ARCH PORTAL  (top centre)
  // ─────────────────────────────────────────────────────────────────

  _drawArchStatic(W, H) {
    const g = this._archStatGfx;
    const cx = W * 0.5;
    const cy = H * 0.04;   // partially above viewport
    const outerR = Math.min(W * 0.32, 285);

    // Soft outer glow halos
    const halos = [
      { r: outerR + 45, w: 10, a: 0.025 },
      { r: outerR + 28, w: 7,  a: 0.045 },
      { r: outerR + 14, w: 4,  a: 0.07  },
    ];
    halos.forEach(({ r, w, a }) => {
      g.lineStyle(w, 0x004422, a);
      g.strokeCircle(cx, cy, r);
    });

    // Main outer ring — dark metal
    g.lineStyle(6, 0x091610, 1);
    g.strokeCircle(cx, cy, outerR + 2);
    g.lineStyle(2, 0x14281a, 0.8);
    g.strokeCircle(cx, cy, outerR);
    g.lineStyle(1, 0x0a1810, 0.35);
    g.strokeCircle(cx, cy, outerR - 8);

    // Tick marks
    for (let deg = 0; deg < 360; deg += 10) {
      const isMajor = deg % 30 === 0;
      const len = isMajor ? 14 : 7;
      const rad = Phaser.Math.DegToRad(deg);
      const r1 = outerR - len;
      const r2 = outerR - 2;
      g.lineStyle(isMajor ? 2 : 1, isMajor ? 0x162c1e : 0x0c1812, isMajor ? 0.65 : 0.3);
      g.lineBetween(
        cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1,
        cx + Math.cos(rad) * r2, cy + Math.sin(rad) * r2
      );
    }

    // Interior fill
    g.fillStyle(0x010406, 0.55);
    g.fillCircle(cx, cy, outerR - 10);

    // Concentric inner rings
    [outerR * 0.77, outerR * 0.56, outerR * 0.36].forEach(r => {
      g.lineStyle(1, 0x0d2018, 0.45);
      g.strokeCircle(cx, cy, r);
    });

    // Cardinal cross
    const hexR = outerR * 0.53;
    g.lineStyle(1, 0x0e2218, 0.35);
    g.lineBetween(cx - hexR, cy, cx + hexR, cy);
    g.lineBetween(cx, cy - hexR, cx, cy + hexR);

    // Center node
    g.fillStyle(0x1a3828, 0.7);
    g.fillCircle(cx, cy, 4);
    g.lineStyle(1, 0x00aa66, 0.3);
    g.strokeCircle(cx, cy, 4);

    // Store for update()
    this._archCx = cx;
    this._archCy = cy;
    this._archHexR = hexR;
  }

  _drawArchRotating(_W, _H) {
    // Hexagram drawn into _archRotGfx, centered on origin.
    // Container is positioned at arch center. Rotation applied in update().
    const g = this._archRotGfx;
    g.clear();

    const hexR = this._archHexR ?? Math.min(W * 0.32, 285) * 0.53;

    // Two overlapping triangles (star of David / hexagram)
    for (let tri = 0; tri < 2; tri++) {
      const base = tri === 0 ? -90 : 90;
      g.lineStyle(1.5, 0x0f2c1e, 0.6);
      g.beginPath();
      for (let i = 0; i <= 3; i++) {
        const ang = Phaser.Math.DegToRad(base + i * 120);
        const px = Math.cos(ang) * hexR;
        const py = Math.sin(ang) * hexR;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }

    // Radial spokes
    g.lineStyle(1, 0x0a1810, 0.22);
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = Phaser.Math.DegToRad(deg);
      g.lineBetween(0, 0, Math.cos(rad) * hexR * 0.88, Math.sin(rad) * hexR * 0.88);
    }

    // Position at arch centre
    this._archRotGfx.setPosition(this._archCx, this._archCy);
  }

  // ─────────────────────────────────────────────────────────────────
  // SIDE WINGS
  // ─────────────────────────────────────────────────────────────────

  _drawLeftWing(W, H) {
    const g = this._leftGfx;
    const ww = W * 0.19;

    // Panel base
    g.fillStyle(0x030a0d, 0.97);
    g.fillRect(0, 0, ww, H);

    // Right border seam
    g.lineStyle(4, 0x091610, 1);
    g.lineBetween(ww, 0, ww, H);
    g.lineStyle(1, 0x152c1e, 0.45);
    g.lineBetween(ww - 3, 0, ww - 3, H);

    // Horizontal section dividers
    const divs = [H * 0.23, H * 0.47, H * 0.70];
    divs.forEach(dy => {
      g.lineStyle(1, 0x0a1810, 0.55);
      g.lineBetween(6, dy, ww - 6, dy);
      g.fillStyle(0x162c1e, 0.7);
      g.fillCircle(10, dy, 3);
      g.fillCircle(ww - 10, dy, 3);
    });

    // Three LED indicator column tracks
    this._leftCols = [];
    for (let col = 0; col < 3; col++) {
      const bx = ww * 0.10 + col * 16;
      const by = H * 0.07;
      const bh = H * 0.64;
      // Track bg
      g.fillStyle(0x040c0a, 1);
      g.fillRect(bx - 1, by - 1, 12, bh + 2);
      g.lineStyle(1, 0x0c1810, 0.45);
      g.strokeRect(bx - 1, by - 1, 12, bh + 2);
      this._leftCols.push({ bx, by, bh, phase: col * 0.9 + 0.3, color: 0x00cc88 });
    }

    // Mini readout panels
    this._drawPanel(g, ww * 0.48, H * 0.11, ww * 0.46, 68, 0x00aa66);
    this._drawPanel(g, ww * 0.07, H * 0.52, ww * 0.84, 46, 0x0088aa);

    // Bar meters
    this._drawBarMeters(g, ww * 0.07, H * 0.26, ww * 0.84, 5, 0x00cc88);

    // Shelf lines
    divs.forEach(dy => {
      g.lineStyle(2, 0x101e14, 0.7);
      g.lineBetween(ww * 0.04, dy, ww * 0.96, dy);
    });
  }

  _drawRightWing(W, H) {
    const g = this._rightGfx;
    const ww = W * 0.19;
    const x0 = W - ww;

    g.fillStyle(0x030a0d, 0.97);
    g.fillRect(x0, 0, ww, H);

    g.lineStyle(4, 0x091610, 1);
    g.lineBetween(x0, 0, x0, H);
    g.lineStyle(1, 0x152c1e, 0.45);
    g.lineBetween(x0 + 3, 0, x0 + 3, H);

    const divs = [H * 0.23, H * 0.47, H * 0.70];
    divs.forEach(dy => {
      g.lineStyle(1, 0x0a1810, 0.55);
      g.lineBetween(x0 + 6, dy, W - 6, dy);
      g.fillStyle(0x162c1e, 0.7);
      g.fillCircle(x0 + 10, dy, 3);
      g.fillCircle(W - 10, dy, 3);
    });

    this._rightCols = [];
    for (let col = 0; col < 3; col++) {
      const bx = x0 + ww * 0.62 + col * 16;
      const by = H * 0.07;
      const bh = H * 0.64;
      g.fillStyle(0x040c0a, 1);
      g.fillRect(bx - 1, by - 1, 12, bh + 2);
      g.lineStyle(1, 0x0c1810, 0.45);
      g.strokeRect(bx - 1, by - 1, 12, bh + 2);
      this._rightCols.push({ bx, by, bh, phase: col * 1.1 + 1.0, color: 0x00ddcc });
    }

    this._drawPanel(g, x0 + ww * 0.07, H * 0.11, ww * 0.46, 68, 0x00cc88);
    this._drawPanel(g, x0 + ww * 0.06, H * 0.52, ww * 0.84, 46, 0x00aaff);
    this._drawBarMeters(g, x0 + ww * 0.09, H * 0.26, ww * 0.84, 5, 0x00ffcc);

    divs.forEach(dy => {
      g.lineStyle(2, 0x101e14, 0.7);
      g.lineBetween(x0 + ww * 0.04, dy, x0 + ww * 0.96, dy);
    });
  }

  _drawPanel(g, x, y, w, h, color) {
    g.fillStyle(0x020507, 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(1, color, 0.2);
    g.strokeRect(x, y, w, h);

    // Waveform data
    const pts = Math.max(4, Math.floor(w / 10));
    for (let i = 0; i < pts - 1; i++) {
      const xA = x + i * (w / pts) + 2;
      const xB = x + (i + 1) * (w / pts) + 2;
      const yA = y + h * 0.25 + ((i * 19 + 7) % (h * 0.55));
      const yB = y + h * 0.25 + (((i + 1) * 19 + 7) % (h * 0.55));
      g.lineStyle(1, color, 0.32);
      g.lineBetween(xA, yA, xB, yB);
    }
    // CRT scanlines
    for (let sy = y + 2; sy < y + h - 1; sy += 4) {
      g.lineStyle(1, 0x000000, 0.14);
      g.lineBetween(x + 1, sy, x + w - 1, sy);
    }
  }

  _drawBarMeters(g, x, startY, w, count, color) {
    for (let i = 0; i < count; i++) {
      const y = startY + i * 17;
      const fill = 0.25 + ((i * 37 + 13) % 63) / 100;
      g.fillStyle(0x040a08, 1);
      g.fillRect(x, y, w, 7);
      g.lineStyle(1, 0x0a1810, 0.4);
      g.strokeRect(x, y, w, 7);
      g.fillStyle(color, 0.55);
      g.fillRect(x, y, w * fill, 7);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLES
  // ─────────────────────────────────────────────────────────────────

  _buildBottles(W, H) {
    const ww = W * 0.19;

    this._bottleSpecs = [
      // LEFT SIDE — three bottles on shelves
      { x: ww * 0.56, y: H * 0.23, color: 0x00ff88, glowCol: 0x00ffaa, bh: 88,  bw: 20, fill: 0.74 },
      { x: ww * 0.82, y: H * 0.47, color: 0xc9a227, glowCol: 0xffcc44, bh: 66,  bw: 17, fill: 0.62 },
      { x: ww * 0.32, y: H * 0.70, color: 0x0088ff, glowCol: 0x44aaff, bh: 80,  bw: 19, fill: 0.78 },
      // RIGHT SIDE — large teal container + two smaller
      { x: W - ww * 0.48, y: H * 0.23, color: 0x00ff44, glowCol: 0x44ff88, bh: 130, bw: 38, fill: 0.84, large: true },
      { x: W - ww * 0.72, y: H * 0.47, color: 0xff6600, glowCol: 0xff8822, bh: 60,  bw: 16, fill: 0.66 },
      { x: W - ww * 0.28, y: H * 0.70, color: 0x9944ff, glowCol: 0xaa66ff, bh: 70,  bw: 18, fill: 0.60 },
    ];

    const g = this._bottleGfx;
    this._bottleSpecs.forEach(spec => this._drawBottleShape(g, spec));
  }

  _drawBottleShape(g, { x, y, color, bh, bw, fill, large }) {
    const neckW = bw * 0.38;
    const neckH = large ? 22 : 13;

    // Cork / stopper
    g.fillStyle(0x1a1600, 1);
    g.fillRect(x - neckW * 0.85, y - bh - neckH - 5, neckW * 1.7, 5);

    // Neck
    g.fillStyle(0x0c1612, 1);
    g.fillRect(x - neckW, y - bh - neckH, neckW * 2, neckH + 2);
    g.lineStyle(1, 0x182818, 0.5);
    g.strokeRect(x - neckW, y - bh - neckH, neckW * 2, neckH + 2);

    // Body glass
    g.fillStyle(0x08100e, 0.94);
    g.fillRoundedRect(x - bw / 2, y - bh, bw, bh, { tl: 3, tr: 3, bl: 8, br: 8 });

    // Liquid
    const lh = bh * fill;
    g.fillStyle(color, 0.88);
    g.fillRoundedRect(x - bw / 2 + 2, y - lh, bw - 4, lh - 2, { tl: 2, tr: 2, bl: 6, br: 6 });

    // Meniscus line
    g.lineStyle(1.5, color, 0.55);
    g.lineBetween(x - bw / 2 + 3, y - lh, x + bw / 2 - 3, y - lh);

    // Specular highlight
    g.fillStyle(0xffffff, 0.06);
    g.fillRoundedRect(x - bw / 2 + 3, y - bh + 10, bw * 0.22, bh * 0.5, 2);

    // Outer glass edge
    g.lineStyle(1.5, 0x182818, 0.7);
    g.strokeRoundedRect(x - bw / 2, y - bh, bw, bh, { tl: 3, tr: 3, bl: 8, br: 8 });

    // Large container label stripe
    if (large) {
      g.fillStyle(0x040e08, 0.8);
      g.fillRect(x - bw / 2 + 2, y - bh * 0.53, bw - 4, bh * 0.13);
      g.lineStyle(1, color, 0.18);
      g.strokeRect(x - bw / 2 + 2, y - bh * 0.53, bw - 4, bh * 0.13);
    }

    // Base
    g.fillStyle(0x0a1410, 1);
    g.fillRect(x - bw / 2 - 2, y - 3, bw + 4, 4);
  }

  // ─────────────────────────────────────────────────────────────────
  // CANDLE BODIES
  // ─────────────────────────────────────────────────────────────────

  _buildCandleBodies(W, H) {
    const ww = W * 0.19;

    this._candleSpecs = [
      { x: ww * 0.13,       y: H * 0.32 },
      { x: ww * 0.57,       y: H * 0.53 },
      { x: ww * 0.84,       y: H * 0.73 },
      { x: W - ww * 0.10,   y: H * 0.37 },
      { x: W - ww * 0.55,   y: H * 0.57 },
      { x: W - ww * 0.82,   y: H * 0.74 },
    ];

    const g = this._candleGfx;
    this._candleSpecs.forEach(({ x, y }, i) => {
      const phaseOffset = i * 1.3;  // stored for flicker math
      this._candleSpecs[i].phase = phaseOffset;

      // Dish holder
      g.fillStyle(0x201808, 1);
      g.fillRect(x - 11, y + 2, 22, 6);
      g.lineStyle(1, 0x352c12, 0.55);
      g.strokeRect(x - 11, y + 2, 22, 6);

      // Wax body
      g.fillStyle(0x3c3618, 1);
      g.fillRect(x - 5, y - 22, 10, 24);
      // Wax shadow side
      g.fillStyle(0x2e2912, 0.5);
      g.fillRect(x - 4, y - 20, 4, 16);
      // Wax drip
      g.fillStyle(0x3c3618, 0.75);
      g.fillRect(x + 3, y - 8, 3, 10);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // PARTICLES
  // ─────────────────────────────────────────────────────────────────

  _buildParticles(W, H) {
    // ── Candle flames ─────────────────────────────────────────────
    this._candleSpecs.forEach(({ x, y }) => {
      const flameY = y - 24;

      // Outer orange flame
      this.add.particles(x, flameY, 'labPt', {
        speed: { min: 8, max: 30 },
        angle: { min: 267, max: 273 },
        scale: { start: 0.3, end: 0 },
        alpha: { start: 0.88, end: 0 },
        lifespan: { min: 220, max: 460 },
        frequency: 26,
        quantity: 1,
        tint: [0xff5500, 0xff7722, 0xff8833],
        gravityY: -92,
      });

      // Inner yellow core
      this.add.particles(x, flameY, 'labPt', {
        speed: { min: 4, max: 14 },
        angle: { min: 268, max: 272 },
        scale: { start: 0.15, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 160, max: 320 },
        frequency: 32,
        quantity: 1,
        tint: [0xffee44, 0xffcc22],
        gravityY: -115,
      });

      // Rare sparks
      this.add.particles(x, flameY, 'labPt', {
        speed: { min: 18, max: 50 },
        angle: { min: 248, max: 292 },
        scale: { start: 0.09, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 350, max: 850 },
        frequency: 1500,
        quantity: 1,
        tint: 0xffdd00,
        gravityY: 38,
      });
    });

    // ── Bottle bubbles ────────────────────────────────────────────
    this._bottleSpecs.forEach(({ x, y, color, bh }) => {
      this.add.particles(x, y - bh * 0.28, 'labPt', {
        speed: { min: 3, max: 14 },
        angle: 270,
        scale: { start: 0.07, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: { min: 900, max: 2200 },
        frequency: 520,
        quantity: 1,
        tint: color,
        gravityY: -18,
      });
    });

    // ── Floating golden dust (whole scene) ───────────────────────
    this.add.particles(W / 2, H / 2, 'labPt', {
      speed: { min: 1, max: 5 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.05, end: 0 },
      alpha: { start: 0.2, end: 0 },
      lifespan: { min: 4000, max: 9000 },
      frequency: 110,
      quantity: 1,
      tint: [0xc9a227, 0xaa8820, 0xddcc44],
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(0, 0, W, H),
      },
    });

    // ── Teal arcane sparks orbiting the portal ────────────────────
    const cx = W * 0.5;
    const cy = H * 0.05;
    this.add.particles(cx, cy, 'labPt', {
      speed: { min: 5, max: 20 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.12, end: 0 },
      alpha: { start: 0.55, end: 0 },
      lifespan: { min: 1200, max: 2800 },
      frequency: 190,
      quantity: 1,
      tint: [0x00ffcc, 0x00ddaa, 0x44ffdd],
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Ellipse(cx, cy, 370, 80),
        quantity: 1,
      },
    });

    // ── Floor mist ────────────────────────────────────────────────
    this.add.particles(W / 2, H, 'labPt', {
      speed: { min: 4, max: 18 },
      angle: { min: 178, max: 192 },
      scale: { start: 2.0, end: 5.0 },
      alpha: { start: 0.035, end: 0 },
      lifespan: { min: 6000, max: 12000 },
      frequency: 380,
      quantity: 1,
      tint: 0x001c08,
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(0, H * 0.83, W, H * 0.17),
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // VIGNETTE  (drawn last, over everything)
  // ─────────────────────────────────────────────────────────────────

  _drawVignette(W, H) {
    const g = this._vigGfx;

    // Top band
    for (let y = 0; y < H * 0.17; y += 2) {
      g.fillStyle(0x000000, (1 - y / (H * 0.17)) * 0.76);
      g.fillRect(0, y, W, 2);
    }
    // Bottom band
    for (let y = H * 0.79; y < H; y += 2) {
      g.fillStyle(0x000000, ((y - H * 0.79) / (H * 0.21)) * 0.84);
      g.fillRect(0, y, W, 2);
    }
    // Left edge
    for (let x = 0; x < W * 0.09; x += 2) {
      g.fillStyle(0x000000, (1 - x / (W * 0.09)) * 0.52);
      g.fillRect(x, 0, 2, H);
    }
    // Right edge
    for (let x = W * 0.91; x < W; x += 2) {
      g.fillStyle(0x000000, ((x - W * 0.91) / (W * 0.09)) * 0.52);
      g.fillRect(x, 0, 2, H);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // UPDATE  — all animation is f(time), no tweens
  // ─────────────────────────────────────────────────────────────────

  update(time) {
    const t = time * 0.001;  // seconds

    // 1. Slow portal rotation (2 RPM = 30s/revolution)
    this._archRotGfx.setRotation(t * (Math.PI * 2 / 30));

    // 2. Bottle glows + candle halos
    this._updateGlows(t);

    // 3. LED indicator columns
    this._updateLEDs(t);
  }

  _updateGlows(t) {
    const g = this._glowGfx;
    g.clear();

    // ── Bottle glows ───────────────────────────────────────────────
    this._bottleSpecs.forEach(({ x, y, glowCol, bh, large }, i) => {
      // Multi-harmonic oscillator for non-repeating feel
      const p = t + i * 0.85;
      const pulse = 0.55 + Math.sin(p * 0.9) * 0.28
                        + Math.sin(p * 1.7 + 0.4) * 0.10
                        + Math.sin(p * 3.1 + 1.1) * 0.04;
      const baseR = large ? 72 : 38;
      const gR = baseR * (0.82 + pulse * 0.32);
      const glowY = y - bh * 0.36;

      for (let r = gR; r > 4; r -= 5) {
        const a = Math.pow(1 - r / gR, 1.4) * 0.20 * pulse;
        g.fillStyle(glowCol, a);
        g.fillCircle(x, glowY, r);
      }
    });

    // ── Candle halos ───────────────────────────────────────────────
    this._candleSpecs.forEach(({ x, y, phase }) => {
      // Three incommensurate frequencies → complex flicker
      const p = t + phase;
      const flicker = 0.5
        + Math.sin(p * 6.3)  * 0.22
        + Math.sin(p * 14.7 + 0.8) * 0.10
        + Math.sin(p * 31.1 + 2.1) * 0.04;
      const cr = 52 * Math.max(0.3, flicker);

      for (let r = cr; r > 4; r -= 7) {
        const a = Math.pow(1 - r / cr, 1.3) * 0.07 * flicker;
        g.fillStyle(0xff7722, a);
        g.fillCircle(x, y - 28, r);
      }
    });
  }

  _updateLEDs(t) {
    const g = this._ledGfx;
    g.clear();

    const NUM_SEGS = 18;
    const SEG_H = 4;

    // Left columns
    this._leftCols.forEach(({ bx, by, bh, phase, color }) => {
      const scroll = t * 1.4 + phase;  // scroll speed
      for (let seg = 0; seg < NUM_SEGS; seg++) {
        const segY = by + seg * (bh / NUM_SEGS) + 2;
        // Sine threshold determines lit/unlit for deterministic pattern
        const val = Math.sin((seg / NUM_SEGS) * Math.PI * 4 + scroll);
        if (val > 0.1) {
          const bright = Math.pow((val - 0.1) / 0.9, 0.6);
          g.fillStyle(color, 0.5 + bright * 0.45);
          g.fillRect(bx + 2, segY, 7, SEG_H);
        }
      }
    });

    // Right columns
    this._rightCols.forEach(({ bx, by, bh, phase, color }) => {
      const scroll = t * 1.2 + phase;
      for (let seg = 0; seg < NUM_SEGS; seg++) {
        const segY = by + seg * (bh / NUM_SEGS) + 2;
        const val = Math.sin((seg / NUM_SEGS) * Math.PI * 6 + scroll);
        if (val > 0.05) {
          const bright = Math.pow((val - 0.05) / 0.95, 0.6);
          g.fillStyle(color, 0.5 + bright * 0.45);
          g.fillRect(bx + 2, segY, 7, SEG_H);
        }
      }
    });
  }
}
