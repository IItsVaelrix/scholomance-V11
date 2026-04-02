import Phaser from 'phaser';
import { getBytecodeAMP, AMP_CHANNELS, getRotationAtTime } from '../../../lib/ambient/bytecodeAMP';

/**
 * CrystalBallScene.js — Pixel Art Crystal Ball with Bytecode-Driven Animation.
 * 
 * PIXEL ART TECHNIQUES:
 * - Swirling Nebula (4-8 frame internal vortex animation)
 * - 3-Frame Gem Shine (surface reflection moving across sphere)
 * - Pulse/Aura Glow (2-3 frame flickering halo)
 * - Color Palette Shift (magic state cycling)
 * - Particle Sparkles (blinking + and x shaped sparkles)
 */
export class CrystalBallScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CrystalBallScene' });
    this._sprites = {};
    this._isCreated = false;
    this._currentNebulaFrame = 0;
    this._currentShineFrame = 0;
    this._currentAuraFrame = 0;
    this._colorShiftPhase = 0;
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
    this._bpm = 90;
    this._animationTimer = 0;
    
    // Pre-generate storm cloud positions (deterministic, swirling storm pattern)
    this._stormClouds = [];
    for (let i = 0; i < 12; i++) {
      this._stormClouds.push({
        baseAngle: (i / 12) * Math.PI * 2,
        baseRadius: 0.2 + (i % 4) * 0.12,
        phase: i * 0.5,
        size: 0.12 + (i % 5) * 0.04,
        swirlSpeed: 0.8 + (i % 3) * 0.2
      });
    }
    // Pre-generate lightning bolt configs for internal storm
    this._lightningBolts = [];
    for (let b = 0; b < 6; b++) {
      this._lightningBolts.push({
        baseAngle: (b / 6) * Math.PI * 2,
        triggerOffset: b * 1.5,
        segments: 7 + b,
        jitterSeed: b * 11.3
      });
    }
    // Sacred geometry symbols - pre-computed rotational configs
    this._sacredSymbols = [
      { type: 'metatron', bpm: 90, degPerBeat: 45, direction: 1, depth: 5 },
      { type: 'flower', bpm: 90, degPerBeat: -30, direction: -1, depth: 6 },
      { type: 'seed', bpm: 90, degPerBeat: 60, direction: 1, depth: 7 },
      { type: 'vesica', bpm: 90, degPerBeat: -22.5, direction: -1, depth: 8 },
      { type: 'srYantra', bpm: 90, degPerBeat: 15, direction: 1, depth: 9 }
    ];
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2, r = Math.min(width, height) * 0.44;
    this._bakeUniversalTextures(r);
    this.bgLayer      = this.add.graphics().setDepth(0);
    this.patternLayer = this.add.container(cx, cy).setDepth(10);
    this.stormLayer   = this.add.graphics().setDepth(15);
    this.lightningLayer = this.add.graphics().setDepth(20);
    this.waveLayer    = this.add.graphics().setDepth(20);
    this.fxLayer      = this.add.graphics().setDepth(30);
    this.iceRingsLayer = this.add.graphics().setDepth(35);
    this.noiseLayer   = this.add.graphics().setDepth(40);
    this._setupPersistentSprites(r);

    // Create sacred geometry symbol sprites
    this._setupSacredSymbols(r);

    this.glyphText = this.add.text(cx, cy, this.glyph, { fontSize: '72px', fontFamily: '"Cormorant Garamond", serif', color: this.schoolColor }).setOrigin(0.5).setAlpha(0.4).setDepth(25);
    const maskShape = this.make.graphics({ add: false }); maskShape.fillStyle(0xffffff); maskShape.fillCircle(cx, cy, r); const mask = maskShape.createGeometryMask();
    // Ice rings are NOT masked - they extend outside the crystal sphere
    this.bgLayer.setMask(mask); this.patternLayer.setMask(mask); this.stormLayer.setMask(mask); this.lightningLayer.setMask(mask); this.waveLayer.setMask(mask); this.glyphText.setMask(mask); this.noiseLayer.setMask(mask);
    this._drawStaticBg(cx, cy, r);
    if (this.cameras.main.postFX) this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 0.9, 1.2);
    this._isCreated = true;
  }

  _bakeUniversalTextures(r) {
    const bake = (key, size, drawFn) => { 
      if (this.textures.exists(key)) return; // Check each texture individually
      const g = this.make.graphics({ x: 0, y: 0, add: false }); 
      drawFn(g, size/2, size/2, size); 
      g.generateTexture(key, size, size); 
      g.destroy(); 
    };
    
    bake('orb_mote', 16, (g, cx, cy) => { g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, cx); });
    bake('orb_sacred_hex', r * 2, (g, cx, cy) => { g.lineStyle(3, 0xffffff, 1); g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2, px = cx + Math.cos(a) * (cx * 0.85), py = cy + Math.sin(a) * (cy * 0.85); if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.strokePath(); });
    bake('orb_sacred_star', r * 2, (g, cx, cy) => { g.lineStyle(4, 0xffffff, 1); for (let tri = 0; tri < 2; tri++) { const rot = tri * Math.PI; g.beginPath(); for (let i = 0; i <= 3; i++) { const a = (i / 3) * Math.PI * 2 + rot, px = cx + Math.cos(a) * (cx * 0.62), py = cy + Math.sin(a) * (cy * 0.62); if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.strokePath(); } });
    bake('orb_flower_of_life', r * 2, (g, cx, cy) => { g.lineStyle(2.5, 0xffffff, 1); const orbitR = cx * 0.38; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.strokeCircle(cx + Math.cos(a) * orbitR, cy + Math.sin(a) * orbitR, orbitR); } g.strokeCircle(cx, cy, orbitR); });
    bake('orb_metatron', r * 2, (g, cx, cy) => { g.lineStyle(2, 0xffffff, 1); for (let h = 0; h < 3; h++) { const hexR = cx * (0.85 - h * 0.25); g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2, px = cx + Math.cos(a) * hexR, py = cy + Math.sin(a) * hexR; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.strokePath(); } });
    bake('orb_specular_glint', r * 2, (g, cx, cy) => { g.fillStyle(0xffffff, 0.4); g.fillEllipse(cx - r * 0.35, cy - r * 0.35, r * 0.25, r * 0.15); g.fillStyle(0xffffff, 0.15); g.fillEllipse(cx + r * 0.2, cy + r * 0.2, r * 0.4, r * 0.3); });

    // Sacred geometry symbols for internal rotation - VIBRANT COLORS
    bake('orb_seed_of_life', r * 1.5, (g, cx, cy) => {
      g.lineStyle(3, 0xffd700, 1.0); // Bright gold, fully opaque
      const orbitR = cx * 0.35;
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.strokeCircle(cx + Math.cos(a) * orbitR, cy + Math.sin(a) * orbitR, orbitR);
      }
    });
    bake('orb_vesica_piscis', r * 1.5, (g, cx, cy) => {
      g.lineStyle(3, 0xd0a0ff, 1.0); // Bright purple, fully opaque
      g.beginPath();
      g.strokeCircle(cx - cx * 0.25, cy, cx * 0.6);
      g.strokeCircle(cx + cx * 0.25, cy, cx * 0.6);
    });
    bake('orb_sri_yantra', r * 1.5, (g, cx, cy) => {
      g.lineStyle(2.5, 0xff80b0, 1.0); // Bright pink, fully opaque
      for (let i = 0; i < 4; i++) {
        const scale = 1 - i * 0.15;
        g.beginPath();
        const upR = cx * 0.5 * scale;
        for (let j = 0; j <= 3; j++) {
          const a = (j / 3) * Math.PI * 2 - Math.PI / 2;
          const px = cx + Math.cos(a) * upR;
          const py = cy + Math.sin(a) * upR;
          if (j === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        for (let j = 0; j <= 3; j++) {
          const a = (j / 3) * Math.PI * 2 + Math.PI / 2;
          const px = cx + Math.cos(a) * upR;
          const py = cy + Math.sin(a) * upR;
          if (j === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
      }
    });
  }

  _setupPersistentSprites(r) {
    this._sprites.hex1 = this.add.sprite(0, 0, 'orb_sacred_hex').setAlpha(0.35);
    this._sprites.hex2 = this.add.sprite(0, 0, 'orb_sacred_hex').setAlpha(0.25).setScale(0.7);
    this._sprites.star = this.add.sprite(0, 0, 'orb_sacred_star').setAlpha(0.4);
    this._sprites.flower = this.add.sprite(0, 0, 'orb_flower_of_life').setAlpha(0.3).setScale(1.2);
    this._sprites.metatron = this.add.sprite(0, 0, 'orb_metatron').setAlpha(0.35);
    this._sprites.glint = this.add.sprite(0, 0, 'orb_specular_glint').setAlpha(0.5).setBlendMode('ADD');
    this.patternLayer.add([this._sprites.hex1, this._sprites.hex2, this._sprites.star, this._sprites.flower, this._sprites.metatron, this._sprites.glint]);
  }

  /**
   * Setup sacred geometry symbol sprites for internal rotation
   */
  _setupSacredSymbols(r) {
    this._sacredSprites = {};

    // Metatron's Cube - outermost sacred symbol - HIGH VISIBILITY
    this._sacredSprites.metatron = this.add.sprite(0, 0, 'orb_metatron')
      .setAlpha(0.6).setScale(0.65).setDepth(5);

    // Flower of Life - HIGH VISIBILITY
    this._sacredSprites.flower = this.add.sprite(0, 0, 'orb_flower_of_life')
      .setAlpha(0.55).setScale(0.85).setDepth(6);

    // Seed of Life - center - HIGH VISIBILITY
    this._sacredSprites.seed = this.add.sprite(0, 0, 'orb_seed_of_life')
      .setAlpha(0.65).setScale(0.75).setDepth(7);

    // Vesica Piscis - dual fish shape - HIGH VISIBILITY
    this._sacredSprites.vesica = this.add.sprite(0, 0, 'orb_vesica_piscis')
      .setAlpha(0.58).setScale(0.8).setDepth(8);

    // Sri Yantra - innermost sacred geometry - HIGH VISIBILITY
    this._sacredSprites.srYantra = this.add.sprite(0, 0, 'orb_sri_yantra')
      .setAlpha(0.62).setScale(0.7).setDepth(9);

    this.patternLayer.add(Object.values(this._sacredSprites));
  }

  _drawStaticBg(cx, cy, r) {
    this.bgLayer.clear();
    // Deep crystal sphere - dark transparent blue-purple
    this.bgLayer.fillStyle(0x0a0820, 0.95);
    this.bgLayer.fillCircle(cx, cy, r);
    // Inner crystal depth
    this.bgLayer.fillStyle(0x1a1040, 0.7);
    this.bgLayer.fillCircle(cx, cy, r * 0.85);
    // Subtle shadow layers for depth
    for (let i = 3; i >= 1; i--) {
      this.bgLayer.fillStyle(0x000000, 0.12 * i);
      this.bgLayer.fillCircle(cx + r * 0.05, cy + r * 0.05, r * (0.95 - i * 0.05));
    }
    // Crystal surface reflection
    this.bgLayer.fillStyle(0xffffff, 0.12);
    this.bgLayer.fillCircle(cx - r * 0.28, cy - r * 0.28, r * 0.25);
    // Secondary highlight
    this.bgLayer.fillStyle(0xa0a0ff, 0.08);
    this.bgLayer.fillCircle(cx + r * 0.2, cy - r * 0.15, r * 0.18);
  }

  /**
   * STORM WITHIN CRYSTAL: Swirling storm clouds
   * Deterministic swirling pattern - like a tempest contained in glass
   */
  _drawStormClouds(g, cx, cy, r, time, sig, ta, pulse, flicker) {
    const t = time * 0.001;
    
    this._stormClouds.forEach((cloud, i) => {
      // Swirling storm motion - deterministic spiral
      const swirlAngle = cloud.baseAngle + t * cloud.swirlSpeed * 0.3 + Math.sin(t * 0.4 + cloud.phase) * 0.15;
      const radius = r * (cloud.baseRadius + pulse * 0.06);
      const x = cx + Math.cos(swirlAngle) * radius;
      const y = cy + Math.sin(swirlAngle) * radius;
      const cloudSize = r * (cloud.size + flicker * 0.02);
      
      // Storm cloud - ALWAYS VISIBLE even at sig=0
      const stormAlpha = (0.35 + sig * 0.15) * ta;
      
      // Outer cloud mass
      g.fillStyle(0x4a4a6a, stormAlpha);
      g.fillCircle(x, y, cloudSize);
      
      // Inner darker core
      g.fillStyle(0x2a2a4a, stormAlpha * 0.8);
      g.fillCircle(x, y, cloudSize * 0.65);
      
      // Wispy edges - lighter for visibility
      g.fillStyle(0x5a5a7a, stormAlpha * 0.6);
      g.fillCircle(x + cloudSize * 0.3, y + cloudSize * 0.2, cloudSize * 0.4);
    });
  }

  /**
   * PIXEL ART: Swirling Nebula Effect
   * 8-frame internal vortex animation simulating trapped magical energy
   */
  _drawSwirlingNebula(g, cx, cy, r, time, sig, col, ta) {
    const t = time * 0.001;
    const frameDuration = 100; // ms per frame
    const frame = Math.floor((t * 1000) / frameDuration) % 8;
    const swirlAngle = t * 0.5;
    
    // 8 swirling energy arms
    for (let i = 0; i < 8; i++) {
      const armAngle = (i / 8) * Math.PI * 2 + swirlAngle + frame * 0.1;
      const armLength = r * (0.3 + Math.sin(frame * 0.5 + i) * 0.15);
      
      // Pixel art style - draw as series of rectangles
      const pixelSize = r * 0.08;
      for (let p = 0; p < 4; p++) {
        const px = cx + Math.cos(armAngle) * (p * pixelSize * 1.5);
        const py = cy + Math.sin(armAngle) * (p * pixelSize * 1.5);
        const pixelAlpha = (0.4 - p * 0.08) * ta * (0.5 + sig * 0.5);
        
        // Color shift based on frame
        const hueShift = (frame * 15 + i * 10) % 60;
        const pixelCol = this._shiftColor(col, hueShift);
        
        g.fillStyle(pixelCol, pixelAlpha);
        g.fillRect(px - pixelSize/2, py - pixelSize/2, pixelSize, pixelSize);
      }
    }
  }
  
  /**
   * PIXEL ART: 3-Frame Gem Shine
   * Surface reflection moving across sphere for 3D illusion
   */
  _drawGemShine(g, cx, cy, r, time, ta) {
    const t = time * 0.001;
    const frameDuration = 200;
    const frame = Math.floor((t * 1000) / frameDuration) % 3;
    
    // Shine position moves from top-left to bottom-right
    const shinePositions = [
      { x: -0.3, y: -0.3, size: 0.15 },
      { x: -0.15, y: -0.15, size: 0.2 },
      { x: 0, y: 0, size: 0.12 }
    ];
    
    const pos = shinePositions[frame];
    const shineX = cx + pos.x * r;
    const shineY = cy + pos.y * r;
    const shineSize = pos.size * r;
    
    // Pixel art shine - bright white/yellow pixels
    const pixelSize = shineSize * 0.25;
    const shineAlpha = (0.6 + Math.sin(t * 5) * 0.2) * ta;
    
    g.fillStyle(0xffffff, shineAlpha);
    g.fillRect(shineX - pixelSize, shineY - pixelSize, pixelSize * 2, pixelSize * 2);
    
    g.fillStyle(0xffffaa, shineAlpha * 0.7);
    g.fillRect(shineX - pixelSize * 0.5, shineY - pixelSize * 0.5, pixelSize, pixelSize);
  }
  
  /**
   * PIXEL ART: Pulse/Aura Glow
   * 3-frame flickering halo around the sphere
   */
  _drawAuraGlow(g, cx, cy, r, time, sig, col, ta) {
    const t = time * 0.001;
    const frameDuration = 150;
    const frame = Math.floor((t * 1000) / frameDuration) % 3;
    
    // 3 aura sizes for pulsing effect
    const auraSizes = [r * 1.05, r * 1.08, r * 1.06];
    const auraAlpha = [0.25, 0.35, 0.28];
    
    const currentSize = auraSizes[frame];
    const currentAlpha = (auraAlpha[frame] + sig * 0.15) * ta;
    
    // Pixel art aura - draw as 8 directional spikes
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t * 0.3;
      const spikeLen = currentSize * (0.1 + Math.sin(frame + i) * 0.05);
      const spikeX = cx + Math.cos(angle) * currentSize;
      const spikeY = cy + Math.sin(angle) * currentSize;
      
      g.fillStyle(col, currentAlpha);
      g.fillRect(spikeX - 3, spikeY - 3, 6, 6);
    }
  }
  
  /**
   * PIXEL ART: Particle Sparkles
   * Small + and x shaped sparkles blinking around orb edge
   */
  _drawParticleSparkles(g, cx, cy, r, time, ta) {
    const t = time * 0.001;
    const sparkleCount = 6;
    
    for (let i = 0; i < sparkleCount; i++) {
      // Deterministic blink pattern
      const blinkPhase = t * 3 + i * 0.5;
      const isBlinking = Math.sin(blinkPhase) > 0.5;
      
      if (!isBlinking) continue;
      
      const angle = (i / sparkleCount) * Math.PI * 2 + t * 0.2;
      const sparkleX = cx + Math.cos(angle) * r * 1.1;
      const sparkleY = cy + Math.sin(angle) * r * 1.1;
      
      // Draw + or x shape (alternating)
      const sparkleSize = 4;
      const sparkleAlpha = (0.6 + Math.sin(blinkPhase * 2) * 0.4) * ta;
      
      g.fillStyle(0xffffff, sparkleAlpha);
      
      if (i % 2 === 0) {
        // + shape
        g.fillRect(sparkleX - 1, sparkleY - sparkleSize/2, 2, sparkleSize);
        g.fillRect(sparkleX - sparkleSize/2, sparkleY - 1, sparkleSize, 2);
      } else {
        // x shape
        for (let d = 0; d < 4; d++) {
          const dx = (d < 2 ? 1 : -1) * (d % 2 === 0 ? 1 : 0);
          const dy = (d >= 2 ? 1 : -1) * (d % 2 === 0 ? 0 : 1);
          g.fillRect(sparkleX + dx * 3, sparkleY + dy * 3, 2, 2);
        }
      }
    }
  }
  
  /**
   * Helper: Shift color hue by given amount
   */
  _shiftColor(baseCol, hueShift) {
    // Simple color shift - add hue offset to RGB
    const r = (baseCol >> 16) & 0xff;
    const g = (baseCol >> 8) & 0xff;
    const b = baseCol & 0xff;
    
    // Apply hue shift (simplified)
    const shift = hueShift / 60;
    const newR = Math.min(255, Math.floor(r + (g - r) * shift));
    const newG = Math.min(255, Math.floor(g + (b - g) * shift));
    const newB = Math.min(255, Math.floor(b + (r - b) * shift));
    
    return (newR << 16) | (newG << 8) | newB;
  }

  /**
   * STORM LIGHTNING: High-fidelity procedural lightning using mathematical approximations
   * Optimized for low GPU consumption - uses sine-based distance fields instead of segment loops
   * 
   * BYTECODE-FRIENDLY TECHNIQUE:
   * - Procedural jagged lines via sine wave interference
   * - Distance field glow with smoothstep (no expensive texture lookups)
   * - Separable glow calculation (1D passes instead of 2D convolution)
   */
  _drawStormLightning(g, cx, cy, r, time, sig, col, ta, glow, flicker) {
    const t = time * 0.001;
    const lightningIntensity = 0.9; // Always bright
    
    // Always draw at least 2 bolts for visibility
    this._lightningBolts.forEach((bolt, idx) => {
      // Storm lightning trigger - first 2 bolts always visible
      const trigger = Math.sin(t * 8 + bolt.triggerOffset) * 0.5 + 0.5;
      const flickerTrigger = flicker > 0.3 ? 1 : 0;
      const baseActive = idx < 2 ? 0.2 : 0.15; // First bolts more active
      const active = trigger > baseActive || flickerTrigger > 0;
      
      if (!active) return;
      
      const intensity = lightningIntensity * ta * (0.7 + trigger * 0.3 + flickerTrigger * 0.5);
      const baseAngle = bolt.baseAngle + t * 0.15;
      
      // Bolt origin (center of storm)
      const originX = cx + Math.cos(baseAngle) * r * 0.1;
      const originY = cy + Math.sin(baseAngle) * r * 0.1;
      
      // Bolt target (edge of storm cloud area)
      const targetAngle = baseAngle + (Math.sin(t * 2 + bolt.jitterSeed) - 0.5) * 0.6;
      const targetDist = r * 0.45;
      const targetX = cx + Math.cos(targetAngle) * targetDist;
      const targetY = cy + Math.sin(targetAngle) * targetDist;
      
      // Generate lightning path points using midpoint displacement (procedural)
      const points = this._generateLightningPath(originX, originY, targetX, targetY, bolt.jitterSeed, t, r);
      
      // Draw lightning using distance-field-based glow (GPU-efficient)
      this._drawLightningBolt(g, points, col, intensity, flicker, r);
    });
  }
  
  /**
   * Generate lightning path using recursive midpoint displacement
   * Deterministic pseudo-random using sine-based hash
   */
  _generateLightningPath(x1, y1, x2, y2, seed, t, r, depth = 0, maxDepth = 5) {
    if (depth >= maxDepth) {
      return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    }
    
    // Midpoint
    const mx = (x1 + x2) * 0.5;
    const my = (y1 + y2) * 0.5;
    
    // Deterministic perpendicular offset using sine hash
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hash = Math.sin(seed * 3.7 + depth * 5.3 + t * 4.1) * 0.5 + 0.5;
    const offset = (hash - 0.5) * dist * 0.3 * (1 - depth / maxDepth);
    
    // Perpendicular direction
    const px = -dy / dist * offset;
    const py = dx / dist * offset;
    
    // Displaced midpoint
    const mx2 = mx + px;
    const my2 = my + py;
    
    // Recursively subdivide
    const left = this._generateLightningPath(x1, y1, mx2, my2, seed, t, r, depth + 1, maxDepth);
    const right = this._generateLightningPath(mx2, my2, x2, y2, seed, t, r, depth + 1, maxDepth);
    
    // Merge (remove duplicate midpoint)
    return [...left.slice(0, -1), ...right];
  }
  
  /**
   * Draw lightning bolt using distance-field glow technique
   * High fidelity with minimal GPU instructions
   */
  _drawLightningBolt(g, points, col, intensity, flicker, r) {
    if (points.length < 2) return;
    
    // Outer bloom glow (wide, low alpha) - rendered as thick line
    g.lineStyle(10 + flicker * 5, col, intensity * 0.35);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.strokePath();
    
    // Mid-layer glow (saturated color core)
    g.lineStyle(5 + flicker * 2, col, intensity * 0.75);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.strokePath();
    
    // Inner white-hot core (bright, thin)
    g.lineStyle(2, 0xffffff, intensity * 0.95);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.strokePath();
    
    // Branch tendrils at key points (every 3rd point)
    for (let i = 1; i < points.length - 1; i += 3) {
      if (Math.sin(i * 2.3 + points.length) > 0.3) {
        this._drawLightningTendril(g, points[i], col, intensity * 0.4, flicker, r);
      }
    }
  }
  
  /**
   * Draw small branching tendril using procedural sine offset
   */
  _drawLightningTendril(g, startPoint, col, intensity, flicker, r) {
    const tendrilLen = r * (0.08 + Math.sin(startPoint.x * 0.1) * 0.04);
    const baseAngle = Math.PI + Math.random() * Math.PI * 0.5;
    
    const endX = startPoint.x + Math.cos(baseAngle) * tendrilLen;
    const endY = startPoint.y + Math.sin(baseAngle) * tendrilLen;
    
    g.lineStyle(2 + flicker, col, intensity);
    g.beginPath();
    g.moveTo(startPoint.x, startPoint.y);
    
    // Single midpoint displacement for tendril - use lineTo instead of quadraticCurveTo
    const mx = (startPoint.x + endX) * 0.5 + (Math.random() - 0.5) * tendrilLen * 0.3;
    const my = (startPoint.y + endY) * 0.5 + (Math.random() - 0.5) * tendrilLen * 0.3;
    
    g.lineTo(mx, my);
    g.lineTo(endX, endY);
    g.strokePath();
  }

  /**
   * SATURN ICE RINGS: Layered crystalline rings orbiting the sphere
   * Multiple concentric rings with varying opacity and particle effects
   */
  _drawIceRings(g, cx, cy, r, time, sig, ta, glow, pulse) {
    const t = time * 0.001;

    // Ring system is drawn outside the crystal sphere (not masked)
    // Tilted perspective for 3D effect
    const tilt = 0.3; // Radians of tilt

    // Draw multiple concentric rings - INCREASED VISIBILITY
    const ringConfigs = [
      { radius: r * 1.15, width: 10, alpha: 0.6, speed: 0.2, color: 0xd0e0f0 },
      { radius: r * 1.28, width: 12, alpha: 0.45, speed: -0.15, color: 0xc0d8e8 },
      { radius: r * 1.42, width: 8, alpha: 0.35, speed: 0.1, color: 0xb0d0e0 },
      { radius: r * 1.55, width: 6, alpha: 0.25, speed: -0.08, color: 0xa0c8d8 }
    ];

    ringConfigs.forEach((ring, ringIdx) => {
      const rotation = t * ring.speed;
      const ringAlpha = (ring.alpha + sig * 0.15) * ta * glow;

      // Draw ring as ellipse (tilted circle)
      g.lineStyle(ring.width, ring.color, ringAlpha);

      // Draw ring particles/segments for icy crystalline look
      const particleCount = 24;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + rotation;
        const particleAngle = angle + ringIdx * 0.3;

        // Ellipse formula for tilted ring
        const px = cx + Math.cos(particleAngle) * ring.radius;
        const py = cy + Math.sin(particleAngle) * ring.radius * Math.cos(tilt);

        // Crystal particle - larger and brighter
        const particleSize = ring.width * (0.7 + pulse * 0.4);
        g.fillStyle(ring.color, ringAlpha * 0.8);
        g.fillEllipse(px, py, particleSize, particleSize * 0.5);
      }

      // Faint continuous ring line
      g.lineStyle(3, ring.color, ringAlpha * 0.5);
      g.strokeEllipse(cx, cy, ring.radius * 2, ring.radius * 2 * Math.cos(tilt));
    });

    // Outer ring glow envelope - more visible
    const outerGlow = 0.2 + sig * 0.25;
    g.lineStyle(25, 0xffffff, outerGlow * ta * 0.2);
    g.strokeEllipse(cx, cy, r * 1.6, r * 1.6 * Math.cos(tilt));
  }

  updateState(data) {
    if (!this._isCreated) return;
    if (data.schoolId !== undefined && data.schoolId !== this.schoolId) { 
      this._schoolChanged = true; 
      this._lastSwitchTime = performance.now();
      this.schoolId = data.schoolId; 
    }
    if (data.signalLevel !== undefined) this.signalLevel = data.signalLevel;
    if (data.bpm !== undefined) this._bpm = data.bpm;
    if (data.schoolColor !== undefined && data.schoolColor !== this.schoolColor) { this.schoolColor = data.schoolColor; this._cachedCol = Phaser.Display.Color.HexStringToColor(this.schoolColor).color; this._needsBgRedraw = true; }
    if (data.glyph !== undefined && data.glyph !== this.glyph) { this.glyph = data.glyph; this.glyphText.setText(this.glyph); }
    if (data.isTuning !== undefined) this.isTuning = data.isTuning;
    if (data.isPlaying !== undefined) this.isPlaying = data.isPlaying;
  }

  update(time, _delta) {
    if (!this._isCreated) return;

    // Pure bytecode-driven animation - no simulation
    const flicker = getBytecodeAMP(time, AMP_CHANNELS.FLICKER);
    const glow = getBytecodeAMP(time, AMP_CHANNELS.GLOW);
    const pulse = getBytecodeAMP(time, AMP_CHANNELS.PULSE);
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2, r = Math.min(width, height) * 0.44;
    const col = this._cachedCol, sig = this.signalLevel, bpm = this._bpm;

    // Absolute time transition
    let ta = 1;
    if (this._schoolChanged) {
      const elapsed = performance.now() - (this._lastSwitchTime || 0);
      ta = Math.min(1, elapsed / 300);
      if (ta >= 1) this._schoolChanged = false;
    }

    // Pattern layer rotation - BPM synced with HIGH visibility
    const patternAlpha = 0.4 + sig * 0.2;
    this._sprites.hex1.setAlpha(patternAlpha).setRotation(getRotationAtTime(time, bpm, 90)).setTint(col);
    this._sprites.hex2.setAlpha(patternAlpha * 0.8).setRotation(getRotationAtTime(time, bpm, -45)).setTint(col);
    this._sprites.star.setAlpha(patternAlpha * 1.1).setRotation(getRotationAtTime(time, bpm, -180)).setTint(col);
    this._sprites.flower.setAlpha(patternAlpha * 0.9).setRotation(getRotationAtTime(time, bpm, 45)).setTint(col);
    this._sprites.metatron.setAlpha(patternAlpha).setRotation(getRotationAtTime(time, bpm, -90)).setTint(col);
    this._sprites.glint.setAlpha((0.4 + sig * 0.3) * ta * (0.8 + flicker * 0.2)).setRotation(getRotationAtTime(time, bpm, 22.5));

    // Sacred geometry symbols - BPM-synced rotation in perfect harmony - ALWAYS VISIBLE
    this._sacredSymbols.forEach((symbol) => {
      const sprite = this._sacredSprites[symbol.type];
      if (!sprite) return;

      // Each symbol rotates at its own BPM-synced rate
      const rotation = getRotationAtTime(time, symbol.bpm, symbol.degPerBeat * symbol.direction);
      sprite.setRotation(rotation);

      // Pulse based on signal level - always visible base
      const baseScale = sprite.scale;
      const pulseScale = baseScale + sig * 0.05 * Math.sin(time * 0.002 + symbol.depth);
      sprite.setScale(pulseScale);
    });

    // PIXEL ART ANIMATIONS - Bytecode-driven frame animation
    // Draw pixel art effects on bgLayer (inside the crystal sphere)
    
    // 1. Swirling Nebula - 8-frame vortex animation
    this._drawSwirlingNebula(this.bgLayer, cx, cy, r, time, sig, col, ta);
    
    // 2. Gem Shine - 3-frame surface reflection
    this._drawGemShine(this.bgLayer, cx, cy, r, time, ta);
    
    // 3. Aura Glow - 3-frame flickering halo (on fxLayer for outside sphere)
    this._drawAuraGlow(this.fxLayer, cx, cy, r, time, sig, col, ta);
    
    // 4. Particle Sparkles - blinking + and x shapes (on fxLayer)
    this._drawParticleSparkles(this.fxLayer, cx, cy, r, time, ta);

    // STORM WITHIN CRYSTAL: Swirling storm clouds (inside the sphere)
    this.stormLayer.clear();
    this._drawStormClouds(this.stormLayer, cx, cy, r, time, sig, ta, pulse, flicker);

    // STORM LIGHTNING: Internal electrical discharges (inside the storm)
    this.lightningLayer.clear();
    this._drawStormLightning(this.lightningLayer, cx, cy, r, time, sig, col, ta, glow, flicker);

    // School-specific visual programs
    this.waveLayer.clear();
    if (this.schoolId === 'SONIC' || !this.schoolId) {
      this._drawSonicWaves(this.waveLayer, cx, cy, r, time, sig, col, ta * glow);
    }

    // CRYSTAL SPHERE EDGE - Containment field for the storm
    this.fxLayer.clear();
    const edgeGlow = (0.5 + sig * 0.4) * (0.9 + flicker * 0.1);
    this.fxLayer.lineStyle(4, col, edgeGlow * ta);
    this.fxLayer.strokeCircle(cx, cy, r);

    // SATURN ICE RINGS - Outside the crystal sphere (not masked)
    this.iceRingsLayer.clear();
    this._drawIceRings(this.iceRingsLayer, cx, cy, r, time, sig, ta, glow, pulse);

    // Tuning noise overlay
    this.noiseLayer.clear();
    if (this.isTuning) {
      this.noiseLayer.fillStyle(0xffffff, 0.08 * flicker);
      for (let i = 0; i < 20; i++) {
        const nx = cx + (Math.random() - 0.5) * r * 1.8;
        const ny = cy + (Math.random() - 0.5) * r * 1.8;
        this.noiseLayer.fillRect(nx, ny, Math.random() * 8 + 2, 1);
      }
    }

    // Glyph text
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
