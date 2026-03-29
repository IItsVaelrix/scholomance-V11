import Phaser from 'phaser';

/**
 * ThaumaturgyRadarScene.js — Advanced ritual visualization for the Signal Chamber.
 * Replaces CrystalBallScene with a design inspired by sonic radar consoles.
 */
export class ThaumaturgyRadarScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ThaumaturgyRadarScene' });
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
    this._scanAngle = 0;
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
    const r = Math.min(width, height) * 0.46;

    // Layers
    this.bgLayer      = this.add.graphics();
    this.gridLayer    = this.add.graphics();
    this.geometryLayer = this.add.graphics();
    this.waveformLayer = this.add.graphics();
    this.scanLayer     = this.add.graphics();
    this.fxLayer       = this.add.graphics();

    // Center glyph (smaller and more technical)
    this.glyphText = this.add.text(cx, cy, this.glyph, {
      fontSize: '32px',
      fontFamily: '"Cinzel", serif',
      color: this.schoolColor,
    }).setOrigin(0.5).setAlpha(0.3);

    // Mask
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillCircle(cx, cy, r);
    const mask = maskShape.createGeometryMask();

    [this.bgLayer, this.gridLayer, this.geometryLayer, this.waveformLayer, this.scanLayer].forEach(l => l.setMask(mask));

    this._drawStaticElements(cx, cy, r);
  }

  _drawStaticElements(cx, cy, r) {
    this.bgLayer.clear();
    // Deep radar well
    this.bgLayer.fillStyle(0x05080a, 1);
    this.bgLayer.fillCircle(cx, cy, r);
    
    // Outer metallic rim
    this.bgLayer.lineStyle(4, 0x1a1a1a, 1);
    this.bgLayer.strokeCircle(cx, cy, r);
    this.bgLayer.lineStyle(1, 0x333333, 0.5);
    this.bgLayer.strokeCircle(cx, cy, r - 4);

    // Radar coordinate ticks
    this.gridLayer.clear();
    this.gridLayer.lineStyle(1, 0xc9a227, 0.15);
    for (let i = 0; i < 360; i += 10) {
      const rad = Phaser.Math.DegToRad(i - 90);
      const isMajor = i % 30 === 0;
      const len = isMajor ? 12 : 6;
      this.gridLayer.lineBetween(
        cx + Math.cos(rad) * (r - len), cy + Math.sin(rad) * (r - len),
        cx + Math.cos(rad) * r, cy + Math.sin(rad) * r
      );
    }

    // Concentric depth rings
    for (let i = 1; i <= 4; i++) {
      this.gridLayer.strokeCircle(cx, cy, (r / 4) * i);
    }
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
    }
    if (data.glyph !== undefined && data.glyph !== this.glyph) {
      this.glyph = data.glyph;
      this.glyphText.setText(this.glyph);
    }
    if (data.isTuning !== undefined) this.isTuning = data.isTuning;
  }

  update(time, delta) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.46;
    const col = this._cachedCol;
    const sig = this.signalLevel;

    if (this._schoolChanged) {
      this._transitionAlpha = Math.min(1, this._transitionAlpha + delta * 0.002);
      if (this._transitionAlpha >= 1) this._schoolChanged = false;
    }

    // 1. Radar Scan Sweep
    this.scanLayer.clear();
    this._scanAngle = (this._scanAngle + delta * 0.08) % 360;
    const scanRad = Phaser.Math.DegToRad(this._scanAngle - 90);
    
    // Gradient scan line (simulated with multiple lines)
    for (let i = 0; i < 20; i++) {
      const alpha = (1 - i / 20) * 0.4;
      const ang = scanRad - (i * 0.01);
      this.scanLayer.lineStyle(2, col, alpha);
      this.scanLayer.lineBetween(cx, cy, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    }

    // 2. Geometry (Hexagram)
    this.geometryLayer.clear();
    const geoAlpha = (0.1 + sig * 0.4) * this._transitionAlpha;
    const rot = time * 0.0002;
    
    for (let tri = 0; tri < 2; tri++) {
      const triRot = rot * (tri === 0 ? 1 : -1) + (tri * Math.PI);
      const triR = r * (0.6 + Math.sin(time * 0.001) * 0.02);
      this.geometryLayer.lineStyle(1.5, col, geoAlpha);
      this.geometryLayer.beginPath();
      for (let i = 0; i <= 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + triRot;
        const px = cx + Math.cos(angle) * triR;
        const py = cy + Math.sin(angle) * triR;
        if (i === 0) this.geometryLayer.moveTo(px, py);
        else this.geometryLayer.lineTo(px, py);
      }
      this.geometryLayer.strokePath();
    }

    // 3. Central Horizontal Waveform
    this.waveformLayer.clear();
    const amp = 10 + sig * 60;
    const waveAlpha = 0.4 + sig * 0.6;
    this.waveformLayer.lineStyle(2, col, waveAlpha);
    this.waveformLayer.beginPath();
    const startX = cx - r * 0.9;
    const endX = cx + r * 0.9;
    for (let x = startX; x <= endX; x += 2) {
      const nx = (x - startX) / (endX - startX);
      const w1 = Math.sin(nx * Math.PI * 4 + time * 0.005) * amp;
      const w2 = Math.sin(nx * Math.PI * 12 + time * 0.008) * (amp * 0.2);
      // Taper at edges
      const taper = Math.sin(nx * Math.PI);
      const y = cy + (w1 + w2) * taper;
      if (x === startX) this.waveformLayer.moveTo(x, y);
      else this.waveformLayer.lineTo(x, y);
    }
    this.waveformLayer.strokePath();

    // 4. Outer FX (Glow & Pulse)
    this.fxLayer.clear();
    const glow = 0.1 + sig * 0.5;
    this.fxLayer.lineStyle(6, col, glow * 0.3);
    this.fxLayer.strokeCircle(cx, cy, r + 2);
    this.fxLayer.lineStyle(1, 0xffffff, glow * 0.2);
    this.fxLayer.strokeCircle(cx, cy, r + 1);

    this.glyphText.setAlpha(0.1 + sig * 0.4);
    this.glyphText.setScale(1 + sig * 0.1);
  }
}
