import Phaser from 'phaser';
import { AMP_CHANNELS, getBytecodeAMP, getRotationAtTime } from '../../../lib/ambient/bytecodeAMP';

const TAU = Math.PI * 2;
const HOT_WHITE = 0xfff4d8;
const EMBER_GOLD = 0xf1b45f;
const FLAME_ORANGE = 0xff6b1a;
const FLAME_RED = 0xb22a12;
const RING_AMBER = 0xffc36c;
const SMOKE_BROWN = 0x6f5a4d;
const OBSIDIAN = 0x050201;

/**
 * Bytecode-authored visual intent for the Scholomance station orb.
 * References:
 * - docs/arcane-laboratory-bytecode-blueprints.md
 * - docs/PDR-archive/bytecode_blueprint_bridge_pdr.md
 */
const STATION_ORB_BYTECODE_BLUEPRINT = Object.freeze({
  core: {
    id: 'station-fire-core',
    preset: 'orb-breath',
    channels: [AMP_CHANNELS.PULSE, AMP_CHANNELS.GLOW, AMP_CHANNELS.FLICKER],
    symmetryOrder: 8,
  },
  smoke: {
    id: 'station-smoke-vent',
    wispCount: 12,
    riseDistance: 1.48,
    channels: [AMP_CHANNELS.NOISE, AMP_CHANNELS.GLOW],
  },
  embers: {
    id: 'station-ember-motes',
    moteCount: 24,
    channels: [AMP_CHANNELS.FLICKER, AMP_CHANNELS.PULSE],
  },
  rings: {
    id: 'station-orbit-rings',
    channels: [AMP_CHANNELS.TORQUE, AMP_CHANNELS.GLOW],
    layers: [
      { rx: 1.18, ry: 0.46, width: 2.6, alpha: 0.28, nodes: 12, nodeSize: 4.2, degPerBeat: 18, direction: 1, phase: 0.15, tint: 0xf4ad4e },
      { rx: 1.36, ry: 0.6, width: 2.1, alpha: 0.22, nodes: 10, nodeSize: 3.6, degPerBeat: 11, direction: -1, phase: 1.1, tint: 0xf7c77f },
      { rx: 1.54, ry: 0.73, width: 1.7, alpha: 0.16, nodes: 8, nodeSize: 3.2, degPerBeat: 7, direction: 1, phase: 2.4, tint: 0xffde9b },
    ],
  },
  sigils: {
    id: 'station-sacred-geometry',
    channels: [AMP_CHANNELS.TORQUE, AMP_CHANNELS.PULSE],
    layers: [
      { id: 'metatron', texture: 'orb_metatron', scale: 0.84, alpha: 0.22, degPerBeat: 28, direction: 1, phase: 0.2, tint: 0xf7c77f },
      { id: 'flower', texture: 'orb_flower_of_life', scale: 0.72, alpha: 0.18, degPerBeat: 18, direction: -1, phase: 1.1, tint: 0xf5dfa9 },
      { id: 'seed', texture: 'orb_seed_of_life', scale: 0.58, alpha: 0.26, degPerBeat: 36, direction: 1, phase: 2.1, tint: 0xffe0a6 },
      { id: 'vesica', texture: 'orb_vesica_piscis', scale: 0.62, alpha: 0.2, degPerBeat: 14, direction: -1, phase: 2.8, tint: 0xf2b35d },
      { id: 'sriYantra', texture: 'orb_sri_yantra', scale: 0.5, alpha: 0.24, degPerBeat: 22, direction: 1, phase: 3.6, tint: 0xfff0c2 },
    ],
  },
});

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(colorA, colorB, t) {
  const amount = clamp01(t);
  const ar = (colorA >> 16) & 0xff;
  const ag = (colorA >> 8) & 0xff;
  const ab = colorA & 0xff;
  const br = (colorB >> 16) & 0xff;
  const bg = (colorB >> 8) & 0xff;
  const bb = colorB & 0xff;

  const rr = Math.round(lerp(ar, br, amount));
  const rg = Math.round(lerp(ag, bg, amount));
  const rb = Math.round(lerp(ab, bb, amount));

  return (rr << 16) | (rg << 8) | rb;
}

function toHexColor(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export class CrystalBallScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CrystalBallScene' });
    this._isCreated = false;
  }

  init() {
    this.signalLevel = 0;
    this.schoolColor = '#c9a227';
    this._cachedCol = 0xc9a227;
    this.glyph = '✦';
    this.isTuning = false;
    this.isPlaying = false;
    this.schoolId = null;
    this.reducedMotion = false;
    this._schoolChanged = false;
    this._lastSwitchTime = 0;
    this._bpm = 90;
    this._bytecodeBlueprint = STATION_ORB_BYTECODE_BLUEPRINT;
    this._sigilConfigs = STATION_ORB_BYTECODE_BLUEPRINT.sigils.layers;
    this._ringSpecs = STATION_ORB_BYTECODE_BLUEPRINT.rings.layers;

    this._flameTongues = Array.from({ length: 9 }, (_, index) => ({
      angle: -0.95 + (index / 8) * 1.9,
      sway: 0.8 + (index % 3) * 0.22,
      width: 0.12 + (index % 4) * 0.02,
      height: 0.22 + (index % 5) * 0.04,
      phase: index * 0.7,
    }));

    this._smokeWisps = Array.from({ length: STATION_ORB_BYTECODE_BLUEPRINT.smoke.wispCount }, (_, index) => ({
      phase: index / STATION_ORB_BYTECODE_BLUEPRINT.smoke.wispCount,
      speed: 0.06 + (index % 4) * 0.015,
      radial: 0.1 + (index % 5) * 0.04,
      size: 0.12 + (index % 4) * 0.03,
      drift: 0.6 + (index % 3) * 0.25,
    }));

    this._emberSpecs = Array.from({ length: STATION_ORB_BYTECODE_BLUEPRINT.embers.moteCount }, (_, index) => ({
      phase: index / STATION_ORB_BYTECODE_BLUEPRINT.embers.moteCount,
      speed: 0.11 + (index % 5) * 0.025,
      spread: 0.08 + (index % 4) * 0.04,
      size: 0.016 + (index % 3) * 0.006,
      seed: index * 1.37,
    }));
  }

  create() {
    const { width, height } = this.scale;
    this._cx = width / 2;
    this._cy = height / 2;
    this._r = Math.min(width, height) * 0.31;

    this._bakeTextures(this._r);

    this.backOrbitLayer = this.add.graphics().setDepth(-6);
    this.bgLayer = this.add.graphics().setDepth(4);
    this.coreLayer = this.add.graphics().setDepth(10);
    this.patternLayer = this.add.container(this._cx, this._cy).setDepth(18);
    this.smokeLayer = this.add.graphics().setDepth(22);
    this.emberLayer = this.add.graphics().setDepth(24);
    this.fxLayer = this.add.graphics().setDepth(30);
    this.frontOrbitLayer = this.add.graphics().setDepth(34);

    this._setupSigils();

    this.glyphText = this.add.text(this._cx, this._cy + this._r * 0.08, this.glyph, {
      fontSize: `${Math.round(this._r * 0.42)}px`,
      fontFamily: '"Cormorant Garamond", serif',
      color: toHexColor(mixColor(this._cachedCol, HOT_WHITE, 0.55)),
      align: 'center',
    }).setOrigin(0.5).setAlpha(0.18).setDepth(20);

    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillCircle(this._cx, this._cy, this._r);
    const mask = maskShape.createGeometryMask();
    this.coreLayer.setMask(mask);
    this.patternLayer.setMask(mask);
    this.glyphText.setMask(mask);

    if (this.cameras.main.postFX) {
      this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 0.85, 1.12);
    }

    this._isCreated = true;
  }

  _bakeTextures(radius) {
    const bake = (key, size, drawFn) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      drawFn(g, size / 2, size / 2);
      g.generateTexture(key, size, size);
      g.destroy();
    };

    const sigilSize = Math.round(radius * 1.9);

    bake('orb_metatron', sigilSize, (g, cx, cy) => {
      g.lineStyle(2, 0xffffff, 1);
      for (let layer = 0; layer < 3; layer++) {
        const hexR = cx * (0.86 - layer * 0.22);
        g.beginPath();
        for (let i = 0; i <= 6; i++) {
          const angle = (i / 6) * TAU;
          const px = cx + Math.cos(angle) * hexR;
          const py = cy + Math.sin(angle) * hexR;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
    });

    bake('orb_flower_of_life', sigilSize, (g, cx, cy) => {
      g.lineStyle(2, 0xffffff, 1);
      const orbitR = cx * 0.34;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * TAU;
        g.strokeCircle(cx + Math.cos(angle) * orbitR, cy + Math.sin(angle) * orbitR, orbitR);
      }
      g.strokeCircle(cx, cy, orbitR);
    });

    bake('orb_seed_of_life', Math.round(radius * 1.5), (g, cx, cy) => {
      g.lineStyle(2.4, 0xffffff, 1);
      const orbitR = cx * 0.34;
      for (let i = 0; i < 7; i++) {
        const angle = (i / 6) * TAU;
        g.strokeCircle(cx + Math.cos(angle) * orbitR, cy + Math.sin(angle) * orbitR, orbitR);
      }
    });

    bake('orb_vesica_piscis', Math.round(radius * 1.45), (g, cx, cy) => {
      g.lineStyle(2.8, 0xffffff, 1);
      g.strokeCircle(cx - cx * 0.22, cy, cx * 0.58);
      g.strokeCircle(cx + cx * 0.22, cy, cx * 0.58);
    });

    bake('orb_sri_yantra', Math.round(radius * 1.5), (g, cx, cy) => {
      g.lineStyle(2.1, 0xffffff, 1);
      for (let i = 0; i < 4; i++) {
        const scale = 1 - i * 0.16;
        const triR = cx * 0.5 * scale;

        g.beginPath();
        for (let p = 0; p <= 3; p++) {
          const angle = (p / 3) * TAU - Math.PI / 2;
          const px = cx + Math.cos(angle) * triR;
          const py = cy + Math.sin(angle) * triR;
          if (p === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();

        g.beginPath();
        for (let p = 0; p <= 3; p++) {
          const angle = (p / 3) * TAU + Math.PI / 2;
          const px = cx + Math.cos(angle) * triR;
          const py = cy + Math.sin(angle) * triR;
          if (p === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
    });

    bake('orb_glint', sigilSize, (g, cx, cy) => {
      g.fillStyle(0xffffff, 0.35);
      g.fillEllipse(cx - cx * 0.3, cy - cy * 0.32, cx * 0.3, cy * 0.16);
      g.fillStyle(0xffffff, 0.12);
      g.fillEllipse(cx + cx * 0.18, cy + cy * 0.2, cx * 0.42, cy * 0.26);
    });
  }

  _setupSigils() {
    this._sigils = {};

    this._sigilConfigs.forEach((config) => {
      const sprite = this.add.sprite(0, 0, config.texture)
        .setScale(config.scale)
        .setAlpha(config.alpha)
        .setBlendMode('SCREEN');

      this._sigils[config.id] = sprite;
      this.patternLayer.add(sprite);
    });

    this._glintSprite = this.add.sprite(0, 0, 'orb_glint')
      .setScale(0.92)
      .setAlpha(0.24)
      .setBlendMode('ADD');

    this.patternLayer.add(this._glintSprite);
  }

  _drawShell(g, glow, pulse, schoolTint) {
    const cx = this._cx;
    const cy = this._cy;
    const r = this._r;
    const shellTint = mixColor(schoolTint, EMBER_GOLD, 0.35);

    g.clear();
    g.fillStyle(OBSIDIAN, 0.98);
    g.fillCircle(cx, cy, r * 1.03);
    g.fillStyle(0x120503, 0.96);
    g.fillCircle(cx, cy, r * 0.96);
    g.fillStyle(mixColor(0x1a0704, FLAME_RED, 0.2), 0.72);
    g.fillCircle(cx, cy + r * 0.05, r * (0.82 + pulse * 0.02));
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(cx + r * 0.11, cy + r * 0.18, r * 1.28, r * 1.08);
    g.fillStyle(HOT_WHITE, 0.08 + glow * 0.04);
    g.fillEllipse(cx - r * 0.26, cy - r * 0.32, r * 0.42, r * 0.2);
    g.lineStyle(8 + pulse * 2, shellTint, 0.18 + glow * 0.15);
    g.strokeCircle(cx, cy, r * 0.99);
    g.lineStyle(2, mixColor(shellTint, HOT_WHITE, 0.45), 0.12 + glow * 0.08);
    g.strokeCircle(cx, cy, r * 0.75);
  }

  _drawFieryCore(g, time, signalLevel, flicker, pulse, glow, transitionAlpha, motionFactor, schoolTint) {
    const cx = this._cx;
    const cy = this._cy;
    const r = this._r;
    const t = time * 0.001;
    const activity = this.isPlaying ? 1 : 0.76;
    const furnaceColor = mixColor(schoolTint, FLAME_ORANGE, 0.22);
    const moltenColor = mixColor(FLAME_ORANGE, EMBER_GOLD, 0.4);
    const kernelColor = mixColor(HOT_WHITE, EMBER_GOLD, 0.5);

    g.clear();
    g.fillStyle(mixColor(FLAME_RED, furnaceColor, 0.35), (0.24 + glow * 0.12) * transitionAlpha * activity);
    g.fillEllipse(cx, cy + r * 0.1, r * 1.1, r * 0.94);

    this._flameTongues.forEach((tongue) => {
      const sway = Math.sin(t * tongue.sway + tongue.phase) * r * 0.08 * motionFactor;
      const lift = r * (0.26 + tongue.height + pulse * 0.05);
      const width = r * (tongue.width + flicker * 0.02);
      const tongueX = cx + Math.sin(tongue.angle) * r * 0.18 + sway;
      const tongueY = cy + r * 0.2 - lift * (0.55 + 0.08 * Math.sin(t * 1.6 + tongue.phase));
      const alpha = (0.12 + signalLevel * 0.18) * transitionAlpha * (0.76 + flicker * 0.24) * activity;

      g.fillStyle(furnaceColor, alpha * 0.72);
      g.fillEllipse(tongueX, tongueY, width * 1.6, lift);
      g.fillStyle(moltenColor, alpha * 0.86);
      g.fillEllipse(tongueX, tongueY + lift * 0.08, width, lift * 0.62);
    });

    for (let band = 0; band < 3; band++) {
      const gyreAngle = t * (0.55 + band * 0.2) + band * 1.4;
      const gyreX = cx + Math.cos(gyreAngle) * r * 0.12;
      const gyreY = cy + Math.sin(gyreAngle * 1.3) * r * 0.08 - r * 0.04;
      const gyreRadius = r * (0.34 - band * 0.06 + pulse * 0.02);

      g.fillStyle(mixColor(moltenColor, schoolTint, band * 0.12), (0.14 + signalLevel * 0.09) * transitionAlpha);
      g.fillEllipse(gyreX, gyreY, gyreRadius, gyreRadius * 0.58);
    }

    g.fillStyle(mixColor(FLAME_RED, furnaceColor, 0.5), 0.44 * transitionAlpha * activity);
    g.fillCircle(cx, cy + r * 0.08, r * (0.34 + signalLevel * 0.05));
    g.fillStyle(moltenColor, 0.58 * transitionAlpha * activity);
    g.fillCircle(cx, cy + r * 0.02, r * (0.24 + pulse * 0.04 + signalLevel * 0.03));
    g.fillStyle(kernelColor, (0.4 + flicker * 0.18) * transitionAlpha * activity);
    g.fillCircle(cx, cy - r * 0.02, r * (0.12 + pulse * 0.03 + signalLevel * 0.02));
  }

  _drawRisingSmoke(g, time, signalLevel, glow, noise, transitionAlpha) {
    const cx = this._cx;
    const cy = this._cy;
    const r = this._r;
    const t = time * 0.001;
    const visibleWisps = this.reducedMotion ? 7 : this._smokeWisps.length;
    const baseAlpha = (this.isPlaying ? 0.1 : 0.07) + signalLevel * 0.08;

    g.clear();

    this._smokeWisps.slice(0, visibleWisps).forEach((wisp) => {
      const progress = (t * wisp.speed + wisp.phase) % 1;
      const x = cx
        + Math.sin(wisp.phase * TAU + t * 0.35) * r * (0.2 + wisp.radial)
        + Math.sin(t * wisp.drift + wisp.phase * 6) * r * 0.08 * noise;
      const y = cy + r * 0.34 - progress * r * this._bytecodeBlueprint.smoke.riseDistance;
      const size = r * (wisp.size + progress * 0.18);
      const alpha = (1 - progress) * baseAlpha * glow * transitionAlpha;

      g.fillStyle(mixColor(SMOKE_BROWN, HOT_WHITE, 0.14), alpha * 0.52);
      g.fillEllipse(x, y, size * 1.26, size * 0.72);
      g.fillStyle(SMOKE_BROWN, alpha * 0.32);
      g.fillEllipse(x + size * 0.08, y - size * 0.03, size * 0.82, size * 0.46);
    });
  }

  _drawEmberMotes(g, time, signalLevel, flicker, glow, transitionAlpha, schoolTint) {
    const cx = this._cx;
    const cy = this._cy;
    const r = this._r;
    const t = time * 0.001;
    const visibleMotes = this.reducedMotion ? 12 : this._emberSpecs.length;
    const emberColor = mixColor(schoolTint, FLAME_ORANGE, 0.18);

    g.clear();

    this._emberSpecs.slice(0, visibleMotes).forEach((mote) => {
      const progress = (t * mote.speed + mote.phase) % 1;
      const x = cx + Math.sin(mote.seed + t * 0.7 + progress * 9) * r * mote.spread;
      const y = cy + r * 0.42 - progress * r * 1.58;
      const alpha = Math.sin(progress * Math.PI) * (0.16 + signalLevel * 0.28) * (0.72 + flicker * 0.28) * transitionAlpha;
      const size = r * mote.size * (0.82 + glow * 0.36);

      if (alpha <= 0.01) return;

      g.fillStyle(emberColor, alpha * 0.88);
      g.fillCircle(x, y, size);
      g.fillStyle(HOT_WHITE, alpha * 0.58);
      g.fillCircle(x, y, size * 0.46);
    });
  }

  _drawAura(g, signalLevel, glow, pulse, transitionAlpha, schoolTint) {
    const cx = this._cx;
    const cy = this._cy;
    const r = this._r;
    const auraColor = mixColor(schoolTint, RING_AMBER, 0.42);

    g.clear();
    g.lineStyle(20, auraColor, (0.05 + glow * 0.03) * transitionAlpha);
    g.strokeCircle(cx, cy, r * (1.08 + pulse * 0.02));
    g.lineStyle(3 + pulse * 1.4, auraColor, (0.24 + signalLevel * 0.16) * glow * transitionAlpha);
    g.strokeCircle(cx, cy, r * 1.01);
    g.fillStyle(HOT_WHITE, 0.08 * glow * transitionAlpha);
    g.fillEllipse(cx - r * 0.14, cy - r * 0.44, r * 0.36, r * 0.12);
  }

  _strokeOrbitArc(g, cx, cy, rx, ry, start, end, lineWidth, color, alpha) {
    const steps = 72;
    g.lineStyle(lineWidth, color, alpha);
    g.beginPath();

    for (let step = 0; step <= steps; step++) {
      const amount = step / steps;
      const angle = start + (end - start) * amount;
      const x = cx + Math.cos(angle) * rx;
      const y = cy + Math.sin(angle) * ry;

      if (step === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }

    g.strokePath();
  }

  _drawOrbitRings(backG, frontG, time, glow, pulse, torque, transitionAlpha, schoolTint) {
    const cx = this._cx;
    const cy = this._cy;
    const r = this._r;
    const motionFactor = this.reducedMotion ? 0.5 : 1;

    backG.clear();
    frontG.clear();

    this._ringSpecs.forEach((ring) => {
      const ringColor = mixColor(schoolTint, ring.tint, 0.45);
      const nodeColor = mixColor(HOT_WHITE, ringColor, 0.4);
      const ringAlpha = ring.alpha * (0.7 + glow * 0.2) * transitionAlpha;
      const rx = r * ring.rx;
      const ry = r * ring.ry;
      const nodeCount = this.reducedMotion ? Math.max(4, ring.nodes - 4) : ring.nodes;
      const baseRotation = getRotationAtTime(time, this._bpm, ring.degPerBeat * ring.direction * motionFactor) + ring.phase + torque * 0.18;

      this._strokeOrbitArc(
        backG,
        cx,
        cy,
        rx,
        ry,
        Math.PI,
        TAU,
        ring.width * (0.88 + pulse * 0.16),
        ringColor,
        ringAlpha * 0.34
      );

      this._strokeOrbitArc(
        frontG,
        cx,
        cy,
        rx,
        ry,
        0,
        Math.PI,
        ring.width * (1 + pulse * 0.2),
        ringColor,
        ringAlpha * 0.62
      );

      for (let i = 0; i < nodeCount; i++) {
        const angle = baseRotation + (i / nodeCount) * TAU;
        const x = cx + Math.cos(angle) * rx;
        const y = cy + Math.sin(angle) * ry;
        const alpha = ringAlpha * (0.42 + 0.58 * Math.sin(angle * 2 + pulse * TAU));
        const nodeSize = ring.nodeSize * (0.84 + glow * 0.34);
        const target = Math.sin(angle) >= 0 ? frontG : backG;
        const nodeAlpha = Math.sin(angle) >= 0 ? alpha * 0.72 : alpha * 0.34;

        target.fillStyle(nodeColor, nodeAlpha);
        target.fillEllipse(x, y, nodeSize * 1.6, nodeSize);
      }
    });
  }

  _updateSigils(time, signalLevel, glow, transitionAlpha, schoolTint) {
    const motionFactor = this.reducedMotion ? 0.5 : 1;

    this.patternLayer.setScale(1 + motionFactor * 0.012 * Math.sin(time * 0.0011));

    this._sigilConfigs.forEach((config) => {
      const sprite = this._sigils?.[config.id];
      if (!sprite) return;

      const rotation = getRotationAtTime(time, this._bpm, config.degPerBeat * config.direction * motionFactor) + config.phase;
      const scale = config.scale * (1 + motionFactor * 0.035 * (0.3 + signalLevel) * Math.sin(time * 0.0015 + config.phase));
      const alpha = config.alpha * (0.72 + glow * 0.18) * transitionAlpha;

      sprite
        .setRotation(rotation)
        .setScale(scale)
        .setAlpha(alpha)
        .setTint(mixColor(config.tint, schoolTint, 0.35));
    });

    if (this._glintSprite) {
      this._glintSprite
        .setRotation(getRotationAtTime(time, this._bpm, 10 * motionFactor))
        .setAlpha((0.16 + glow * 0.08) * transitionAlpha)
        .setTint(mixColor(HOT_WHITE, schoolTint, 0.18));
    }
  }

  updateState(data) {
    if (data.schoolId !== undefined && data.schoolId !== this.schoolId) {
      this._schoolChanged = true;
      this._lastSwitchTime = performance.now();
      this.schoolId = data.schoolId;
    }

    if (data.signalLevel !== undefined) this.signalLevel = data.signalLevel;
    if (data.bpm !== undefined) this._bpm = data.bpm;
    if (data.isTuning !== undefined) this.isTuning = data.isTuning;
    if (data.isPlaying !== undefined) this.isPlaying = data.isPlaying;
    if (data.reducedMotion !== undefined) this.reducedMotion = Boolean(data.reducedMotion);

    if (data.schoolColor !== undefined && data.schoolColor !== this.schoolColor) {
      this.schoolColor = data.schoolColor;
      this._cachedCol = Phaser.Display.Color.HexStringToColor(this.schoolColor).color;
      this.glyphText?.setColor(toHexColor(mixColor(this._cachedCol, HOT_WHITE, 0.55)));
    }

    if (data.glyph !== undefined && data.glyph !== this.glyph) {
      this.glyph = data.glyph;
      this.glyphText?.setText(this.glyph);
    }
  }

  update(time) {
    if (!this._isCreated) return;

    const flicker = getBytecodeAMP(time, AMP_CHANNELS.FLICKER);
    const pulse = getBytecodeAMP(time, AMP_CHANNELS.PULSE);
    const glow = getBytecodeAMP(time, AMP_CHANNELS.GLOW);
    const torque = getBytecodeAMP(time, AMP_CHANNELS.TORQUE);
    const noise = getBytecodeAMP(time, AMP_CHANNELS.NOISE);
    const signalLevel = clamp01(this.signalLevel);

    let transitionAlpha = 1;
    if (this._schoolChanged) {
      const elapsed = performance.now() - this._lastSwitchTime;
      transitionAlpha = Math.min(1, elapsed / 320);
      if (transitionAlpha >= 1) {
        this._schoolChanged = false;
      }
    }

    const schoolTint = mixColor(this._cachedCol, EMBER_GOLD, 0.3);
    const motionFactor = this.reducedMotion ? 0.45 : 1;

    this._drawShell(this.bgLayer, glow, pulse, schoolTint);
    this._drawFieryCore(this.coreLayer, time, signalLevel, flicker, pulse, glow, transitionAlpha, motionFactor, schoolTint);
    this._drawRisingSmoke(this.smokeLayer, time, signalLevel, glow, noise, transitionAlpha);
    this._drawEmberMotes(this.emberLayer, time, signalLevel, flicker, glow, transitionAlpha, schoolTint);
    this._drawAura(this.fxLayer, signalLevel, glow, pulse, transitionAlpha, schoolTint);
    this._drawOrbitRings(this.backOrbitLayer, this.frontOrbitLayer, time, glow, pulse, torque, transitionAlpha, schoolTint);
    this._updateSigils(time, signalLevel, glow, transitionAlpha, schoolTint);

    const glyphAlpha = (this.isPlaying ? 0.14 : 0.09) + signalLevel * 0.08;
    this.glyphText
      .setAlpha(glyphAlpha * glow * transitionAlpha)
      .setScale(1 + motionFactor * 0.025 * Math.sin(time * 0.0017 + 1.2));
  }
}
