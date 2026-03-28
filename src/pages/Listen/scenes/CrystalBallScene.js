import Phaser from 'phaser';

/**
 * CrystalBallScene.js — Optimized per-school procedural art for the Arcane Orb.
 * 
 * Performance Optimizations:
 * 1. Caches hex-to-int color conversions.
 * 2. Static elements (sphere base, grid) only redraw on color change.
 * 3. Batches lineStyle calls in render loops.
 * 4. Throttles text and color updates.
 */
export class CrystalBallScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CrystalBallScene' });
  }

  init() {
    this.signalLevel = 0;
    this.schoolColor = '#c9a227';
    this._cachedCol = 0xc9a227;
    this.glyph = '*';
    this.isTuning = false;
    this.schoolId = null;
    this._transitionAlpha = 1;
    this._schoolChanged = false;
    this._voidStars = null;
    this._needsBgRedraw = true;
  }

  _hexToInt(hex) {
    try {
      const clean = hex.startsWith('#') ? hex : '#' + hex;
      return Phaser.Display.Color.HexStringToColor(clean).color;
    } catch {
      return 0xc9a227;
    }
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.44;

    // Generate particle textures
    if (!this.textures.exists('mote')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(6, 6, 6);
      g.generateTexture('mote', 12, 12);
      g.destroy();
    }

    // Rendering layers (back to front)
    this.bgLayer     = this.add.graphics(); // sphere base
    this.patternLayer = this.add.graphics(); // school-specific art
    this.fxLayer     = this.add.graphics(); // aura + rim
    this.noiseLayer  = this.add.graphics(); // tuning noise

    // Center glyph
    this.glyphText = this.add.text(cx, cy, this.glyph, {
      fontSize: '72px',
      fontFamily: '"Cormorant Garamond", serif',
      color: this.schoolColor,
    }).setOrigin(0.5).setAlpha(0.4);

    // Particles
    this.particles = this.add.particles(cx, cy, 'mote', {
      speed: { min: 6, max: 22 },
      scale: { start: 0.1, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 2800,
      blendMode: 'ADD',
      frequency: 130,
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, r * 0.72) },
    });

    // Geometry mask — clips all layers to circle
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillCircle(cx, cy, r);
    const mask = maskShape.createGeometryMask();

    this.bgLayer.setMask(mask);
    this.patternLayer.setMask(mask);
    this.glyphText.setMask(mask);
    this.particles.setMask(mask);
    this.noiseLayer.setMask(mask);

    // Initialize void stars deterministically
    this._voidStars = Array.from({ length: 75 }, (_, i) => ({
      x: cx + Math.sin(i * 137.508) * r * 0.9,
      y: cy + Math.cos(i * 137.508 * 1.618) * r * 0.9,
      size: (Math.sin(i * 29.3) * 0.5 + 0.5) * 1.4 + 0.2,
      phase: i * 0.7,
      speed: (Math.sin(i * 11.7) * 0.5 + 0.5) * 0.0015 + 0.0005,
    }));

    this._drawStaticBg(cx, cy, r);

    // Cache program map
    this._programs = {
      SONIC: this._drawSonic.bind(this),
      PSYCHIC: this._drawPsychic.bind(this),
      VOID: this._drawVoid.bind(this),
      WILL: this._drawWill.bind(this),
      ALCHEMY: this._drawAlchemy.bind(this),
    };
    this._genericProgram = this._drawGeneric.bind(this);
  }

  _drawStaticBg(cx, cy, r) {
    this.bgLayer.clear();
    this.bgLayer.fillStyle(0x04030c, 0.9);
    this.bgLayer.fillCircle(cx, cy, r);
    // Inner depth gradient rings
    for (let i = 3; i >= 1; i--) {
      this.bgLayer.fillStyle(0x000000, 0.12 * i);
      this.bgLayer.fillCircle(cx + r * 0.05, cy + r * 0.05, r * (0.95 - i * 0.05));
    }
    // Glass highlight
    this.bgLayer.fillStyle(0xffffff, 0.045);
    this.bgLayer.fillCircle(cx - r * 0.28, cy - r * 0.28, r * 0.2);
    this.bgLayer.fillStyle(0xffffff, 0.018);
    this.bgLayer.fillCircle(cx - r * 0.32, cy - r * 0.32, r * 0.35);
  }

  updateState(data) {
    if (data.schoolId !== undefined && data.schoolId !== this.schoolId) {
      this._schoolChanged = true;
      this._transitionAlpha = 0;
      this.schoolId = data.schoolId;
    }
    if (data.signalLevel !== undefined) this.signalLevel = data.signalLevel;
    if (data.schoolColor !== undefined && data.schoolColor !== this.schoolColor) {
      this.schoolColor = data.schoolColor;
      this._cachedCol = this._hexToInt(this.schoolColor);
      this._needsBgRedraw = true;
    }
    if (data.glyph !== undefined && data.glyph !== this.glyph) {
      this.glyph = data.glyph;
      this.glyphText.setText(this.glyph);
    }
    if (data.isTuning !== undefined) this.isTuning = data.isTuning;
  }

  // ── SONIC ───────────────────────────────────────────────────────────────────
  _drawSonic(g, cx, cy, r, t, sig, col) {
    // Expanding sound rings
    const ringSig = 0.12 + sig * 0.38;
    for (let i = 0; i < 8; i++) {
      const phase = ((t * 0.0007 + i * 0.125) % 1);
      const ringR = r * 0.08 + r * 0.88 * phase;
      g.lineStyle(1.5, col, (1 - phase) * ringSig);
      g.strokeCircle(cx, cy, ringR);
    }

    // Sine waveform across center
    const amp = 14 + sig * 38;
    g.lineStyle(1.5, col, 0.45 + sig * 0.35);
    g.beginPath();
    const startX = cx - r * 0.84;
    const endX = cx + r * 0.84;
    const width = endX - startX;
    for (let x = startX; x <= endX; x += 4) { // Reduced resolution for performance
      const nx = (x - startX) / width;
      const w1 = Math.sin(nx * Math.PI * 7 + t * 0.0028) * amp;
      const w2 = Math.sin(nx * Math.PI * 13 + t * 0.0017) * (amp * 0.35);
      const y = cy + w1 + w2;
      if (x <= startX) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();

    // Circular EQ bars
    const bars = 48; // Reduced count
    const baseR = r * 0.42;
    const barAlpha = 0.3 + sig * 0.5;
    g.lineStyle(1.5, col, barAlpha);
    for (let i = 0; i < bars; i++) {
      const ang = (i / bars) * Math.PI * 2 + t * 0.0004;
      const noise = Math.sin(t * 0.0022 + i * 0.58) * 0.45 + Math.cos(t * 0.0014 + i * 0.87) * 0.28;
      const mag = (sig * 0.65 + Math.max(0, noise) * 0.35) * r * 0.38;
      g.lineBetween(
        cx + Math.cos(ang) * baseR, cy + Math.sin(ang) * baseR,
        cx + Math.cos(ang) * (baseR + mag), cy + Math.sin(ang) * (baseR + mag)
      );
    }
  }

  // ── PSYCHIC ─────────────────────────────────────────────────────────────────
  _drawPsychic(g, cx, cy, r, t, sig, col) {
    // Spiral arms
    const spiralAlpha = 0.25 + sig * 0.2;
    for (let arm = 0; arm < 3; arm++) {
      const offset = (arm / 3) * Math.PI * 2;
      g.lineStyle(1, col, spiralAlpha);
      g.beginPath();
      for (let p = 0; p < 48; p++) { // Reduced resolution
        const theta = (p / 48) * Math.PI * 3.2 + offset + t * 0.0004;
        const sr = (p / 48) * r * 0.82;
        const px = cx + Math.cos(theta) * sr;
        const py = cy + Math.sin(theta) * sr;
        if (p === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }

    // Neural nodes + connections
    const nodeCount = 8; // Reduced count
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const ang = (i / nodeCount) * Math.PI * 2 + t * 0.00025;
      const nr = r * (0.32 + Math.sin(t * 0.0007 + i * 0.9) * 0.08);
      nodes.push({ x: cx + Math.cos(ang) * nr, y: cy + Math.sin(ang) * nr });
    }
    
    g.lineStyle(0.8, col, 0.18 + sig * 0.28);
    for (let i = 0; i < nodeCount; i++) {
      const a = nodes[i], b = nodes[(i + 3) % nodeCount];
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    
    const nodeAlpha = 0.55 + sig * 0.35;
    const nodeR = 2.5 + sig * 1.5;
    for (const n of nodes) {
      g.fillStyle(col, nodeAlpha);
      g.fillCircle(n.x, n.y, nodeR);
    }

    // Eye iris
    const irisBaseAlpha = 0.4 + sig * 0.6;
    for (let i = 1; i <= 4; i++) { // Reduced rings
      g.lineStyle(i === 1 ? 2 : 1, col, (0.5 - i * 0.1) * irisBaseAlpha);
      g.strokeCircle(cx, cy, r * 0.075 * i * (1 + sig * 0.08));
    }
    g.fillStyle(0x000000, 0.85);
    g.fillCircle(cx, cy, r * 0.055);
    g.fillStyle(col, 0.4 + sig * 0.5);
    g.fillCircle(cx, cy, r * 0.022);
  }

  // ── VOID ────────────────────────────────────────────────────────────────────
  _drawVoid(g, cx, cy, r, t, sig, col) {
    // Starfield
    const starAlpha = 0.35 + sig * 0.35;
    for (const s of this._voidStars) {
      const twinkle = 0.25 + Math.sin(t * s.speed * 1000 + s.phase) * 0.35;
      g.fillStyle(0xffffff, twinkle * starAlpha);
      g.fillCircle(s.x, s.y, s.size);
    }

    // Gravity-well rings (contracting inward)
    const ringAlphaBase = 0.28 * (0.5 + sig * 0.5);
    for (let i = 0; i < 6; i++) {
      const progress = ((t * 0.00025 + i / 6) % 1);
      const ringR = r * 0.92 * (1 - progress);
      g.lineStyle(1, col, progress * ringAlphaBase);
      g.strokeCircle(cx, cy, ringR);
    }

    // Void tendrils spiraling inward
    const tendrilAlpha = 0.25 + sig * 0.4;
    g.lineStyle(1, col, tendrilAlpha);
    for (let i = 0; i < 6; i++) {
      const baseAng = (i / 6) * Math.PI * 2 + t * 0.00018;
      g.beginPath();
      for (let s = 0; s <= 10; s++) { // Reduced segments
        const tr = r * 0.9 - s * r * 0.08;
        const wobble = Math.sin(t * 0.0018 + i * 1.2 + s * 0.4) * 0.22;
        const ang = baseAng + wobble + s * 0.08;
        const px = cx + Math.cos(ang) * tr;
        const py = cy + Math.sin(ang) * tr;
        if (s === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }

    // Singularity
    g.fillStyle(0x000000, 0.95);
    g.fillCircle(cx, cy, r * 0.11 + sig * r * 0.04);
    g.lineStyle(2, col, 0.7 + sig * 0.25);
    g.strokeCircle(cx, cy, r * 0.12 + sig * r * 0.04);
  }

  // ── WILL ────────────────────────────────────────────────────────────────────
  _drawWill(g, cx, cy, r, t, sig, col) {
    // Radial force lines
    const lines = 12; // Reduced count
    const mag = r * (0.38 + sig * 0.48);
    g.lineStyle(1.5, col, 0.25 + sig * 0.45);
    for (let i = 0; i < lines; i++) {
      const ang = (i / lines) * Math.PI * 2 + t * 0.00015;
      g.lineBetween(cx, cy, cx + Math.cos(ang) * mag, cy + Math.sin(ang) * mag);
    }

    // Hexagonal crystal lattice
    const hexR = r * 0.17;
    const hexPositions = [[0, 0], [hexR * 2, 0], [-hexR * 2, 0]];
    const hexAlpha = 0.22 + sig * 0.28;
    g.lineStyle(1, col, hexAlpha);
    for (const [hx, hy] of hexPositions) {
      g.beginPath();
      for (let v = 0; v < 7; v++) {
        const va = (v / 6) * Math.PI * 2 + Math.PI / 6;
        const vx = cx + hx + Math.cos(va) * hexR * 0.95;
        const vy = cy + hy + Math.sin(va) * hexR * 0.95;
        if (v === 0) g.moveTo(vx, vy);
        else g.lineTo(vx, vy);
      }
      g.strokePath();
    }

    // Pulse rings
    for (let i = 0; i < 2; i++) { // Reduced count
      const phase = ((t * 0.0009 + i * 0.5) % 1);
      const pR = phase * r * 0.88;
      g.lineStyle(2 + (1 - phase) * 2, col, (1 - phase) * (0.35 + sig * 0.45));
      g.strokeCircle(cx, cy, pR);
    }
  }

  // ── ALCHEMY ─────────────────────────────────────────────────────────────────
  _drawAlchemy(g, cx, cy, r, t, sig, col) {
    const cR = r * 0.66;
    // Outer circles
    g.lineStyle(1.5, col, 0.3 + sig * 0.2);
    g.strokeCircle(cx, cy, cR);
    g.lineStyle(1, col, 0.18 + sig * 0.12);
    g.strokeCircle(cx, cy, cR * 0.79);

    // Rune tick marks
    const tickAlpha = 0.5 + sig * 0.35;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + t * 0.00008;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      g.lineStyle(i % 3 === 0 ? 2 : 1, col, tickAlpha);
      g.lineBetween(cx + cosA * cR, cy + sinA * cR, cx + cosA * (cR + 7), cy + sinA * (cR + 7));
    }

    // Triangles
    g.lineStyle(1, col, 0.25 + sig * 0.22);
    for (let tri = 0; tri < 2; tri++) {
      g.beginPath();
      for (let v = 0; v < 4; v++) {
        const ang = (v / 3) * Math.PI * 2 + (tri * Math.PI / 3) + t * 0.00025;
        const px = cx + Math.cos(ang) * cR * 0.76;
        const py = cy + Math.sin(ang) * cR * 0.76;
        if (v === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }

    // Orbiting nodes
    const nodeAlpha = 0.6 + sig * 0.3;
    const rimAlpha = 0.15 + sig * 0.12;
    for (let i = 0; i < 4; i++) { // Reduced count
      const ang = (i / 4) * Math.PI * 2 + t * 0.00085;
      const nodeR = r * (0.3 + Math.sin(t * 0.0005 + i * 1.05) * 0.04);
      const nx = cx + Math.cos(ang) * nodeR;
      const ny = cy + Math.sin(ang) * nodeR;
      g.lineStyle(0.8, col, 0.18 + sig * 0.22);
      g.lineBetween(cx, cy, nx, ny);
      g.fillStyle(col, nodeAlpha);
      g.fillCircle(nx, ny, 3 + sig * 2.5);
      g.lineStyle(0.5, col, rimAlpha);
      g.strokeCircle(nx, ny, 7 + sig * 5);
    }
  }

  // ── GENERIC ─────────────────────────────────────────────────────────────────
  _drawGeneric(g, cx, cy, r, t, sig, col) {
    const bars = 40; // Reduced count
    const baseR = r * 0.48;
    const barAlpha = 0.35 + sig * 0.45;
    g.lineStyle(1.5, col, barAlpha);
    for (let i = 0; i < bars; i++) {
      const ang = (i / bars) * Math.PI * 2 + t * 0.0003;
      const noise = Math.sin(t * 0.002 + i * 0.6) * 0.4 + Math.cos(t * 0.0015 + i * 0.9) * 0.3;
      const mag = (sig * 0.65 + Math.max(0, noise) * 0.35) * r * 0.38;
      g.lineBetween(
        cx + Math.cos(ang) * baseR, cy + Math.sin(ang) * baseR,
        cx + Math.cos(ang) * (baseR + mag), cy + Math.sin(ang) * (baseR + mag)
      );
    }
  }

  // ── SACRED GEOMETRY (STANDBY) ──────────────────────────────────────────────
  _drawSacredGeometry(g, cx, cy, r, t, sig, col) {
    const weight = Math.max(0, 1 - sig * 4); // Strongest when signal is low
    if (weight <= 0) return;

    const baseAlpha = 0.22 * weight * this._transitionAlpha;
    const rot = t * 0.00025;
    
    // 1. Nested Hexagons (Metatron Fragments)
    for (let h = 0; h < 3; h++) {
      const hexR = r * (0.85 - h * 0.25);
      const hexRot = rot * (h % 2 === 0 ? 1 : -0.8);
      g.lineStyle(1, col, baseAlpha * (1 - h * 0.2));
      
      g.beginPath();
      const points = [];
      for (let i = 0; i <= 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + hexRot;
        const px = cx + Math.cos(angle) * hexR;
        const py = cy + Math.sin(angle) * hexR;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
        if (i < 6) points.push({x: px, y: py});
      }
      g.strokePath();

      // Connect opposite vertices for even hexagons
      if (h === 0) {
        g.lineStyle(0.5, col, baseAlpha * 0.5);
        for (let i = 0; i < 3; i++) {
          g.lineBetween(points[i].x, points[i].y, points[i+3].x, points[i+3].y);
        }
      }
    }

    // 2. The Star of Scholomance (Double Triangles)
    for (let tri = 0; tri < 2; tri++) {
      const triRot = rot * -1.2 + (tri * Math.PI);
      const triR = r * 0.62;
      g.lineStyle(1.5, col, baseAlpha * 1.4);
      g.beginPath();
      for (let i = 0; i <= 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + triRot;
        const px = cx + Math.cos(angle) * triR;
        const py = cy + Math.sin(angle) * triR;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }

    // 3. Flower of Life pulse
    const orbitCount = 6;
    const orbitR = r * 0.38;
    const pulse = Math.sin(t * 0.001) * 0.05;
    for (let i = 0; i < orbitCount; i++) {
      const angle = (i / orbitCount) * Math.PI * 2 + rot * 0.6;
      const ox = cx + Math.cos(angle) * orbitR;
      const oy = cy + Math.sin(angle) * orbitR;
      g.lineStyle(1, col, baseAlpha * 0.7);
      g.strokeCircle(ox, oy, r * (0.38 + pulse));
    }
  }

  // ── UPDATE LOOP ─────────────────────────────────────────────────────────────
  update(time, delta) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.44;
    const col = this._cachedCol;

    // School transition
    if (this._schoolChanged) {
      this._transitionAlpha = Math.min(1, this._transitionAlpha + delta * 0.0035);
      if (this._transitionAlpha >= 1) this._schoolChanged = false;
    }

    // 1. Sphere base redraw only when needed
    if (this._needsBgRedraw) {
      this._drawStaticBg(cx, cy, r);
      this._needsBgRedraw = false;
    }

    // 2. Rendering Layers
    this.patternLayer.clear();
    
    // Always draw sacred geometry (Standby layer)
    this._drawSacredGeometry(this.patternLayer, cx, cy, r, time, this.signalLevel, col);

    // Draw school-specific pattern (Active layer)
    this.patternLayer.setAlpha(this._transitionAlpha);
    
    const drawFn = this._programs[this.schoolId] || this._genericProgram;
    drawFn(this.patternLayer, cx, cy, r, time, this.signalLevel, col);

    // 3. Outer aura rings
    this.fxLayer.clear();
    const glow = 0.12 + this.signalLevel * 0.58;
    for (let i = 0; i < 6; i++) { // Reduced rings
      this.fxLayer.lineStyle(3.5, col, (glow * (6 - i)) / 6);
      this.fxLayer.strokeCircle(cx, cy, r + i * 4);
    }
    this.fxLayer.lineStyle(2, col, 0.45 + this.signalLevel * 0.45);
    this.fxLayer.strokeCircle(cx, cy, r - 1);

    // 4. Glyph (Throttled update)
    const glyphPulse = 1 + this.signalLevel * 0.11;
    this.glyphText.setScale(glyphPulse);
    this.glyphText.setAlpha(0.2 + this.signalLevel * 0.55);

    // 5. Particles (Signal-reactive)
    if (this.particles && typeof this.particles.setParticleColor === 'function') {
      this.particles.setParticleColor(col);
      
      const pFreq = this.signalLevel > 0.05 ? 130 : 80; // More motes when quiet/paused
      
      if (this.particles.frequency !== pFreq) {
        this.particles.frequency = pFreq;
      }
    }

    // 6. Tuning noise
    this.noiseLayer.clear();
    if (this.isTuning) {
      this.noiseLayer.fillStyle(0xffffff, 0.05);
      for (let i = 0; i < 30; i++) { // Reduced count
        const nx = cx + (Math.random() - 0.5) * r * 2;
        const ny = cy + (Math.random() - 0.5) * r * 2;
        this.noiseLayer.fillRect(nx, ny, Math.random() * 5 + 1, Math.random() * 2 + 1);
      }
    }
  }
}
