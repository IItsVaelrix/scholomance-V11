/**
 * SignalChamberScene.js — Optimized Assembly Map
 * ══════════════════════════════════════════════════════════════════════════════
 * Reference canvas : 1920 × 1080
 * Scale mode       : FIT
 *
 * FIXES vs. original:
 *   - _applyRadarMask() now called in create() — geo/wave/scan were unmasked
 *   - Vial hover uses dedicated hoverGfx per vial (no infinite border accumulation)
 *
 * PERFORMANCE vs. original:
 *   - Background cluster baked into _rtBg RenderTexture on create()
 *     (atmos / grid / sigil / vignette / columns / candles → zero runtime draws)
 *   - Scanlines baked into _rtScan RenderTexture on create()
 *   - Gauge needle redraws gated by 0.004 epsilon dirty check
 *   - Waveform draw skipped entirely when sig < 0.01
 *   - Waveform step 6 → 8 px (fewer points, imperceptible quality delta)
 *
 * POLISH vs. original:
 *   - Console edge glow upgraded to 3-layer concentric for softer falloff
 *   - Gauge needle redraws forced on school-color transition
 *
 * LAYER ORDER (depth — unchanged):
 *   0     _rtBg            baked background + columns
 *   20–22 consoleLayer     outer frame, inner surface, detail
 *   23    _consGlow        dynamic edge glow
 *   30–34 panelLayer       panel frames, signal slider
 *   40–48 radarLayer       disc, grid, geo, wave, scan, ring, glass, fx, pings
 *   50–53 gaugeLayer       faces + needles
 *   55–59 vialLayer        vials + hover overlays
 *   60–64 controlLayer     plate, button, slider
 *   69–72 textLayer        divider + live text
 *   80    _rtScan          baked scanline veil
 *   81    _fxGlow          ambient bloom
 *  130+   interactionLayer zones
 */

import Phaser from 'phaser';

// ── Reference-canvas layout constants (1920 × 1080) ──────────────────────────

const REF      = { W: 1920, H: 1080 };
const CONSOLE  = { x: 960,  y: 560, w: 1160, h: 640, cr: 16 };
// const COL_L    = { x: 110,  y: 540, w: 280,  h: 860 }; // Reserved for future column layout
// const COL_R    = { x: 1810, y: 540, w: 280,  h: 860 }; // Reserved for future column layout
const PANEL_L  = { x: 510,  y: 455, w: 260,  h: 280 };
const RADAR    = { x: 960,  y: 515, r: 210 };
const PANEL_R  = { x: 1410, y: 455, w: 260,  h: 300 };
const GAUGE_L  = { x: 510,  y: 715, r: 54 };
const GAUGE_R  = { x: 1410, y: 715, r: 54 };
const BTN_PLAY = { x: 855,  y: 845, r: 34 };
const VOL_SLD  = { x: 985,  y: 845, w: 230, h: 8 };
const TITLE    = { x: 960,  y: 192 };
const SIG_SLD  = { x: 1410, top: 315, bot: 580, w: 26 };

// ── Core palette (hex int) ────────────────────────────────────────────────────

const PAL = {
  voidNavy:    0x050816,
  nearBlack:   0x03040a,
  consoleBase: 0x060810,
  panelFace:   0x030508,
  teal:        0x00cfc8,
  deepCyan:    0x0a7f86,
  brass:       0xb4912f,
  dimGold:     0xd5b34b,
  amber:       0xd47a1c,
  symbolGold:  0xd5b34b,
  signalBlue:  0x1e7bff,
  purple:      0x6e38c9,
  termGreen:   0x00ffcc,
};

// ── Scene ────────────────────────────────────────────────────────────────────

export class SignalChamberScene extends Phaser.Scene {

  constructor() {
    super({ key: 'SignalChamberScene' });
  }

  // ── init() ────────────────────────────────────────────────────────────────

  init() {
    this._sig          = 0;
    this._vol          = 0.5;
    this._colHex       = '#d5b34b';
    this._col          = PAL.dimGold;
    this._prevCol      = PAL.dimGold;
    this._schoolId     = null;
    this._isTuning     = false;
    this._isPlaying    = false;
    this._status       = 'STANDBY';
    this._stationName  = 'NO SIGNAL';
    this._stations     = [];
    this._logs         = [];

    this._scanAngle    = 0;
    this._transAlpha   = 1;
    this._inTransition = false;
    this._pingRings    = [];
    this._lastPingMs   = 0;

    this._gaugeL_cur  = 0;
    this._gaugeR_cur  = 0.5;
    this._gaugeL_prev = -1;   // dirty-check sentinels
    this._gaugeR_prev = -1;

    this._needsVolSliderRedraw    = true;
    this._needsSignalSliderRedraw = true;

    this.onPlayPause     = null;
    this.onVolumeChange  = null;
    this.onStationSelect = null;

    this._vialObjects = [];
    this._sx = 1;
    this._sy = 1;
    this._ms = 1;
  }

  // ── preload() — PNG asset hooks ───────────────────────────────────────────

  preload() {
    // this.load.image('bg_chamber_base',   '/assets/ui/signal-chamber/background/bg_chamber_base.png');
    // this.load.image('console_outer_frame', '/assets/ui/signal-chamber/console/console_outer_frame.png');
    // this.load.image('radar_outer_ring',    '/assets/ui/signal-chamber/radar/radar_outer_ring.png');
  }

  // ── create() ──────────────────────────────────────────────────────────────

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this._sx = W / REF.W;
    this._sy = H / REF.H;
    this._ms = Math.min(this._sx, this._sy);

    // Set scene zIndex for proper layering in multi-scene game
    this.scene.settings.zIndex = 10; // Above AlchemicalLabScene (zIndex: 0)

    // ── Baked RenderTextures (zero runtime cost after create) ──
    this._rtBg   = this.add.renderTexture(0, 0, W, H).setDepth(0).setOrigin(0, 0);
    this._rtScan = this.add.renderTexture(0, 0, W, H).setDepth(80).setOrigin(0, 0);
    this._bakeBackground(W, H);
    this._bakeScanlines(W, H);

    // ── Static graphics (drawn once in create, never touched after) ──
    this._consOuter  = this.add.graphics().setDepth(20);
    this._consInner  = this.add.graphics().setDepth(21);
    this._consSurf   = this.add.graphics().setDepth(22);

    this._panelL     = this.add.graphics().setDepth(30);
    this._panelR     = this.add.graphics().setDepth(31);
    this._sigSldTrk  = this.add.graphics().setDepth(32);

    this._rdRing     = this.add.graphics().setDepth(45);
    this._rdBg       = this.add.graphics().setDepth(40);
    this._rdGrid     = this.add.graphics().setDepth(41);
    this._rdGlass    = this.add.graphics().setDepth(46);

    this._gauLFace   = this.add.graphics().setDepth(50);
    this._gauRFace   = this.add.graphics().setDepth(52);

    this._volTrk     = this.add.graphics().setDepth(63);

    // ── Dynamic graphics ──
    this._consGlow    = this.add.graphics().setDepth(23);

    this._rdGeo       = this.add.graphics().setDepth(42);
    this._rdWave      = this.add.graphics().setDepth(43);
    this._rdScan      = this.add.graphics().setDepth(44);
    this._rdFx        = this.add.graphics().setDepth(47);
    this._rdPings     = this.add.graphics().setDepth(48);

    this._sigSldFill  = this.add.graphics().setDepth(33);
    this._sigSldThumb = this.add.graphics().setDepth(34);

    this._gauLNeedle  = this.add.graphics().setDepth(51);
    this._gauRNeedle  = this.add.graphics().setDepth(53);

    this._btnBg       = this.add.graphics().setDepth(61);
    this._btnIcon     = this.add.graphics().setDepth(62);
    this._volFill     = this.add.graphics().setDepth(64);

    this._fxGlow      = this.add.graphics().setDepth(81);

    // ── Static draws ──
    this._drawConsoleShell();
    this._drawPanelLeft();
    this._drawPanelRight();
    this._drawRadarStatic();
    this._drawGaugeFaces();
    this._drawControlStrip();

    // ── Apply radar mask to dynamic elements only ──
    // FIX: was defined but never called in original — geo/wave/scan were unmasked
    this._applyRadarMask();

    // ── Text, vials, input ──
    this._buildTextLayer();
    this._buildVials();
    this._wireInput();

    // ── Initial dynamic pass ──
    this._redrawPlayButton();
    this._redrawVolSlider();
    this._redrawSignalSlider();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BAKE METHODS — write static content into RenderTextures once
  // ══════════════════════════════════════════════════════════════════════════

  _bakeBackground(W, H) {
    const sx = this._sx, sy = this._sy;

    // Temporary graphics — drawn into RT then destroyed
    const g = this.add.graphics();

    // BG-01: Chamber base gradient
    g.fillGradientStyle(PAL.nearBlack, PAL.nearBlack, PAL.voidNavy, PAL.voidNavy, 1);
    g.fillRect(0, 0, W, H);
    this._rtBg.draw(g, 0, 0);
    g.clear();

    // BG-02: Brass grid lattice
    const gStep = 64 * sx;
    g.lineStyle(1, PAL.brass, 0.035);
    for (let x = 0; x < W; x += gStep) g.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += gStep) g.lineBetween(0, y, W, y);
    this._rtBg.draw(g, 0, 0);
    g.clear();

    // BG-03: Ritual sigil ghost
    const sX = 960 * sx, sY = 440 * sy, sR = 540 * sx;
    g.lineStyle(1.5, PAL.teal, 0.045);
    g.strokeCircle(sX, sY, sR);
    g.strokeCircle(sX, sY, sR * 0.72);
    g.strokeCircle(sX, sY, sR * 0.44);
    g.lineStyle(1, PAL.teal, 0.03);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.lineBetween(sX + Math.cos(a) * sR, sY + Math.sin(a) * sR,
                    sX - Math.cos(a) * sR, sY - Math.sin(a) * sR);
    }
    this._rtBg.draw(g, 0, 0);
    g.clear();

    // BG-04: Vignette — darken all four edges
    const vW = 180 * sx, vH = 120 * sy, vA = 0.65;
    g.fillStyle(0x000000, vA);
    g.fillRect(0, 0, W, vH);
    g.fillRect(0, H - vH, W, vH);
    g.fillRect(0, 0, vW, H);
    g.fillRect(W - vW, 0, vW, H);
    this._rtBg.draw(g, 0, 0);

    g.destroy();
  }

  _bakeScanlines(W, H) {
    const g = this.add.graphics();
    const lineStep = 4 * this._sy;
    for (let y = 0; y < H; y += lineStep * 2) {
      g.lineStyle(lineStep, 0x000000, 0.06);
      g.lineBetween(0, y, W, y);
    }
    this._rtScan.draw(g, 0, 0);
    g.destroy();
  }

  // ── Column / candle helpers (draw into a provided graphics object) ─────────

  _drawColumnIntoGfx(gfx, cx_ref, cy_ref, cw_ref, ch_ref, variant) {
    const sx = this._sx, sy = this._sy;
    const cx = cx_ref * sx, cy = cy_ref * sy;
    const cw = cw_ref * sx, ch = ch_ref * sy;
    const x0 = cx - cw / 2, y0 = cy - ch / 2;

    gfx.fillStyle(0x080b0f, 0.85);
    gfx.fillRect(x0, y0, cw, ch);
    gfx.lineStyle(1, PAL.brass, 0.1);
    gfx.strokeRect(x0, y0, cw, ch);

    gfx.lineStyle(2, PAL.teal, 0.18);
    gfx.lineBetween(x0 + 4 * sx, y0 + 6 * sy,      x0 + cw - 4 * sx, y0 + 6 * sy);
    gfx.lineBetween(x0 + 4 * sx, y0 + ch - 6 * sy,  x0 + cw - 4 * sx, y0 + ch - 6 * sy);

    if (variant === 'vials') {
      const vialColors = [0x22ff77, PAL.dimGold, 0x3399ff, PAL.amber, PAL.purple];
      const vW = 16 * sx, vH = 80 * sy;
      const vY = cy - 20 * sy;
      vialColors.forEach((col, i) => {
        const vX = cx + (i - 2) * (vW + 5 * sx);
        gfx.lineStyle(1.5, 0x2a3a4a, 0.7);
        gfx.strokeRoundedRect(vX - vW / 2, vY - vH / 2, vW, vH, vW / 2);
        gfx.fillStyle(col, 0.2);
        gfx.fillRoundedRect(vX - vW / 2 + 2 * sx, vY + vH / 2 - vH * 0.55, vW - 4 * sx, vH * 0.52, vW / 2 - 2);
      });
    } else {
      const numRows = 9;
      for (let i = 0; i < numRows; i++) {
        const rowY = y0 + (ch / (numRows + 1)) * (i + 1);
        gfx.lineStyle(1, PAL.brass, 0.07);
        gfx.lineBetween(x0 + 10 * sx, rowY, x0 + cw - 10 * sx, rowY);
        const numTicks = 6;
        for (let t = 0; t < numTicks; t++) {
          const tX = x0 + 10 * sx + (cw - 20 * sx) * (t / (numTicks - 1));
          const tH = t % 2 === 0 ? 6 * sy : 4 * sy;
          gfx.lineStyle(1, PAL.teal, 0.12);
          gfx.lineBetween(tX, rowY - tH, tX, rowY + tH);
        }
      }
    }
  }

  _drawCandleIntoGfx(gfx, cx, cy, cw, ch) {
    gfx.fillStyle(0x2a1a08, 0.9);
    gfx.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
    gfx.fillStyle(PAL.amber, 0.5);
    gfx.fillCircle(cx, cy - ch / 2 - 4 * this._sy, cw * 0.4);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATIC DRAW METHODS
  // ══════════════════════════════════════════════════════════════════════════

  _drawConsoleShell() {
    const sx = this._sx, sy = this._sy;
    const ms = this._ms;
    const cx = CONSOLE.x * sx, cy = CONSOLE.y * sy;
    const cw = CONSOLE.w * sx, ch = CONSOLE.h * sy;
    const cr = CONSOLE.cr * sx;

    // HC-02: Inner surface plate
    this._consInner.fillStyle(PAL.consoleBase, 1);
    this._consInner.fillRoundedRect(cx - cw / 2 + 8 * sx, cy - ch / 2 + 8 * sy,
                                     cw - 16 * sx, ch - 16 * sy, cr * 0.7);

    // HC-07: Structural dividers
    const il = cx - cw / 2 + 30 * sx;
    const ir = cx + cw / 2 - 30 * sx;
    const it = cy - ch / 2 + 30 * sy;
    const ib = cy + ch / 2 - 30 * sy;
    const lp = il + (ir - il) * 0.277;
    const rp = il + (ir - il) * 0.723;
    this._consSurf.lineStyle(1, 0x0e1218, 0.8);
    this._consSurf.lineBetween(lp, it, lp, ib);
    this._consSurf.lineBetween(rp, it, rp, ib);

    // HC-03: Inner shadow
    this._consSurf.lineStyle(10, 0x000000, 0.55);
    this._consSurf.strokeRoundedRect(cx - cw / 2 + 8 * sx, cy - ch / 2 + 8 * sy,
                                      cw - 16 * sx, ch - 16 * sy, cr * 0.7);

    // HC-01: Outer brass border
    this._consOuter.lineStyle(2, PAL.brass, 0.22);
    this._consOuter.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, cr);
    this._consOuter.lineStyle(1, 0x1a1e24, 1);
    this._consOuter.strokeRoundedRect(cx - cw / 2 - 2 * sx, cy - ch / 2 - 2 * sy,
                                       cw + 4 * sx, ch + 4 * sy, cr + 1);

    // HC-08: Bottom control housing
    const csX = cx, csY = cy + ch / 2 - 48 * sy;
    const csW = 460 * sx, csH = 88 * sy;
    this._consOuter.fillStyle(0x040508, 0.95);
    this._consOuter.fillRoundedRect(csX - csW / 2, csY - csH / 2, csW, csH, 8 * sx);
    this._consOuter.lineStyle(1, PAL.brass, 0.13);
    this._consOuter.strokeRoundedRect(csX - csW / 2, csY - csH / 2, csW, csH, 8 * sx);

    // ── Elven Filigree (Decorative curves) ──────────────────────────
    this._consSurf.lineStyle(1.5, PAL.brass, 0.12);
    // Top-left filigree (approximated with quadratic curve via arc)
    this._consSurf.beginPath();
    this._consSurf.moveTo(cx - cw / 2 + 60 * sx, cy - ch / 2 + 40 * sy);
    this._consSurf.arc(cx - cw / 2 + 120 * sx, cy - ch / 2 + 20 * sy, 60 * sx, Math.PI, Math.PI / 2);
    this._consSurf.strokePath();

    // Top-right filigree
    this._consSurf.beginPath();
    this._consSurf.moveTo(cx + cw / 2 - 60 * sx, cy - ch / 2 + 40 * sy);
    this._consSurf.arc(cx + cw / 2 - 120 * sx, cy - ch / 2 + 20 * sy, 60 * sx, 0, Math.PI / 2, true);
    this._consSurf.strokePath();

    // Bottom-left filigree
    this._consSurf.beginPath();
    this._consSurf.moveTo(cx - cw / 2 + 40 * sx, cy + ch / 2 - 100 * sy);
    this._consSurf.arc(cx - cw / 2 + 20 * sx, cy + ch / 2 - 60 * sy, 40 * sx, -Math.PI / 2, 0);
    this._consSurf.strokePath();

    // Bottom-right filigree
    this._consSurf.beginPath();
    this._consSurf.moveTo(cx + cw / 2 - 40 * sx, cy + ch / 2 - 100 * sy);
    this._consSurf.arc(cx + cw / 2 - 20 * sx, cy + ch / 2 - 60 * sy, 40 * sx, -Math.PI / 2, 0, true);
    this._consSurf.strokePath();

    // ── Mana-pulse lines (Cyber-elven tech) ─────────────────────────
    this._consSurf.lineStyle(1, PAL.teal, 0.08);
    this._consSurf.strokeCircle(cx - cw * 0.42, cy, 14 * ms);
    this._consSurf.strokeCircle(cx + cw * 0.42, cy, 14 * ms);
    this._consSurf.lineStyle(1, PAL.teal, 0.05);
    this._consSurf.lineBetween(cx - cw * 0.42, cy - 14 * ms, cx - cw * 0.42, cy - ch * 0.4);
    this._consSurf.lineBetween(cx + cw * 0.42, cy - 14 * ms, cx + cw * 0.42, cy - ch * 0.4);
  }

  _drawPanelLeft() {
    const sx = this._sx, sy = this._sy;
    const lx = PANEL_L.x * sx, ly = PANEL_L.y * sy;
    const lw = PANEL_L.w * sx, lh = PANEL_L.h * sy;

    this._panelL.fillStyle(PAL.panelFace, 1);
    this._panelL.fillRoundedRect(lx - lw / 2, ly - lh / 2, lw, lh, 4 * sx);
    this._panelL.lineStyle(1.5, PAL.brass, 0.18);
    this._panelL.strokeRoundedRect(lx - lw / 2, ly - lh / 2, lw, lh, 4 * sx);

    // LT-02: Header strip
    this._panelL.fillStyle(PAL.brass, 0.055);
    this._panelL.fillRect(lx - lw / 2 + 2 * sx, ly - lh / 2 + 2 * sy, lw - 4 * sx, 26 * sy);

    // LT-03: Inner screen recess
    const isx = lx - lw / 2 + 10 * sx, isy = ly - lh / 2 + 34 * sy;
    const isw = lw - 20 * sx, ish = lh - 46 * sy;
    this._panelL.lineStyle(1, 0x082030, 0.9);
    this._panelL.strokeRoundedRect(isx, isy, isw, ish, 3 * sx);

    // LT-04: Scanline texture
    const scanStep = 5 * sy;
    for (let y = isy; y < isy + ish; y += scanStep * 2) {
      this._panelL.lineStyle(1, 0x000000, 0.18);
      this._panelL.lineBetween(isx + 2 * sx, y, isx + isw - 2 * sx, y);
    }

    // LT-05: Corner L-brackets
    const bracketLen = 18 * sx;
    [[lx - lw / 2, ly - lh / 2, 1, 1], [lx + lw / 2, ly - lh / 2, -1, 1],
     [lx - lw / 2, ly + lh / 2, 1, -1], [lx + lw / 2, ly + lh / 2, -1, -1]
    ].forEach(([bx, by, dx, dy]) => {
      this._panelL.lineStyle(2, PAL.teal, 0.45);
      this._panelL.lineBetween(bx, by, bx + dx * bracketLen, by);
      this._panelL.lineBetween(bx, by, bx, by + dy * bracketLen);
    });
  }

  _drawPanelRight() {
    const sx = this._sx, sy = this._sy;
    const rx = PANEL_R.x * sx, ry = PANEL_R.y * sy;
    const rw = PANEL_R.w * sx, rh = PANEL_R.h * sy;

    this._panelR.fillStyle(PAL.panelFace, 1);
    this._panelR.fillRoundedRect(rx - rw / 2, ry - rh / 2, rw, rh, 4 * sx);
    this._panelR.lineStyle(1.5, PAL.brass, 0.18);
    this._panelR.strokeRoundedRect(rx - rw / 2, ry - rh / 2, rw, rh, 4 * sx);

    this._panelR.fillStyle(PAL.brass, 0.055);
    this._panelR.fillRect(rx - rw / 2 + 2 * sx, ry - rh / 2 + 2 * sy, rw - 4 * sx, 26 * sy);

    const bracketLen = 18 * sx;
    [[rx - rw / 2, ry - rh / 2, 1, 1], [rx + rw / 2, ry - rh / 2, -1, 1],
     [rx - rw / 2, ry + rh / 2, 1, -1], [rx + rw / 2, ry + rh / 2, -1, -1]
    ].forEach(([bx, by, dx, dy]) => {
      this._panelR.lineStyle(2, PAL.teal, 0.45);
      this._panelR.lineBetween(bx, by, bx + dx * bracketLen, by);
      this._panelR.lineBetween(bx, by, bx, by + dy * bracketLen);
    });

    // RR-03: Vertical signal slider track
    const stX   = SIG_SLD.x * sx;
    const stTop = SIG_SLD.top * sy;
    const stBot = SIG_SLD.bot * sy;
    const stW   = SIG_SLD.w * sx;
    this._sigSldTrk.fillStyle(0x030608, 1);
    this._sigSldTrk.fillRoundedRect(stX - stW / 2, stTop, stW, stBot - stTop, 12 * sx);
    this._sigSldTrk.lineStyle(1, PAL.brass, 0.18);
    this._sigSldTrk.strokeRoundedRect(stX - stW / 2, stTop, stW, stBot - stTop, 12 * sx);

    // RR-07: Tick marks
    for (let i = 0; i <= 8; i++) {
      const tY = stTop + (stBot - stTop) * (i / 8);
      const isMajor = i % 2 === 0;
      this._sigSldTrk.lineStyle(1, PAL.brass, isMajor ? 0.3 : 0.12);
      this._sigSldTrk.lineBetween(stX - stW / 2 - (isMajor ? 8 : 5) * sx, tY,
                                   stX - stW / 2 - 2 * sx, tY);
    }
  }

  _drawRadarStatic() {
    const sx = this._sx, sy = this._sy, ms = this._ms;
    const cx = RADAR.x * sx, cy = RADAR.y * sy;
    const r  = RADAR.r * ms;

    this._radarCX = cx;
    this._radarCY = cy;
    this._radarR  = r;

    // RD-01: Outer ring + bezel ticks
    this._rdRing.lineStyle(18 * ms, 0x151820, 1);
    this._rdRing.strokeCircle(cx, cy, r + 9 * ms);
    this._rdRing.lineStyle(2, PAL.brass, 0.22);
    this._rdRing.strokeCircle(cx, cy, r + 11 * ms);
    this._rdRing.lineStyle(1, 0x2a2e38, 0.6);
    this._rdRing.strokeCircle(cx, cy, r + 7 * ms);

    for (let deg = 0; deg < 360; deg += 10) {
      const rad = Phaser.Math.DegToRad(deg - 90);
      const isMajor = deg % 30 === 0;
      const len = (isMajor ? 10 : 5) * ms;
      const innerR = r + 12 * ms;
      const outerR = innerR + len;
      this._rdRing.lineStyle(1.5, PAL.brass, isMajor ? 0.4 : 0.12);
      this._rdRing.lineBetween(cx + Math.cos(rad) * innerR, cy + Math.sin(rad) * innerR,
                               cx + Math.cos(rad) * outerR, cy + Math.sin(rad) * outerR);
    }

    // RD-02: Inner disc
    this._rdBg.fillStyle(0x020407, 1);
    this._rdBg.fillCircle(cx, cy, r);

    // RD-03: Grid overlay — rings + crosshairs + diagonals
    this._rdGrid.lineStyle(1, 0xd5b34b, 0.09);
    for (let ring = 1; ring <= 4; ring++) {
      this._rdGrid.strokeCircle(cx, cy, (r / 4) * ring);
    }
    this._rdGrid.lineStyle(1, 0xd5b34b, 0.07);
    this._rdGrid.lineBetween(cx - r, cy, cx + r, cy);
    this._rdGrid.lineBetween(cx, cy - r, cx, cy + r);
    this._rdGrid.lineStyle(1, 0xd5b34b, 0.04);
    [45, 135, 225, 315].forEach(deg => {
      const rad = Phaser.Math.DegToRad(deg);
      this._rdGrid.lineBetween(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r,
                               cx - Math.cos(rad) * r, cy - Math.sin(rad) * r);
    });

    // RD-07: Static glass highlight arc
    this._rdGlass.lineStyle(28 * ms, 0xffffff, 0.025);
    this._rdGlass.strokeCircle(cx - r * 0.12, cy - r * 0.12, r * 0.82);
  }

  _applyRadarMask() {
    const cx = this._radarCX, cy = this._radarCY, r = this._radarR;
    const maskGfx = this.make.graphics({ add: false });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillCircle(cx, cy, r);
    const mask = maskGfx.createGeometryMask();
    // Apply only to elements that can overflow: geo/wave/scan
    // _rdBg (fillCircle) and _rdGrid (strokeCircle) are self-contained
    [this._rdGeo, this._rdWave, this._rdScan].forEach(g => g.setMask(mask));
  }

  _drawGaugeFaces() {
    this._drawGaugeFace(this._gauLFace, GAUGE_L.x, GAUGE_L.y, GAUGE_L.r, PAL.dimGold);
    this._drawGaugeFace(this._gauRFace, GAUGE_R.x, GAUGE_R.y, GAUGE_R.r, PAL.dimGold);
  }

  _drawGaugeFace(gfx, cx_ref, cy_ref, r_ref, col) {
    const ms = this._ms;
    const cx = cx_ref * this._sx, cy = cy_ref * this._sy, r = r_ref * ms;

    // AG-04: Drop shadow
    gfx.fillStyle(0x000000, 0.45);
    gfx.fillCircle(cx + 2 * ms, cy + 4 * ms, r);

    // AG-01: Face
    gfx.fillStyle(0x080808, 1);
    gfx.fillCircle(cx, cy, r);
    gfx.lineStyle(2.5, 0x1c1c1c, 1);
    gfx.strokeCircle(cx, cy, r);
    gfx.lineStyle(1, PAL.brass, 0.1);
    gfx.strokeCircle(cx, cy, r - 3 * ms);

    // Tick marks — 270° arc
    for (let i = 0; i <= 20; i++) {
      const angle = -135 + (i / 20) * 270;
      const rad = Phaser.Math.DegToRad(angle - 90);
      const isMajor = i % 5 === 0;
      const len = (isMajor ? 8 : 4) * ms;
      const outerR = r - 3 * ms;
      gfx.lineStyle(isMajor ? 1.5 : 0.75, isMajor ? col : 0x333333, isMajor ? 0.55 : 0.25);
      gfx.lineBetween(cx + Math.cos(rad) * outerR,          cy + Math.sin(rad) * outerR,
                      cx + Math.cos(rad) * (outerR - len),  cy + Math.sin(rad) * (outerR - len));
    }

    // AG-03: Glass highlight
    gfx.lineStyle(1, 0xffffff, 0.035);
    gfx.strokeCircle(cx, cy, r - 2 * ms);
  }

  _drawControlStrip() {
    const sx = this._sx, sy = this._sy, ms = this._ms;
    const bx = BTN_PLAY.x * sx, by = BTN_PLAY.y * sy;
    const br = BTN_PLAY.r * ms;

    // BC-02: Button idle base (dynamic redraws will take over on play/hover)
    this._btnBg.fillStyle(0x080a0c, 1);
    this._btnBg.fillCircle(bx, by, br);
    this._btnBg.lineStyle(2, PAL.brass, 0.38);
    this._btnBg.strokeCircle(bx, by, br);

    // Volume slider track
    const svCx = VOL_SLD.x * sx, svCy = VOL_SLD.y * sy;
    const svW  = VOL_SLD.w * sx, svH  = VOL_SLD.h * sy;
    this._volTrk.fillStyle(0x030608, 1);
    this._volTrk.fillRoundedRect(svCx - svW / 2, svCy - svH / 2, svW, svH, svH / 2);
    this._volTrk.lineStyle(1, PAL.brass, 0.17);
    this._volTrk.strokeRoundedRect(svCx - svW / 2, svCy - svH / 2, svW, svH, svH / 2);

    // TL-06: Divider between button and slider
    const divX = (BTN_PLAY.x + BTN_PLAY.r + 18) * sx;
    this._volTrk.lineStyle(1, PAL.brass, 0.12);
    this._volTrk.lineBetween(divX, (BTN_PLAY.y - BTN_PLAY.r * 0.6) * sy,
                              divX, (BTN_PLAY.y + BTN_PLAY.r * 0.6) * sy);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEXT LAYER
  // ══════════════════════════════════════════════════════════════════════════

  _buildTextLayer() {
    const sx = this._sx, sy = this._sy, ms = this._ms;
    const px = (n) => `${Math.round(n * ms)}px`;

    // TL-02: Main title
    this._txtTitle = this.add.text(TITLE.x * sx, TITLE.y * sy, 'SONIC THAUMATURGY', {
      fontFamily: '"Cinzel Decorative", "Cinzel", serif',
      fontSize:   px(26),
      color:      '#d5b34b',
      letterSpacing: Math.round(5 * ms),
    }).setOrigin(0.5).setDepth(70).setAlpha(0.9);

    // TL-01: Subtitle
    this._txtSub = this.add.text(TITLE.x * sx, (TITLE.y + 30) * sy,
      'SIGNAL CHAMBER  ·  RITUAL CONSOLE', {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize:   px(9),
        color:      '#00cfc8',
        letterSpacing: Math.round(3 * ms),
      }).setOrigin(0.5).setDepth(70).setAlpha(0.45);

    // TL-05: Gold divider line
    const lineGfx = this.add.graphics().setDepth(69);
    lineGfx.lineStyle(1, PAL.brass, 0.28);
    lineGfx.lineBetween((TITLE.x - 150) * sx, (TITLE.y + 20) * sy,
                        (TITLE.x + 150) * sx, (TITLE.y + 20) * sy);

    // TL-03: Status chip
    this._txtStatus = this.add.text(
      CONSOLE.x * sx, (CONSOLE.y - CONSOLE.h / 2 - 18) * sy, '● STANDBY', {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize:   px(9),
        color:      '#d5b34baa',
        letterSpacing: Math.round(3 * ms),
      }).setOrigin(0.5).setDepth(70);

    // ── Left terminal text ──
    const lx = PANEL_L.x * sx, ly = PANEL_L.y * sy;
    const lw = PANEL_L.w * sx, lh = PANEL_L.h * sy;
    const textLeft = lx - lw / 2 + 14 * sx;
    const insetTop = ly - lh / 2;

    this._txtTermHeader = this.add.text(lx, insetTop + 13 * sy, 'SONIC THAUMATURGY', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize:   px(7.5),
      color:      '#b4912f',
      letterSpacing: Math.round(1.5 * ms),
    }).setOrigin(0.5, 0).setDepth(71).setAlpha(0.8);

    this._txtStaLabel = this.add.text(textLeft, insetTop + 36 * sy, 'ACTIVE STATION', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize:   px(6.5),
      color:      '#ffffff33',
      letterSpacing: Math.round(1.5 * ms),
    }).setDepth(71);

    this._txtStaName = this.add.text(textLeft, insetTop + 50 * sy, 'NO SIGNAL', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize:   px(13),
      color:      '#00ffcc',
      letterSpacing: Math.round(0.5 * ms),
    }).setDepth(72).setShadow(0, 0, '#00ffcc', 8, true, true);

    this._txtSigLabel = this.add.text(textLeft, insetTop + 76 * sy, 'STATUS:', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize:   px(6.5),
      color:      '#ffffff33',
      letterSpacing: Math.round(1.5 * ms),
    }).setDepth(71);

    this._txtSigStatus = this.add.text(textLeft + 56 * sx, insetTop + 76 * sy, 'STANDBY', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize:   px(8.5),
      color:      '#d5b34b',
      letterSpacing: Math.round(1 * ms),
    }).setDepth(72);

    this._txtSigVal = this.add.text(lx + 20 * sx, insetTop + 76 * sy, 'SIG: 0%', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize:   px(8.5),
      color:      '#00cfc8',
      letterSpacing: Math.round(0.5 * ms),
    }).setDepth(72);

    // Log lines (6 rolling)
    this._logLines = Array.from({ length: 6 }, (_, i) =>
      this.add.text(textLeft, insetTop + (98 + i * 18) * sy, '', {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize:   px(7),
        color:      '#00ffcc44',
        wordWrap:   { width: lw - 28 * sx },
      }).setDepth(71)
    );

    // ── Right panel label ──
    const rx = PANEL_R.x * sx, ry_top = (PANEL_R.y - PANEL_R.h / 2) * sy;
    this._txtResonatorHeader = this.add.text(rx, ry_top + 13 * sy, 'ALCHEMICAL RESONATORS', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize:   px(6.5),
      color:      '#b4912f',
      letterSpacing: Math.round(1.5 * ms),
    }).setOrigin(0.5, 0).setDepth(71).setAlpha(0.8);

    // ── Gauge labels ──
    const gaugeFont = {
      fontFamily: '"Cinzel", serif',
      fontSize: px(7.5),
      color: '#d5b34b',
      letterSpacing: Math.round(1.5 * ms),
    };
    this._txtGaugeL = this.add.text(
      GAUGE_L.x * sx, (GAUGE_L.y + GAUGE_L.r + 10) * sy, 'SIGNAL', gaugeFont
    ).setOrigin(0.5).setDepth(70).setAlpha(0.65);
    this._txtGaugeR = this.add.text(
      GAUGE_R.x * sx, (GAUGE_R.y + GAUGE_R.r + 10) * sy, 'VOLUME', gaugeFont
    ).setOrigin(0.5).setDepth(70).setAlpha(0.65);

    // ── Volume label ──
    this._txtVolLabel = this.add.text(
      (VOL_SLD.x - VOL_SLD.w / 2) * sx, VOL_SLD.y * sy, 'VOL', {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize:   px(7),
        color:      '#b4912f88',
        letterSpacing: Math.round(2 * ms),
      }).setOrigin(0, 0.5).setDepth(70);

    // Center radar glyph
    this._txtGlyph = this.add.text(this._radarCX, this._radarCY, '✦', {
      fontFamily: '"Cinzel", serif',
      fontSize:   px(28),
      color:      '#d5b34b',
    }).setOrigin(0.5).setDepth(71).setAlpha(0.25);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIAL RACK
  // ══════════════════════════════════════════════════════════════════════════

  _buildVials() {
    this._vialObjects.forEach(v => {
      v.gfx?.destroy();
      v.hoverGfx?.destroy();   // FIX: dedicated hover overlay, never accumulated
      v.zone?.destroy();
      v.lbl?.destroy();
    });
    this._vialObjects = [];

    // Removed Phaser vials to favor React shelf props
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INPUT WIRING
  // ══════════════════════════════════════════════════════════════════════════

  _wireInput() {
    const sx = this._sx, sy = this._sy, ms = this._ms;

    const applyVolumeFromPointer = (ptr) => {
      const svCx = VOL_SLD.x * sx;
      const svW  = VOL_SLD.w * sx;
      const rel  = Phaser.Math.Clamp((ptr.x - (svCx - svW / 2)) / svW, 0, 1);
      this.onVolumeChange?.(rel);
    };

    // Play/pause zone
    const bx = BTN_PLAY.x * sx, by = BTN_PLAY.y * sy;
    const br = BTN_PLAY.r * ms;
    const playZone = this.add.zone(bx, by, br * 2, br * 2)
      .setInteractive({ useHandCursor: true })
      .setDepth(133);
    playZone.on('pointerdown', () => this.onPlayPause?.());
    playZone.on('pointerover', () => this._onBtnHover(true));
    playZone.on('pointerout',  () => this._onBtnHover(false));

    // Volume slider zone
    const svCx = VOL_SLD.x * sx, svCy = VOL_SLD.y * sy;
    const svW  = VOL_SLD.w * sx;
    const volZone = this.add.zone(svCx, svCy, svW, 28 * sy)
      .setInteractive({ useHandCursor: true })
      .setDepth(133);
    volZone.on('pointerdown', applyVolumeFromPointer);
    volZone.on('pointermove', (ptr) => { if (!ptr.isDown) return; applyVolumeFromPointer(ptr); });
  }

  _onBtnHover(over) {
    const sx = this._sx, sy = this._sy, ms = this._ms;
    const bx = BTN_PLAY.x * sx, by = BTN_PLAY.y * sy;
    const br = BTN_PLAY.r * ms;
    const rimCol   = this._isPlaying ? PAL.teal : PAL.dimGold;
    const rimAlpha = over ? 0.9 : 0.38;
    const fillCol  = over ? 0x141618 : 0x080a0c;

    this._btnBg.clear();
    if (over) {
      this._btnBg.lineStyle(10, rimCol, 0.2);
      this._btnBg.strokeCircle(bx, by, br + 5);
    }
    this._btnBg.fillStyle(fillCol, 1);
    this._btnBg.fillCircle(bx, by, br);
    this._btnBg.lineStyle(2, rimCol, rimAlpha);
    this._btnBg.strokeCircle(bx, by, br);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DYNAMIC REDRAWS
  // ══════════════════════════════════════════════════════════════════════════

  _redrawPlayButton() {
    const sx = this._sx, sy = this._sy, ms = this._ms;
    const bx = BTN_PLAY.x * sx, by = BTN_PLAY.y * sy;
    const br = BTN_PLAY.r * ms;
    const col  = this._isPlaying ? PAL.teal : PAL.dimGold;
    const glowA = this._isPlaying ? 0.25 : 0;

    this._btnBg.clear();
    if (glowA > 0) {
      this._btnBg.lineStyle(10, col, glowA);
      this._btnBg.strokeCircle(bx, by, br + 5);
    }
    this._btnBg.fillStyle(0x080a0c, 1);
    this._btnBg.fillCircle(bx, by, br);
    this._btnBg.lineStyle(2, col, this._isPlaying ? 0.85 : 0.38);
    this._btnBg.strokeCircle(bx, by, br);

    // BC-06/07: Icon
    this._btnIcon.clear();
    this._btnIcon.fillStyle(col, 0.9);
    const is = 11 * ms;
    if (this._isPlaying) {
      this._btnIcon.fillRect(bx - is * 0.75, by - is, is * 0.55, is * 2);
      this._btnIcon.fillRect(bx + is * 0.18,  by - is, is * 0.55, is * 2);
    } else {
      this._btnIcon.fillTriangle(bx - is * 0.55, by - is, bx + is * 0.9, by, bx - is * 0.55, by + is);
    }
  }

  _redrawVolSlider() {
    if (!this._volFill) return;
    const sx = this._sx, sy = this._sy, ms = this._ms;
    const svCx = VOL_SLD.x * sx, svCy = VOL_SLD.y * sy;
    const svW  = VOL_SLD.w * sx, svH  = VOL_SLD.h * sy;
    const fillW = svW * this._vol;
    const thumbR = 9 * ms;
    const thumbX = svCx - svW / 2 + fillW;

    this._volFill.clear();
    this._volFill.fillStyle(PAL.dimGold, 0.55);
    this._volFill.fillRoundedRect(svCx - svW / 2, svCy - svH / 2, fillW, svH, svH / 2);
    this._volFill.fillStyle(0xe0c060, 1);
    this._volFill.fillCircle(thumbX, svCy, thumbR);
    this._volFill.lineStyle(1.5, 0xffffff, 0.2);
    this._volFill.strokeCircle(thumbX, svCy, thumbR);
  }

  _redrawSignalSlider() {
    if (!this._sigSldFill) return;
    const sx = this._sx, sy = this._sy, ms = this._ms;
    const stX   = SIG_SLD.x * sx;
    const stTop = SIG_SLD.top * sy;
    const stBot = SIG_SLD.bot * sy;
    const stW   = SIG_SLD.w * sx;
    const trkH  = stBot - stTop;
    const fillH = this._sig * trkH;
    const fillTop = stBot - fillH;

    this._sigSldFill.clear();
    if (fillH > 0) {
      this._sigSldFill.fillStyle(PAL.teal, 0.55);
      this._sigSldFill.fillRoundedRect(stX - stW / 2 + 4 * ms, fillTop, stW - 8 * ms, fillH - 3, 8 * ms);
      this._sigSldFill.lineStyle(2, PAL.teal, 0.2);
      this._sigSldFill.strokeRoundedRect(stX - stW / 2 + 4 * ms, fillTop, stW - 8 * ms, fillH - 3, 8 * ms);
    }

    // RR-05: Thumb
    this._sigSldThumb.clear();
    this._sigSldThumb.fillStyle(PAL.dimGold, 1);
    this._sigSldThumb.fillRoundedRect(stX - stW / 2 - 5 * ms, fillTop - 10 * ms, stW + 10 * ms, 20 * ms, 5 * ms);
    this._sigSldThumb.lineStyle(1.5, 0xffffff, 0.18);
    this._sigSldThumb.strokeRoundedRect(stX - stW / 2 - 5 * ms, fillTop - 10 * ms, stW + 10 * ms, 20 * ms, 5 * ms);
  }

  _redrawGaugeNeedle(needleGfx, cx_ref, cy_ref, r_ref, value, col) {
    const ms = this._ms;
    const cx = cx_ref * this._sx, cy = cy_ref * this._sy, r = r_ref * ms;
    const angleDeg = -135 + value * 270;
    const rad = Phaser.Math.DegToRad(angleDeg - 90);
    const tipLen = r - 10 * ms;

    needleGfx.clear();

    // Shadow
    needleGfx.lineStyle(3 * ms, 0x000000, 0.4);
    needleGfx.lineBetween(cx + 1, cy + 2,
      cx + Math.cos(rad) * tipLen + 1, cy + Math.sin(rad) * tipLen + 2);

    // Needle
    needleGfx.lineStyle(2 * ms, col, 0.9);
    needleGfx.lineBetween(cx, cy, cx + Math.cos(rad) * tipLen, cy + Math.sin(rad) * tipLen);

    // Pivot
    needleGfx.fillStyle(col, 1);
    needleGfx.fillCircle(cx, cy, 3.5 * ms);
    needleGfx.fillStyle(0x080808, 1);
    needleGfx.fillCircle(cx, cy, 1.5 * ms);
  }

  _syncTextToState() {
    if (!this._txtStaName) return;
    const col = this._colHex;

    this._txtStaName.setText(this._stationName || 'NO SIGNAL');
    this._txtSigStatus?.setText(this._status);
    this._txtSigVal?.setText(`SIG: ${Math.round(this._sig * 100)}%`);

    const chipLabel = this._isTuning  ? '◎ SYNCING'
                    : this._isPlaying ? '◉ TRANSMITTING'
                    :                   '● STANDBY';
    const chipColor = this._isPlaying ? '#00ffcc'
                    : this._isTuning  ? '#d47a1ccc'
                    :                   '#d5b34b88';
    this._txtStatus?.setText(chipLabel).setColor(chipColor);

    if (this._logs.length > 0 && this._logLines) {
      const recent = this._logs.slice(-6);
      this._logLines.forEach((ln, i) => ln.setText(recent[i] ? `> ${recent[i]}` : ''));
    }

    this._txtGlyph?.setColor(col);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EXTERNAL API — called by React wrapper
  // ══════════════════════════════════════════════════════════════════════════

  updateState(data) {
    let stationsChanged = false;
    let playChanged     = false;

    if (data.signalLevel !== undefined && data.signalLevel !== this._sig) {
      this._sig = data.signalLevel;
      this._needsSignalSliderRedraw = true;
    }
    if (data.volume !== undefined && data.volume !== this._vol) {
      this._vol = data.volume;
      this._needsVolSliderRedraw = true;
    }
    if (data.isTuning    !== undefined) this._isTuning    = data.isTuning;
    if (data.status      !== undefined) this._status      = data.status;
    if (data.stationName !== undefined) this._stationName = data.stationName;
    if (data.logs        !== undefined) this._logs        = data.logs;

    if (data.isPlaying !== undefined && data.isPlaying !== this._isPlaying) {
      this._isPlaying = data.isPlaying;
      playChanged = true;
    }

    if (data.schoolColor !== undefined && data.schoolColor !== this._colHex) {
      this._prevCol      = this._col;
      this._colHex       = data.schoolColor;
      this._col          = this._hexToInt(data.schoolColor);
      this._inTransition = true;
      this._transAlpha   = 0;
      // Force gauge needle redraws so they pick up the new color immediately
      this._gaugeL_prev = -1;
      this._gaugeR_prev = -1;
    }

    if (data.schoolId !== undefined) this._schoolId = data.schoolId;

    if (data.stations !== undefined) {
      this._stations = data.stations;
      stationsChanged = true;
    }

    if (data.glyph !== undefined && this._txtGlyph) {
      this._txtGlyph.setText(data.glyph);
    }

    this._syncTextToState();
    if (playChanged)     this._redrawPlayButton();
    if (stationsChanged) this._buildVials();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GAME LOOP
  // ══════════════════════════════════════════════════════════════════════════

  update(time, delta) {
    const cx  = this._radarCX, cy = this._radarCY, r = this._radarR;
    const col = this._col;
    const sig = this._sig;
    const ms  = this._ms;

    // ── School color transition ──
    if (this._inTransition) {
      this._transAlpha = Math.min(1, this._transAlpha + delta * 0.0028);
      if (this._transAlpha >= 1) this._inTransition = false;
    }
    const ta = this._transAlpha;

    // ── Radar: Sweep (RD-05) ──
    const sweepRate = this._isTuning ? 0.15 : 0.054;
    this._scanAngle = (this._scanAngle + delta * sweepRate) % 360;
    const scanRad = Phaser.Math.DegToRad(this._scanAngle - 90);

    this._rdScan.clear();
    for (let i = 0; i < 10; i++) {
      const fadeAlpha = (1 - i / 10) * (0.3 + sig * 0.35) * ta;
      const ang = scanRad - i * 0.011;
      this._rdScan.lineStyle(2, col, fadeAlpha);
      this._rdScan.lineBetween(cx, cy, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    }

    // ── Radar: Hexagram geometry (RD-04) ──
    this._rdGeo.clear();
    const geoA = (0.055 + sig * 0.28) * ta;
    const rot1 = time * 0.00013;
    const rot2 = -time * 0.000085;
    const triR = r * (0.6 + Math.sin(time * 0.0009) * 0.018);

    for (let tri = 0; tri < 2; tri++) {
      this._rdGeo.lineStyle(1.5, col, geoA);
      this._rdGeo.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = (i / 3) * Math.PI * 2 + (tri === 0 ? rot1 : rot2) + (tri * Math.PI);
        const px = cx + Math.cos(a) * triR;
        const py = cy + Math.sin(a) * triR;
        if (i === 0) this._rdGeo.moveTo(px, py); else this._rdGeo.lineTo(px, py);
      }
      this._rdGeo.strokePath();
    }

    // ── Radar: Waveform (RD-06) — skipped when signal negligible ──
    this._rdWave.clear();
    if (sig >= 0.01) {
      const amp    = (7 + sig * 52) * ms;
      const wAlpha = (0.3 + sig * 0.7) * ta;
      this._rdWave.lineStyle(2, col, wAlpha);
      this._rdWave.beginPath();
      const wLeft = cx - r * 0.9, wRight = cx + r * 0.9;
      let firstWave = true;
      for (let wx = wLeft; wx <= wRight; wx += 8) {
        const nx = (wx - wLeft) / (wRight - wLeft);
        const w1 = Math.sin(nx * Math.PI * 4 + time * 0.0048) * amp;
        const w2 = Math.sin(nx * Math.PI * 11 + time * 0.0085) * (amp * 0.22);
        const wy = cy + (w1 + w2) * Math.sin(nx * Math.PI); // taper at edges
        if (firstWave) { this._rdWave.moveTo(wx, wy); firstWave = false; }
        else this._rdWave.lineTo(wx, wy);
      }
      this._rdWave.strokePath();
    }

    // ── Radar: Edge FX glow ──
    this._rdFx.clear();
    const edgeA = 0.07 + sig * 0.42;
    this._rdFx.lineStyle(7, col, edgeA * 0.3 * ta);
    this._rdFx.strokeCircle(cx, cy, r + 1);
    this._rdFx.lineStyle(1.5, 0xffffff, edgeA * 0.1 * ta);
    this._rdFx.strokeCircle(cx, cy, r);

    // ── Radar: Signal ping rings (RD-08) ──
    const pingInterval = this._isTuning ? 800 : 2400;
    if ((this._isPlaying || this._isTuning) && sig > 0.05 && time - this._lastPingMs > pingInterval) {
      this._pingRings.push({ t: 0, maxT: 1400 + sig * 600 });
      this._lastPingMs = time;
    }
    this._rdPings.clear();
    let nextWrite = 0;
    for (let i = 0; i < this._pingRings.length; i++) {
      const p = this._pingRings[i];
      p.t += delta;
      if (p.t >= p.maxT) continue;
      const prog = p.t / p.maxT;
      const pR   = r * 0.08 + r * 0.88 * prog;
      const pA   = (1 - prog) * 0.45 * sig * ta;
      this._rdPings.lineStyle(2, col, pA);
      this._rdPings.strokeCircle(cx, cy, pR);
      this._pingRings[nextWrite++] = p;
    }
    this._pingRings.length = nextWrite;

    // ── Console: 3-layer edge glow (HC-04) — soft falloff ──
    const conX = CONSOLE.x * this._sx, conY = CONSOLE.y * this._sy;
    const conW = CONSOLE.w * this._sx, conH = CONSOLE.h * this._sy;
    const cr   = CONSOLE.cr * this._sx;
    const gA   = (0.035 + sig * 0.1) * ta;

    this._consGlow.clear();
    // Outer diffuse
    this._consGlow.lineStyle(22, col, gA * 0.4);
    this._consGlow.strokeRoundedRect(conX - conW / 2, conY - conH / 2, conW, conH, cr);
    // Mid bloom
    this._consGlow.lineStyle(10, col, gA * 0.75);
    this._consGlow.strokeRoundedRect(conX - conW / 2 + 2 * this._sx, conY - conH / 2 + 2 * this._sy,
                                      conW - 4 * this._sx, conH - 4 * this._sy, cr);
    // Inner crisp line
    this._consGlow.lineStyle(3, col, gA * 2.0);
    this._consGlow.strokeRoundedRect(conX - conW / 2 + 4 * this._sx, conY - conH / 2 + 4 * this._sy,
                                      conW - 8 * this._sx, conH - 8 * this._sy, cr);

    // ── FX: Global ambient haze ──
    this._fxGlow.clear();
    const hazeA = (0.03 + sig * 0.07) * ta;
    this._fxGlow.fillStyle(PAL.teal, hazeA * 0.4);
    this._fxGlow.fillCircle(cx, cy, r * 1.45);
    this._fxGlow.fillStyle(PAL.dimGold, hazeA * 0.25);
    this._fxGlow.fillCircle(conX - conW * 0.3, conY - conH * 0.25, 80 * ms);

    // ── Gauges: Lerp + dirty-check redraw ──
    const lerpSpeed = delta * 0.004;
    const newL = Phaser.Math.Linear(this._gaugeL_cur, sig,        lerpSpeed);
    const newR = Phaser.Math.Linear(this._gaugeR_cur, this._vol,  lerpSpeed);

    if (Math.abs(newL - this._gaugeL_prev) > 0.004) {
      this._redrawGaugeNeedle(this._gauLNeedle, GAUGE_L.x, GAUGE_L.y, GAUGE_L.r, newL, col);
      this._gaugeL_prev = newL;
    }
    if (Math.abs(newR - this._gaugeR_prev) > 0.004) {
      this._redrawGaugeNeedle(this._gauRNeedle, GAUGE_R.x, GAUGE_R.y, GAUGE_R.r, newR, col);
      this._gaugeR_prev = newR;
    }
    this._gaugeL_cur = newL;
    this._gaugeR_cur = newR;

    // ── Sliders: flush pending redraws ──
    if (this._needsSignalSliderRedraw) {
      this._redrawSignalSlider();
      this._needsSignalSliderRedraw = false;
    }
    if (this._needsVolSliderRedraw) {
      this._redrawVolSlider();
      this._needsVolSliderRedraw = false;
    }

    // ── Play button: pulse alpha when active ──
    if (this._isPlaying) {
      this._btnBg.setAlpha(0.72 + Math.sin(time * 0.003) * 0.12);
    } else {
      this._btnBg.setAlpha(1);
    }

    // ── Tuning: station name flicker ──
    if (this._isTuning) {
      this._txtStaName?.setAlpha(0.76 + Math.sin(time * 0.012) * 0.16);
    } else {
      this._txtStaName?.setAlpha(1);
    }

    // ── Glyph: breathes with signal ──
    this._txtGlyph?.setAlpha(0.08 + sig * 0.38);
    this._txtGlyph?.setScale(1 + sig * 0.08);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  _hexToInt(hex) {
    try {
      const clean = hex.startsWith('#') ? hex : '#' + hex;
      return Phaser.Display.Color.HexStringToColor(clean).color;
    } catch {
      return PAL.dimGold;
    }
  }
}
