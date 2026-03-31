import Phaser from 'phaser';
import { getBytecodeAMP, AMP_CHANNELS } from '../../../lib/ambient/bytecodeAMP';
import { getRotationAtTime } from '../../../../codex/core/pixelbrain/gear-glide-amp.js';

/**
 * CrystalBallScene.js — GPU-Accelerated Procedural Art for the Arcane Orb.
 */
export class CrystalBallScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CrystalBallScene' });
    this._sprites = {};
    this._isCreated = false;
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
    this._bpm = 90; // Default BPM for rotation sync
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2, r = Math.min(width, height) * 0.44;
    this._bakeUniversalTextures(r);
    this.bgLayer      = this.add.graphics().setDepth(0); 
    this.patternLayer = this.add.container(cx, cy).setDepth(10); 
    this.waveLayer    = this.add.graphics().setDepth(20);        
    this.fxLayer      = this.add.graphics().setDepth(30);        
    this.noiseLayer   = this.add.graphics().setDepth(40);        
    this._setupPersistentSprites(r);
    this.glyphText = this.add.text(cx, cy, this.glyph, { fontSize: '72px', fontFamily: '"Cormorant Garamond", serif', color: this.schoolColor }).setOrigin(0.5).setAlpha(0.4).setDepth(25);
    const maskShape = this.make.graphics({ add: false }); maskShape.fillStyle(0xffffff); maskShape.fillCircle(cx, cy, r); const mask = maskShape.createGeometryMask();
    this.bgLayer.setMask(mask); this.patternLayer.setMask(mask); this.waveLayer.setMask(mask); this.glyphText.setMask(mask); this.noiseLayer.setMask(mask);
    this._drawStaticBg(cx, cy, r);
    if (this.cameras.main.postFX) this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 0.9, 1.2);
    this._isCreated = true;
  }

  _bakeUniversalTextures(r) {
    if (this.textures.exists('orb_mote')) return;
    const bake = (key, size, drawFn) => { const g = this.make.graphics({ x: 0, y: 0, add: false }); drawFn(g, size/2, size/2, size); g.generateTexture(key, size, size); g.destroy(); };
    bake('orb_mote', 16, (g, cx, cy) => { g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, cx); });
    bake('orb_sacred_hex', r * 2, (g, cx, cy) => { g.lineStyle(2, 0xffffff, 1); g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2, px = cx + Math.cos(a) * (cx * 0.85), py = cy + Math.sin(a) * (cy * 0.85); if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.strokePath(); });
    bake('orb_sacred_star', r * 2, (g, cx, cy) => { g.lineStyle(3, 0xffffff, 1); for (let tri = 0; tri < 2; tri++) { const rot = tri * Math.PI; g.beginPath(); for (let i = 0; i <= 3; i++) { const a = (i / 3) * Math.PI * 2 + rot, px = cx + Math.cos(a) * (cx * 0.62), py = cy + Math.sin(a) * (cy * 0.62); if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.strokePath(); } });
    bake('orb_flower_of_life', r * 2, (g, cx, cy) => { g.lineStyle(1.5, 0xffffff, 1); const orbitR = cx * 0.38; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.strokeCircle(cx + Math.cos(a) * orbitR, cy + Math.sin(a) * orbitR, orbitR); } g.strokeCircle(cx, cy, orbitR); });
    bake('orb_metatron', r * 2, (g, cx, cy) => { g.lineStyle(1, 0xffffff, 1); for (let h = 0; h < 3; h++) { const hexR = cx * (0.85 - h * 0.25); g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2, px = cx + Math.cos(a) * hexR, py = cy + Math.sin(a) * hexR; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.strokePath(); } });
    bake('orb_specular_glint', r * 2, (g, cx, cy) => { g.fillStyle(0xffffff, 0.4); g.fillEllipse(cx - r * 0.35, cy - r * 0.35, r * 0.25, r * 0.15); g.fillStyle(0xffffff, 0.15); g.fillEllipse(cx + r * 0.2, cy + r * 0.2, r * 0.4, r * 0.3); });
  }

  _setupPersistentSprites(r) {
    this._sprites.hex1 = this.add.sprite(0, 0, 'orb_sacred_hex').setAlpha(0);
    this._sprites.hex2 = this.add.sprite(0, 0, 'orb_sacred_hex').setAlpha(0).setScale(0.7);
    this._sprites.star = this.add.sprite(0, 0, 'orb_sacred_star').setAlpha(0);
    this._sprites.flower = this.add.sprite(0, 0, 'orb_flower_of_life').setAlpha(0).setScale(1.2);
    this._sprites.metatron = this.add.sprite(0, 0, 'orb_metatron').setAlpha(0);
    this._sprites.glint = this.add.sprite(0, 0, 'orb_specular_glint').setAlpha(0).setBlendMode('ADD');
    this.patternLayer.add([this._sprites.hex1, this._sprites.hex2, this._sprites.star, this._sprites.flower, this._sprites.metatron, this._sprites.glint]);
  }

  _drawStaticBg(cx, cy, r) {
    this.bgLayer.clear(); this.bgLayer.fillStyle(0x04030c, 0.95); this.bgLayer.fillCircle(cx, cy, r);
    for (let i = 3; i >= 1; i--) { this.bgLayer.fillStyle(0x000000, 0.15 * i); this.bgLayer.fillCircle(cx + r * 0.05, cy + r * 0.05, r * (0.95 - i * 0.05)); }
    this.bgLayer.fillStyle(0xffffff, 0.05); this.bgLayer.fillCircle(cx - r * 0.28, cy - r * 0.28, r * 0.2);
  }

  updateState(data) {
    if (!this._isCreated) return;
    if (data.schoolId !== undefined && data.schoolId !== this.schoolId) { this._schoolChanged = true; this._transitionAlpha = 0; this.schoolId = data.schoolId; }
    if (data.signalLevel !== undefined) this.signalLevel = data.signalLevel;
    if (data.bpm !== undefined) this._bpm = data.bpm;
    if (data.schoolColor !== undefined && data.schoolColor !== this.schoolColor) { this.schoolColor = data.schoolColor; this._cachedCol = Phaser.Display.Color.HexStringToColor(this.schoolColor).color; this._needsBgRedraw = true; }
    if (data.glyph !== undefined && data.glyph !== this.glyph) { this.glyph = data.glyph; this.glyphText.setText(this.glyph); }
    if (data.isTuning !== undefined) this.isTuning = data.isTuning;
  }

  update(time, delta) {
    if (!this._isCreated) return;
    const flicker = getBytecodeAMP(time, AMP_CHANNELS.FLICKER), glow = getBytecodeAMP(time, AMP_CHANNELS.GLOW);
    const { width, height } = this.scale; const cx = width / 2, cy = height / 2, r = Math.min(width, height) * 0.44, col = this._cachedCol, sig = this.signalLevel, bpm = this._bpm;
    if (this._schoolChanged) { this._transitionAlpha = Math.min(1, this._transitionAlpha + delta * 0.0035); if (this._transitionAlpha >= 1) this._schoolChanged = false; }
    const ta = this._transitionAlpha;
    const standbyAlpha = 0.25 * Math.max(0, 1 - sig * 4) * ta * glow;
    // BPM-synced clock-like rotation: smooth, continuous, no wobble
    this._sprites.hex1.setAlpha(standbyAlpha).setRotation(getRotationAtTime(time, bpm, 90)).setTint(col);
    this._sprites.hex2.setAlpha(standbyAlpha * 0.7).setRotation(getRotationAtTime(time, bpm, -45)).setTint(col);
    this._sprites.star.setAlpha(standbyAlpha * 1.4).setRotation(getRotationAtTime(time, bpm, -180)).setTint(col);
    this._sprites.flower.setAlpha(standbyAlpha * 0.6).setRotation(getRotationAtTime(time, bpm, 45)).setTint(col);
    this._sprites.metatron.setAlpha(standbyAlpha * 0.8).setRotation(getRotationAtTime(time, bpm, -90)).setTint(col);
    this._sprites.glint.setAlpha((0.15 + sig * 0.2) * ta * (0.8 + flicker * 0.2)).setRotation(getRotationAtTime(time, bpm, 22.5));
    this.waveLayer.clear(); if (this.schoolId === 'SONIC' || !this.schoolId) this._drawSonicWaves(this.waveLayer, cx, cy, r, time, sig, col, ta * glow);
    this.fxLayer.clear(); const fxGlow = (0.15 + sig * 0.6) * (0.9 + flicker * 0.1); this.fxLayer.lineStyle(4, col, fxGlow * ta); this.fxLayer.strokeCircle(cx, cy, r + 2);
    this.noiseLayer.clear(); if (this.isTuning) { this.noiseLayer.fillStyle(0xffffff, 0.08 * flicker); for (let i = 0; i < 20; i++) { const nx = cx + (Math.random() - 0.5) * r * 1.8, ny = cy + (Math.random() - 0.5) * r * 1.8; this.noiseLayer.fillRect(nx, ny, Math.random() * 8 + 2, 1); } }
    this.glyphText.setAlpha((0.25 + sig * 0.5) * glow).setScale(1 + sig * 0.1);
  }

  _drawSonicWaves(g, cx, cy, r, t, sig, col, ta) {
    const amp = (10 + sig * 40); g.lineStyle(2, col, (0.4 + sig * 0.6) * ta); g.beginPath();
    const startX = cx - r * 0.85, endX = cx + r * 0.85, width = endX - startX;
    for (let x = startX; x <= endX; x += 6) {
      const nx = (x - startX) / width; const w = Math.sin(nx * Math.PI * 6 + t * 0.003) * amp * Math.sin(nx * Math.PI);
      if (x === startX) g.moveTo(x, cy + w); else g.lineTo(x, cy + w);
    }
    g.strokePath();
  }
}
