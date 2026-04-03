/**
 * SignalChamberScene.js — Optimized Assembly Map (Restored & Enhanced)
 * ══════════════════════════════════════════════════════════════════════════════
 */

import Phaser from 'phaser';
import { getBytecodeAMP, AMP_CHANNELS, getRotationAtTime } from '../../../lib/ambient/bytecodeAMP';

const REF = { W: 1920, H: 1080 };
const CONSOLE = { x: 960, y: 560, w: 1160, h: 640, cr: 16 };
const PANEL_L = { x: 510, y: 455, w: 260, h: 280 };
const RADAR = { x: 960, y: 515, r: 210 };
const PANEL_R = { x: 1410, y: 455, w: 260, h: 300 };
const GAUGE_L = { x: 510, y: 715, r: 54 };
const GAUGE_R = { x: 1410, y: 715, r: 54 };
const BTN_PLAY = { x: 855,  y: 845, r: 34 };
const VOL_SLD  = { x: 985,  y: 845, w: 230, h: 8 };
const SIG_SLD  = { x: 1410, top: 315, bot: 580, w: 26 };


const PAL = { voidNavy: 0x050816, nearBlack: 0x03040a, consoleBase: 0x060810, panelFace: 0x030508, teal: 0x00cfc8, brass: 0xb4912f, dimGold: 0xd5b34b, amber: 0xd47a1c };

export class SignalChamberScene extends Phaser.Scene {
  constructor() { super({ key: 'SignalChamberScene' }); }

  init() {
    this._sig = 0; this._vol = 0.5; this._colHex = '#d5b34b'; this._col = PAL.dimGold;
    this._schoolId = null; this._isTuning = false; this._isPlaying = false; this._status = 'STANDBY';
    this._stationName = 'NO SIGNAL'; this._stations = []; this._logs = []; this._scanAngle = 0;
    this._transAlpha = 1; this._inTransition = false; this._pingRings = []; this._lastPingMs = 0;
    this._schoolChanged = false; this._transitionAlpha = 1; this._voidStars = null; this._sprites = {};
    this._gaugeL_cur = 0; this._gaugeR_cur = 0.5; this._gaugeL_prev = -1; this._gaugeR_prev = -1;
    this._needsVolSliderRedraw = true; this._needsSignalSliderRedraw = true;
    this._isCreated = false; this._sx = 1; this._sy = 1; this._ms = 1;
    this._bpm = 90; // Default BPM for rotation sync

    // Interaction Callbacks
    this.onPlayPause = null;
    this.onVolumeChange = null;
    this.onStationSelect = null;
    this.onOrbClick = null;
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this._sx = W / REF.W; this._sy = H / REF.H; this._ms = Math.min(this._sx, this._sy);
    this.scene.settings.zIndex = 100; // Higher than background (0) and static overlay (1)
    this._rtBg = this.add.renderTexture(0, 0, W, H).setDepth(0);
    this._rtScan = this.add.renderTexture(0, 0, W, H).setDepth(80);
    this._bakeBackground(W, H); this._bakeScanlines(W, H);

    const l = (d) => this.add.graphics().setDepth(d);
    this._consOuter = l(20); this._consInner = l(21); this._consSurf = l(22); this._consGlow = l(23);
    this._panelL = l(30); this._panelR = l(31); this._sigSldTrk = l(32); this._sigSldFill = l(33); this._sigSldThumb = l(34);
    this._rdBg = l(40); this._rdGrid = l(41); this._rdPattern = l(42); this._rdGeo = l(41); this._rdWave = l(43);
    this._rdScan = l(44); this._rdRing = l(45); this._rdGlass = l(46); this._rdFx = l(47); this._rdPings = l(48);
    this._gauLFace = l(50); this._gauLNeedle = l(51); this._gauRFace = l(52); this._gauRNeedle = l(53);
    this._btnBg = l(61); this._btnIcon = l(62); this._volTrk = l(63); this._volFill = l(64); this._fxGlow = l(81);

    this._drawConsoleShell(); this._drawPanelLeft(); this._drawPanelRight();
    this._drawRadarStatic(); this._drawGaugeFaces(); this._drawControlStrip();
    this._applyRadarMask(); this._bakeRadarTextures(); this._setupPersistentRadarSprites();

    this._programs = {
      SONIC: this._drawSonic.bind(this), PSYCHIC: this._drawPsychic.bind(this),
      VOID: this._drawVoid.bind(this), WILL: this._drawWill.bind(this), ALCHEMY: this._drawAlchemy.bind(this),
    };
    this._genericProgram = this._drawGeneric.bind(this);

    const rcx = RADAR.x * this._sx, rcy = RADAR.y * this._sy, rr = RADAR.r * this._ms;
    this._voidStars = Array.from({ length: 75 }, (_, i) => ({
      x: rcx + Math.sin(i * 137.508) * rr * 0.9, y: rcy + Math.cos(i * 137.508 * 1.618) * rr * 0.9,
      size: (Math.sin(i * 29.3) * 0.5 + 0.5) * 1.4 + 0.2, phase: i * 0.7, speed: (Math.sin(i * 11.7) * 0.5 + 0.5) * 0.0015 + 0.0005,
    }));

    this._buildTextLayer(); this._wireInput(); this._redrawPlayButton(); this._redrawVolSlider(); this._redrawSignalSlider();
    if (this.cameras.main.postFX) this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 0.8, 1.1);
    this._isCreated = true;
  }

  _bakeBackground(W, H) {
    const g = this.add.graphics();
    g.fillGradientStyle(PAL.nearBlack, PAL.nearBlack, PAL.voidNavy, PAL.voidNavy, 1);
    g.fillRect(0, 0, W, H);
    g.lineStyle(1, PAL.brass, 0.035);
    for (let x = 0; x < W; x += 64 * this._sx) g.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 64 * this._sy) g.lineBetween(0, y, W, y);
    this._rtBg.draw(g, 0, 0); g.destroy();
  }

  _bakeScanlines(W, H) {
    const g = this.add.graphics();
    const lineStep = 4 * this._sy;
    for (let y = 0; y < H; y += lineStep * 2) { g.lineStyle(lineStep, 0x000000, 0.06); g.lineBetween(0, y, W, y); }
    this._rtScan.draw(g, 0, 0); g.destroy();
  }

  _drawConsoleShell() {
    const sx = this._sx, sy = this._sy, cx = CONSOLE.x * sx, cy = CONSOLE.y * sy, cw = CONSOLE.w * sx, ch = CONSOLE.h * sy, cr = CONSOLE.cr * sx;
    this._consInner.fillStyle(PAL.consoleBase, 1); this._consInner.fillRoundedRect(cx - cw / 2 + 8 * sx, cy - ch / 2 + 8 * sy, cw - 16 * sx, ch - 16 * sy, cr * 0.7);
    this._consSurf.lineStyle(10, 0x000000, 0.55); this._consSurf.strokeRoundedRect(cx - cw / 2 + 8 * sx, cy - ch / 2 + 8 * sy, cw - 16 * sx, ch - 16 * sy, cr * 0.7);
    this._consOuter.lineStyle(2, PAL.brass, 0.22); this._consOuter.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, cr);
  }

  _drawPanelLeft() {
    const sx = this._sx, sy = this._sy, lx = PANEL_L.x * sx, ly = PANEL_L.y * sy, lw = PANEL_L.w * sx, lh = PANEL_L.h * sy;
    this._panelL.fillStyle(PAL.panelFace, 1); this._panelL.fillRoundedRect(lx - lw / 2, ly - lh / 2, lw, lh, 4 * sx);
    this._panelL.lineStyle(1.5, PAL.brass, 0.18); this._panelL.strokeRoundedRect(lx - lw / 2, ly - lh / 2, lw, lh, 4 * sx);
  }

  _drawPanelRight() {
    const sx = this._sx, sy = this._sy, rx = PANEL_R.x * sx, ry = PANEL_R.y * sy, rw = PANEL_R.w * sx, rh = PANEL_R.h * sy;
    this._panelR.fillStyle(PAL.panelFace, 1); this._panelR.fillRoundedRect(rx - rw / 2, ry - rh / 2, rw, rh, 4 * sx);
    this._panelR.lineStyle(1.5, PAL.brass, 0.18); this._panelR.strokeRoundedRect(rx - rw / 2, ry - rh / 2, rw, rh, 4 * sx);
  }

  _drawRadarStatic() {
    const sx = this._sx, sy = this._sy, ms = this._ms, cx = RADAR.x * sx, cy = RADAR.y * sy, r = RADAR.r * ms;
    this._radarCX = cx; this._radarCY = cy; this._radarR = r;
    this._rdRing.lineStyle(18 * ms, 0x151820, 1); this._rdRing.strokeCircle(cx, cy, r + 9 * ms);
    this._rdBg.fillStyle(0x020407, 1); this._rdBg.fillCircle(cx, cy, r);
    this._rdGrid.lineStyle(1, 0xd5b34b, 0.09); for (let i = 1; i <= 4; i++) this._rdGrid.strokeCircle(cx, cy, (r / 4) * i);
  }

  _applyRadarMask() {
    const cx = this._radarCX, cy = this._radarCY, r = this._radarR;
    const maskGfx = this.make.graphics({ add: false });
    maskGfx.fillStyle(0xffffff); maskGfx.fillCircle(cx, cy, r);
    const mask = maskGfx.createGeometryMask();
    [this._rdPattern, this._rdGeo, this._rdWave, this._rdScan].forEach(g => g.setMask(mask));
  }

  _bakeRadarTextures() {
    if (this.textures.exists('radar_sacred_hex')) return;
    const r = RADAR.r * this._ms, size = r * 2;
    const bake = (key, drawFn) => {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      drawFn(g, r, r, size); g.generateTexture(key, size, size); g.destroy();
    };
    bake('radar_sacred_hex', (g, cx, cy) => {
      g.lineStyle(2, 0xffffff, 1); g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2, px = cx + Math.cos(a) * (r * 0.85), py = cy + Math.sin(a) * (r * 0.85);
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokePath();
    });
    bake('radar_sacred_star', (g, cx, cy) => {
      g.lineStyle(3, 0xffffff, 1);
      for (let tri = 0; tri < 2; tri++) {
        const rot = tri * Math.PI; g.beginPath();
        for (let i = 0; i <= 3; i++) {
          const a = (i / 3) * Math.PI * 2 + rot, px = cx + Math.cos(a) * (r * 0.62), py = cy + Math.sin(a) * (r * 0.62);
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.strokePath();
      }
    });
    bake('radar_flower_of_life', (g, cx, cy) => {
      g.lineStyle(1.5, 0xffffff, 1); const orbitR = r * 0.38;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2; g.strokeCircle(cx + Math.cos(a) * orbitR, cy + Math.sin(a) * orbitR, orbitR);
      }
      g.strokeCircle(cx, cy, orbitR);
    });
    bake('radar_metatron', (g, cx, cy) => {
      g.lineStyle(1, 0xffffff, 1);
      for (let h = 0; h < 3; h++) {
        const hexR = r * (0.85 - h * 0.25); g.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * Math.PI * 2, px = cx + Math.cos(a) * hexR, py = cy + Math.sin(a) * hexR;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.strokePath();
      }
    });
    bake('radar_specular_glint', (g, cx, cy) => {
      g.fillStyle(0xffffff, 0.4); g.fillEllipse(cx - r * 0.35, cy - r * 0.35, r * 0.25, r * 0.15);
      g.fillStyle(0xffffff, 0.15); g.fillEllipse(cx + r * 0.2, cy + r * 0.2, r * 0.4, r * 0.3);
    });
  }

  _setupPersistentRadarSprites() {
    const cx = this._radarCX, cy = this._radarCY;
    this._sprites.hex1 = this.add.sprite(cx, cy, 'radar_sacred_hex').setAlpha(0).setDepth(41).setBlendMode('SCREEN');
    this._sprites.hex2 = this.add.sprite(cx, cy, 'radar_sacred_hex').setAlpha(0).setDepth(41).setScale(0.7).setBlendMode('SCREEN');
    this._sprites.star = this.add.sprite(cx, cy, 'radar_sacred_star').setAlpha(0).setDepth(41).setBlendMode('SCREEN');
    this._sprites.flower = this.add.sprite(cx, cy, 'radar_flower_of_life').setAlpha(0).setDepth(41).setScale(1.2).setBlendMode('SCREEN');
    this._sprites.metatron = this.add.sprite(cx, cy, 'radar_metatron').setAlpha(0).setDepth(41).setBlendMode('SCREEN');
    this._sprites.glint = this.add.sprite(cx, cy, 'radar_specular_glint').setAlpha(0).setDepth(46).setBlendMode('ADD');
  }

  _drawSonic(g, cx, cy, r, t, sig, col) {
    const amp = (14 + sig * 38) * this._ms; g.lineStyle(1.5, col, 0.45 + sig * 0.35); g.beginPath();
    const startX = cx - r * 0.84;
    const endX = cx + r * 0.84;
    const range = endX - startX;
    for (let x = startX; x <= endX; x += 4) {
      const nx = (x - startX) / range;
      const w = Math.sin(nx * Math.PI * 7 + t * 0.0028) * amp;
      if (x === startX) g.moveTo(x, cy + w); else g.lineTo(x, cy + w);
    }
    g.strokePath();
  }

  _drawPsychic(g, cx, cy, r, t, sig, col) {
    g.lineStyle(1, col, 0.25 + sig * 0.2);
    for (let arm = 0; arm < 3; arm++) {
      const off = (arm / 3) * Math.PI * 2; g.beginPath();
      for (let p = 0; p < 48; p++) {
        const th = (p / 48) * Math.PI * 3.2 + off + t * 0.0004, sr = (p / 48) * r * 0.82;
        const px = cx + Math.cos(th) * sr, py = cy + Math.sin(th) * sr;
        if (p === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokePath();
    }
  }

  _drawVoid(g, cx, cy, _r, t, sig, _col) {
    for (const s of this._voidStars) {
      const tw = 0.25 + Math.sin(t * s.speed * 1000 + s.phase) * 0.35;
      g.fillStyle(0xffffff, tw * (0.35 + sig * 0.35)); g.fillCircle(s.x, s.y, s.size * this._ms);
    }
  }

  _drawWill(g, cx, cy, r, t, sig, col) {
    g.lineStyle(1.5, col, 0.25 + sig * 0.45);
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + t * 0.00015; g.lineBetween(cx, cy, cx + Math.cos(ang) * r * 0.8, cy + Math.sin(ang) * r * 0.8);
    }
  }

  _drawAlchemy(g, cx, cy, r, _t, sig, col) { g.lineStyle(1.5, col, 0.3 + sig * 0.2); g.strokeCircle(cx, cy, r * 0.66); }
  _drawGeneric(g, cx, cy, r, _t, sig, col) { g.lineStyle(1.5, col, 0.35 + sig * 0.45); g.strokeCircle(cx, cy, r * 0.5); }
  _drawSacredGeometry(_g, _cx, _cy, _r, _t, _sig, _col) {}

  _drawGaugeFaces() {
    const col = this._col || PAL.dimGold;
    this._drawGaugeFace(this._gauLFace, GAUGE_L.x, GAUGE_L.y, GAUGE_L.r, col);
    this._drawGaugeFace(this._gauRFace, GAUGE_R.x, GAUGE_R.y, GAUGE_R.r, col);
  }

  _drawGaugeFace(gfx, cx_ref, cy_ref, r_ref, _col) {
    const ms = this._ms, cx = cx_ref * this._sx, cy = cy_ref * this._sy, r = r_ref * ms;
    gfx.fillStyle(0x080808, 1); gfx.fillCircle(cx, cy, r);
    gfx.lineStyle(2.5, 0x1c1c1c, 1); gfx.strokeCircle(cx, cy, r);
  }

  _drawControlStrip() {
    const sx = this._sx, sy = this._sy, ms = this._ms, bx = BTN_PLAY.x * sx, by = BTN_PLAY.y * sy, br = BTN_PLAY.r * ms;
    this._btnBg.fillStyle(0x080a0c, 1); this._btnBg.fillCircle(bx, by, br);
    this._volTrk.fillStyle(0x030608, 1); this._volTrk.fillRoundedRect(VOL_SLD.x * sx - (VOL_SLD.w * sx)/2, VOL_SLD.y * sy - (VOL_SLD.h * sy)/2, VOL_SLD.w * sx, VOL_SLD.h * sy, (VOL_SLD.h * sy)/2);
  }

  _buildTextLayer() {
    const sx = this._sx, sy = this._sy;
    this._txtStaName = this.add.text(PANEL_L.x * sx - (PANEL_L.w * sx)/2 + 14 * sx, PANEL_L.y * sy - (PANEL_L.h * sy)/2 + 50 * sy, 'NO SIGNAL', { fontFamily: 'monospace', fontSize: '13px', color: '#00ffcc' }).setDepth(72);
  }

  _wireInput() {
    const sx = this._sx, sy = this._sy, ms = this._ms, bx = BTN_PLAY.x * sx, by = BTN_PLAY.y * sy, br = BTN_PLAY.r * ms;
    const playZone = this.add.zone(bx, by, br * 2, br * 2).setInteractive({ useHandCursor: true }).setDepth(133);
    playZone.on('pointerdown', () => this.onPlayPause?.());
    const radarZone = this.add.zone(RADAR.x * sx, RADAR.y * sy, RADAR.r * 2 * ms, RADAR.r * 2 * ms).setCircle(RADAR.r * ms).setInteractive({ useHandCursor: true }).setDepth(133);
    radarZone.on('pointerdown', () => this.onOrbClick?.());
  }

  _redrawPlayButton() {
    const sx = this._sx, sy = this._sy, ms = this._ms, bx = BTN_PLAY.x * sx, by = BTN_PLAY.y * sy, br = BTN_PLAY.r * ms, col = this._col || PAL.dimGold;
    this._btnBg.clear(); this._btnBg.fillStyle(0x080a0c, 1); this._btnBg.fillCircle(bx, by, br); this._btnBg.lineStyle(2, col, this._isPlaying ? 0.85 : 0.38); this._btnBg.strokeCircle(bx, by, br);
    this._btnIcon.clear(); this._btnIcon.fillStyle(col, 0.9);
    if (this._isPlaying) { this._btnIcon.fillRect(bx - 8 * ms, by - 11 * ms, 6 * ms, 22 * ms); this._btnIcon.fillRect(bx + 2 * ms, by - 11 * ms, 6 * ms, 22 * ms); }
    else { this._btnIcon.fillTriangle(bx - 6 * ms, by - 11 * ms, bx + 10 * ms, by, bx - 6 * ms, by + 11 * ms); }
  }

  _redrawVolSlider() {
    const sx = this._sx, sy = this._sy, _ms = this._ms, cx = VOL_SLD.x * sx, cy = VOL_SLD.y * sy, w = VOL_SLD.w * sx, h = VOL_SLD.h * sy;
    this._volFill.clear(); this._volFill.fillStyle(PAL.dimGold, 0.55); this._volFill.fillRoundedRect(cx - w/2, cy - h/2, w * this._vol, h, h/2);
  }

  _redrawSignalSlider() {
    const sx = this._sx, sy = this._sy, ms = this._ms, x = SIG_SLD.x * sx, top = SIG_SLD.top * sy, bot = SIG_SLD.bot * sy, w = SIG_SLD.w * sx;
    this._sigSldFill.clear(); this._sigSldFill.fillStyle(this._col || PAL.teal, 0.55); this._sigSldFill.fillRoundedRect(x - w/2 + 4 * ms, bot - (bot - top) * this._sig, w - 8 * ms, (bot - top) * this._sig, 8 * ms);
  }

  _redrawGaugeNeedle(needleGfx, cx_ref, cy_ref, r_ref, value, col) {
    const ms = this._ms, cx = cx_ref * this._sx, cy = cy_ref * this._sy, r = r_ref * ms, angle = -135 + value * 270, rad = Phaser.Math.DegToRad(angle - 90);
    needleGfx.clear(); needleGfx.lineStyle(2 * ms, col, 0.9); needleGfx.lineBetween(cx, cy, cx + Math.cos(rad) * (r - 10 * ms), cy + Math.sin(rad) * (r - 10 * ms));
  }

  updateState(data) {
    if (!this._isCreated) return;
    if (data.schoolId !== undefined && data.schoolId !== this._schoolId) { 
      this._schoolChanged = true; 
      this._lastSwitchTime = performance.now();
      this._schoolId = data.schoolId; 
    }
    if (data.signalLevel !== undefined) { this._sig = data.signalLevel; this._needsSignalSliderRedraw = true; }
    if (data.volume !== undefined) { this._vol = data.volume; this._needsVolSliderRedraw = true; }
    if (data.bpm !== undefined) { this._bpm = data.bpm; }
    if (data.isPlaying !== undefined && data.isPlaying !== this._isPlaying) { this._isPlaying = data.isPlaying; this._redrawPlayButton(); }
    if (data.schoolColor !== undefined && data.schoolColor !== this._colHex) { this._colHex = data.schoolColor; this._col = this._hexToInt(data.schoolColor); this._drawGaugeFaces(); }
    if (data.stationName !== undefined) this._txtStaName?.setText(data.stationName);
    
    // Store AMP motion data
    if (data.orbMotion) this._orbMotion = data.orbMotion;
    if (data.consoleMotion) this._consoleMotion = data.consoleMotion;
  }

  update(time, _delta) {
    if (!this._isCreated) return;
    
    // Use AMP motion if available, fallback to legacy bytecode
    const flicker = getBytecodeAMP(time, AMP_CHANNELS.FLICKER);
    const glow = this._orbMotion?.glow !== undefined ? this._orbMotion.glow : getBytecodeAMP(time, AMP_CHANNELS.GLOW);
    const scale = this._orbMotion?.scale !== undefined ? this._orbMotion.scale : 1.0;
    
    const cx = this._radarCX, cy = this._radarCY, r = this._radarR, col = this._col, sig = this._sig, _ms = this._ms, bpm = this._bpm;
    
    // Absolute time transition
    let ta = 1;
    if (this._schoolChanged) {
      const elapsed = performance.now() - (this._lastSwitchTime || 0);
      ta = Math.min(1, elapsed / 350); 
      if (ta >= 1) this._schoolChanged = false;
    }
    
    // Modulate standby alpha with AMP glow
    const standbyAlpha = (this._isPlaying ? 0.6 : 0.25) * Math.max(0.1, glow) * ta;
    
    // Apply AMP scale to radar elements
    const currentR = r * scale;
    
    // BPM-synced clock-like rotation: smooth, continuous, no wobble
    this._sprites.hex1.setAlpha(standbyAlpha).setRotation(getRotationAtTime(time, bpm, 90)).setTint(col).setScale(scale);
    this._sprites.hex2.setAlpha(standbyAlpha * 0.7).setRotation(getRotationAtTime(time, bpm, -45)).setTint(col).setScale(0.7 * scale);
    this._sprites.star.setAlpha(standbyAlpha * 1.4).setRotation(getRotationAtTime(time, bpm, -180)).setTint(col).setScale(scale);
    this._sprites.flower.setAlpha(standbyAlpha * 0.6).setRotation(getRotationAtTime(time, bpm, 45)).setTint(col).setScale(1.2 * scale);
    this._sprites.metatron.setAlpha(standbyAlpha * 0.8).setRotation(getRotationAtTime(time, bpm, -90)).setTint(col).setScale(scale);
    this._sprites.glint.setAlpha((0.15 + sig * 0.2) * ta * (0.8 + flicker * 0.2)).setRotation(getRotationAtTime(time, bpm, 22.5)).setScale(scale);
    
    this._rdPattern.clear(); 
    this._rdPattern.setAlpha(ta); 
    (this._programs[this._schoolId] || this._genericProgram)(this._rdPattern, cx, cy, currentR, time, sig, col);
    
    // Console glow driven by consoleMotion
    const consoleGlow = this._consoleMotion?.glow !== undefined ? this._consoleMotion.glow : (0.035 + sig * 0.1);
    const consoleOpacity = this._consoleMotion?.opacity !== undefined ? this._consoleMotion.opacity : 1.0;
    
    this._consGlow.clear(); 
    const gA = consoleGlow * ta * (0.9 + flicker * 0.1);
    this._consGlow.setAlpha(consoleOpacity);
    this._consGlow.lineStyle(22, col, gA * 0.4).strokeRoundedRect(CONSOLE.x * this._sx - (CONSOLE.w * this._sx)/2, CONSOLE.y * this._sy - (CONSOLE.h * this._sy)/2, CONSOLE.w * this._sx, CONSOLE.h * this._sx, CONSOLE.cr * this._sx);
    
    // Gauges: simple time-damped pursuit (Pseudo-simulation, but time-aware)
    // We update cur values to prev for redraw check
    const pursuit = 0.15; // fixed pursuit speed per frame (idealized 60fps)
    const newL = this._gaugeL_cur + (sig - this._gaugeL_cur) * pursuit;
    const newR = this._gaugeR_cur + (this._vol - this._gaugeR_cur) * pursuit;

    if (Math.abs(newL - this._gaugeL_prev) > 0.002) { this._redrawGaugeNeedle(this._gauLNeedle, GAUGE_L.x, GAUGE_L.y, GAUGE_L.r, newL, col); this._gaugeL_prev = newL; }
    if (Math.abs(newR - this._gaugeR_prev) > 0.002) { this._redrawGaugeNeedle(this._gauRNeedle, GAUGE_R.x, GAUGE_R.y, GAUGE_R.r, newR, col); this._gaugeR_prev = newR; }
    this._gaugeL_cur = newL; this._gaugeR_cur = newR;
    if (this._needsSignalSliderRedraw) { this._redrawSignalSlider(); this._needsSignalSliderRedraw = false; }
    if (this._needsVolSliderRedraw) { this._redrawVolSlider(); this._needsVolSliderRedraw = false; }
  }

  _hexToInt(hex) { try { return Phaser.Display.Color.HexStringToColor(hex.startsWith('#') ? hex : '#' + hex).color; } catch { return PAL.dimGold; } }
}
