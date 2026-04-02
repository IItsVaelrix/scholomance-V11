/**
 * AlchemicalLabScene.js — Background atmosphere with rotating portal halo
 *
 * Performance: All textures are pre-baked at module level (shared across instances)
 * to eliminate runtime texture generation delays.
 */

import Phaser from 'phaser';
import { getBytecodeAMP, AMP_CHANNELS, getRotationAtTime } from '../../../lib/ambient/bytecodeAMP';

// Dynamic Phaser loader - prevents blocking initial bundle
let _PhaserLib = null;
async function getPhaser() {
  if (!_PhaserLib) {
    _PhaserLib = Phaser;
  }
  return _PhaserLib;
}

// ══════════════════════════════════════════════════════════════════════════
// MODULE-LEVEL CACHED TEXTURES (pre-baked, shared across all instances)
// ══════════════════════════════════════════════════════════════════════════

let PARTICLE_TEXTURE = null;

function preBakeTextures() {
  if (PARTICLE_TEXTURE) return; 

  const particleG = document.createElement('canvas');
  particleG.width = 16;
  particleG.height = 16;
  const pCtx = particleG.getContext('2d');
  
  const pGradient = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
  pGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  pGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  pCtx.fillStyle = pGradient;
  pCtx.fillRect(0, 0, 16, 16);
  PARTICLE_TEXTURE = particleG;
}

// ══════════════════════════════════════════════════════════════════════════
// SCENE CLASS
// ══════════════════════════════════════════════════════════════════════════

export class AlchemicalLabScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AlchemicalLabScene' });
    this._sprites = {};
    this._archHexR = 0;
    this._frictionSparks = null;
    this._isCreated = false;
    this._sig = 0;
    this._bpm = 90; // Default BPM for rotation sync
  }

  preload() {
    preBakeTextures();
    if (!this.textures.exists('labPt')) {
      this.textures.addCanvas('labPt', PARTICLE_TEXTURE);
    }
  }

  create() {
    const { width: W, height: H } = this.scale;
    this.scene.settings.zIndex = 0;

    // ── Static layers ───────────────────────────────
    this._bgGfx = this.add.graphics();
    this._archStatGfx = this.add.graphics();
    this._leftGfx = this.add.graphics();
    this._rightGfx = this.add.graphics();
    this._bottleGfx = this.add.graphics();
    this._candleGfx = this.add.graphics();

    // ── Dynamic layers ───────────────────────────
    this._glowGfx = this.add.graphics();
    this._ledGfx = this.add.graphics();
    this._vigGfx = this.add.graphics();

    // Build 2D elements
    this._drawBackground(W, H);
    this._drawArchStatic(W, H);
    this._createArchRotatingSprite(W, H); // GPU PENTAGRAM
    this._buildParticles(W, H);
    this._buildFrictionSparks(W, H);
    this._drawVignette(W, H);

    // ── PostFX Refinement (Video Game Lighting) ──
    if (this.cameras.main.postFX) {
      // Subtle selective bloom for that magical "paintbrush" look
      this._bloom = this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 0.7, 1.0);
    }

    this._isCreated = true;
  }

  _buildFrictionSparks(W, H) {
    const cx = W * 0.5;
    const cy = H * 0.50;
    this._frictionSparks = this.add.particles(cx, cy, 'labPt', {
      speed: { min: 80, max: 200 },
      scale: { start: 0.25, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: { min: 400, max: 700 },
      gravityY: 150,
      blendMode: 'ADD',
      tint: 0x2ddbde,
      frequency: -1, 
    });
  }

  _createArchRotatingSprite(W, H) {
    const cx = W * 0.5;
    const cy = H * 0.50;
    this._archHexR = (Math.max(W, H) * 0.45) * 0.53;
    const texSize = Math.ceil(this._archHexR * 2.2);
    const textureKey = `archRot_penta_v2_${Math.round(texSize)}`;
    
    if (!this.textures.exists(textureKey)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const pR = this._archHexR;
      const center = texSize / 2;
      const points = [];
      
      for (let i = 0; i < 5; i++) {
        const ang = Phaser.Math.DegToRad(-90 + i * 72);
        points.push({ x: center + Math.cos(ang) * pR, y: center + Math.sin(ang) * pR });
      }
      
      // The Sharp Magical Sigil (Pentagram)
      g.lineStyle(2.5, 0xffffff, 1); 
      g.beginPath();
      g.moveTo(points[0].x, points[0].y);
      g.lineTo(points[2].x, points[2].y);
      g.lineTo(points[4].x, points[4].y);
      g.lineTo(points[1].x, points[1].y);
      g.lineTo(points[3].x, points[3].y);
      g.lineTo(points[0].x, points[0].y);
      g.strokePath();

      // Faint magical aura circle
      g.lineStyle(1, 0x2ddbde, 0.2);
      g.strokeCircle(center, center, pR);

      g.generateTexture(textureKey, texSize, texSize);
      g.destroy();
    }

    this._sprites.archRot = this.add.sprite(cx, cy, textureKey);
    this._sprites.archRot.setOrigin(0.5).setBlendMode(Phaser.BlendModes.SCREEN).setAlpha(0.8);
  }

  _drawBackground(W, H) {
    const g = this._bgGfx;
    g.fillStyle(0x010305, 1);
    g.fillRect(0, 0, W, H);
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
    g.lineStyle(1, 0x020507, 0.8);
    for (let row = 0; row * bh <= H; row++) { g.lineBetween(0, row * bh, W, row * bh); }
    g.fillStyle(0x000000, 0.5);
    g.fillRect(0, 0, W, H * 0.07);
    g.fillStyle(0x000000, 0.4);
    g.fillRect(0, H * 0.88, W, H * 0.12);
    for (let y = 0; y < H * 0.35; y += 3) {
      const a = (1 - y / (H * 0.35)) * 0.04;
      g.fillStyle(0x003318, a);
      g.fillRect(0, y, W, 3);
    }
  }

  _drawArchStatic(W, H) {
    const g = this._archStatGfx;
    const cx = W * 0.5, cy = H * 0.50, outerR = Math.max(W, H) * 0.45;
    const halos = [{ r: outerR + 80, w: 12, a: 0.02 }, { r: outerR + 45, w: 8, a: 0.035 }, { r: outerR + 20, w: 5, a: 0.06 }];
    halos.forEach(({ r, w, a }) => { g.lineStyle(w, 0x004422, a); g.strokeCircle(cx, cy, r); });
    g.lineStyle(6, 0x091610, 1); g.strokeCircle(cx, cy, outerR + 2);
    g.lineStyle(2, 0x14281a, 0.8); g.strokeCircle(cx, cy, outerR);
    const bezelR = outerR * 0.78, bezelWidth = 32;
    g.lineStyle(bezelWidth, 0x1a160a, 1); g.strokeCircle(cx, cy, bezelR);
    g.lineStyle(3, 0x8a723a, 0.5); g.strokeCircle(cx, cy, bezelR + (bezelWidth / 2));
    g.lineStyle(2, 0x000000, 0.9); g.strokeCircle(cx, cy, bezelR - (bezelWidth / 2));
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2, px = cx + Math.cos(ang) * bezelR, py = cy + Math.sin(ang) * bezelR;
      g.fillStyle(0x000000, 1); g.fillCircle(px, py, 8);
      g.lineStyle(2, 0x5a4a2a, 0.6); g.strokeCircle(px, py, 9);
    }
    this._archCx = cx; this._archCy = cy; this._bezelR = bezelR;
  }

  _buildParticles(W, H) {
    const cx = W * 0.5, cy = H * 0.50, outerR = this._archHexR * 1.8;
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2, dist = outerR * (0.7 + Math.random() * 0.3);
      this.add.particles(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 'labPt', {
        speed: { min: 8, max: 18 }, angle: { min: 240, max: 300 }, scale: { start: 0.3, end: 0 },
        alpha: { start: 0.4, end: 0 }, lifespan: { min: 1800, max: 2800 }, quantity: 1,
        tint: 0x00cc88, blendMode: 'ADD', frequency: 800, emitting: true,
      });
    }
  }

  _drawVignette(W, H) {
    const g = this._vigGfx;
    for (let x = 0; x < W * 0.09; x += 2) { g.fillStyle(0x000000, (1 - x / (W * 0.09)) * 0.52); g.fillRect(x, 0, 2, H); }
    for (let x = W * 0.91; x < W; x += 2) { g.fillStyle(0x000000, ((x - W * 0.91) / (W * 0.09)) * 0.52); g.fillRect(x, 0, 2, H); }
  }

  update(time, _delta) {
    if (!this._isCreated) return;

    // ── Clear Dynamic Graphics ──
    this._glowGfx.clear();
    this._vigGfx.clear(); // Redraw vignette if needed, or keep static

    // ── Update Synchronized Bytecode AMP Signals ──
    const flicker = getBytecodeAMP(time, AMP_CHANNELS.FLICKER);
    const glow    = getBytecodeAMP(time, AMP_CHANNELS.GLOW);
    const bpm     = this._bpm;

    const cx = this.scale.width * 0.5, cy = this.scale.height * 0.50;

    if (this._sprites.archRot) {
      // Pure clock-like rotation - identical to orb, perfectly smooth
      const rotation = getRotationAtTime(time, bpm || 90, 90);
      const alpha = (0.65 + flicker * 0.2) * glow;
      const tint = 0x2ddbde;

      // Pentagram rotation (clock-smooth)
      this._sprites.archRot.setRotation(rotation).setAlpha(alpha).setTint(tint);

      // Phonemic Pips (Yellow Lights in Bezel Sockets)
      if (this._bezelR) {
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2, px = cx + Math.cos(ang) * this._bezelR, py = cy + Math.sin(ang) * this._bezelR;
          let pipAlpha = alpha * 0.9;
          if (flicker > 0.92) pipAlpha = 1.0;
          this._glowGfx.fillStyle(0xffcc44, pipAlpha); this._glowGfx.fillCircle(px, py, 3.5);
          this._glowGfx.fillStyle(0xffaa00, pipAlpha * 0.4); this._glowGfx.fillCircle(px, py, 8);
          this._glowGfx.fillStyle(0xff8800, pipAlpha * 0.15); this._glowGfx.fillCircle(px, py, 14);
        }
      }
    }
  }

  updateState(data) {
    if (data.signalLevel !== undefined) this._sig = data.signalLevel;
    if (data.bpm !== undefined) this._bpm = data.bpm;
  }
}

export async function renderStaticBackground(width, height) {
  const PhaserLib = (await import('phaser')).default;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const game = new PhaserLib.Game({
    type: PhaserLib.WEBGL, parent: canvas, width, height, backgroundColor: '#010305',
    transparent: false, antialias: true, scene: [], render: { pixelArt: false, antialias: true },
  });
  return new Promise((resolve) => {
    game.events.once('ready', () => {
      const tempScene = new AlchemicalLabScene();
      game.scene.add('temp', tempScene, true);
      setTimeout(() => {
        const dataURL = canvas.toDataURL('image/png', 0.9);
        game.destroy(true);
        resolve(dataURL);
      }, 500);
    });
  });
}
