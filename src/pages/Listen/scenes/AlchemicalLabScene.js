/**
 * AlchemicalLabScene.js — Background atmosphere with rotating portal halo
 *
 * Performance: All textures are pre-baked at module level (shared across instances)
 * to eliminate runtime texture generation delays.
 * 
 * NOTE: Phaser is dynamically imported to avoid blocking initial page load.
 * DO NOT add static import - use getPhaser() helper instead.
 */

// Dynamic Phaser loader - prevents blocking initial bundle
let _PhaserLib = null;
async function getPhaser() {
  if (!_PhaserLib) {
    _PhaserLib = (await import('phaser')).default;
  }
  return _PhaserLib;
}

// ══════════════════════════════════════════════════════════════════════════
// MODULE-LEVEL CACHED TEXTURES (pre-baked, shared across all instances)
// ══════════════════════════════════════════════════════════════════════════

let PARTICLE_TEXTURE = null;
let ARCH_ROT_TEXTURE = null;

/**
 * Pre-bake all textures for instant scene startup.
 * Called once when module loads, not per-instance.
 */
function preBakeTextures(_PhaserLib) {
  if (PARTICLE_TEXTURE && ARCH_ROT_TEXTURE) return; // Already baked

  // Create offscreen graphics for texture generation
  const particleG = document.createElement('canvas');
  particleG.width = 16;
  particleG.height = 16;
  const pCtx = particleG.getContext('2d');
  
  // Soft radial gradient particle
  const pGradient = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
  pGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  pGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  pCtx.fillStyle = pGradient;
  pCtx.fillRect(0, 0, 16, 16);
  PARTICLE_TEXTURE = particleG;

  // Hexagram texture (will be sized properly in scene)
  ARCH_ROT_TEXTURE = null; // Generated per-instance due to size variance
}

// ══════════════════════════════════════════════════════════════════════════
// SCENE CLASS
// ══════════════════════════════════════════════════════════════════════════

export class AlchemicalLabScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AlchemicalLabScene' });
    this._bottleSpecs = [];
    this._candleSpecs = [];
    this._leftCols = [];
    this._rightCols = [];
    this._archAngle = 0;
    this._sig = 0;
    this._archRotSprite = null;
    this._sonicGearSprite = null;
    this._archHexR = 0;
    this._startTime = 0;
    this._frictionSparks = null;
  }

  preload() {
    // Pre-bake textures on first load
    preBakeTextures(Phaser);
    
    // Load particle texture from pre-baked canvas
    if (!this.textures.exists('labPt')) {
      this.textures.addCanvas('labPt', PARTICLE_TEXTURE);
    }
  }

  create() {
    const { width: W, height: H } = this.scale;

    // Set scene zIndex for proper layering in multi-scene game
    this.scene.settings.zIndex = 0; // Background layer

    // Track startup timing for gear unrust effect
    this._startTime = Date.now();

    // ── Static layers (drawn once) ───────────────────────────────
    this._bgGfx = this.add.graphics();
    this._archStatGfx = this.add.graphics();
    this._leftGfx = this.add.graphics();
    this._rightGfx = this.add.graphics();
    this._bottleGfx = this.add.graphics();
    this._candleGfx = this.add.graphics();

    // ── Dynamic layers (cleared + redrawn each frame) ───────────
    this._glowGfx = this.add.graphics();
    this._ledGfx = this.add.graphics();

    // ── Top overlay (drawn last) ─────────────────────────────────
    this._vigGfx = this.add.graphics();

    // Build 2D elements
    this._drawBackground(W, H);
    this._drawArchStatic(W, H);
    this._createArchRotatingSprite(W, H); // ✅ GPU-accelerated rotating hexagram
    this._createSonicGearSprite(W, H);    // ⚙️ NEW: Metallic Sonic Gear
    this._buildParticles(W, H);
    this._buildFrictionSparks(W, H); // ⚡ NEW: Friction sparks for unrust phase
    this._drawVignette(W, H);
  }

  // ─────────────────────────────────────────────────────────────────
  // SONIC GEAR (Metallic core within the hexagram)
  // ─────────────────────────────────────────────────────────────────

  _createSonicGearSprite(W, H) {
    const cx = W * 0.5;
    const cy = H * 0.50;
    const gearR = this._archHexR * 0.52;
    const texSize = Math.ceil(gearR * 2.5);
    const center = texSize / 2;

    const textureKey = `sonicGear_metal_${Math.round(texSize)}`;
    
    if (!this.textures.exists(textureKey)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      
      // 1. Shadow/Depth Underlayer
      g.fillStyle(0x05080a, 0.8);
      g.fillCircle(center, center, gearR + 4);

      // 2. Main Gear Body (Metallic Rim with Bevel)
      // Outer Rim (Iron)
      g.lineStyle(6, 0x2a2e30, 1);
      g.strokeCircle(center, center, gearR);
      // Inner Highlight (Steel Shine)
      g.lineStyle(1.5, 0x889499, 0.4);
      g.strokeCircle(center, center, gearR - 2);
      // Outer Edge Highlight
      g.lineStyle(1, 0x5a6469, 0.6);
      g.strokeCircle(center, center, gearR + 2);

      // 3. 12 Solid Metallic Teeth
      for (let i = 0; i < 12; i++) {
        const ang = Phaser.Math.DegToRad(i * 30);
        const nextAng = Phaser.Math.DegToRad(i * 30 + 15);
        
        // Solid tooth block (Iron)
        g.fillStyle(0x2a2e30, 1);
        const points = [
          { x: center + Math.cos(ang - 0.08) * gearR, y: center + Math.sin(ang - 0.08) * gearR },
          { x: center + Math.cos(ang - 0.05) * (gearR + 10), y: center + Math.sin(ang - 0.05) * (gearR + 10) },
          { x: center + Math.cos(ang + 0.05) * (gearR + 10), y: center + Math.sin(ang + 0.05) * (gearR + 10) },
          { x: center + Math.cos(ang + 0.08) * gearR, y: center + Math.sin(ang + 0.08) * gearR }
        ];
        g.fillPoints(points, true);
        
        // Tooth highlight (Top edge glint)
        g.lineStyle(1, 0x889499, 0.5);
        g.lineBetween(points[1].x, points[1].y, points[2].x, points[2].y);
      }

      // 4. Reinforced Spokes (Heavy Iron)
      for (let i = 0; i < 6; i++) {
        const ang = Phaser.Math.DegToRad(i * 60);
        // Triple-line spokes for mechanical weight
        g.lineStyle(3, 0x1a2428, 1);
        g.lineBetween(center, center, center + Math.cos(ang) * gearR, center + Math.sin(ang) * gearR);
        g.lineStyle(1, 0x5a6469, 0.3);
        g.lineBetween(center, center, center + Math.cos(ang + 0.02) * gearR, center + Math.sin(ang + 0.02) * gearR);
      }

      // 5. Waveform Etchings (Resonant Glow)
      for (let i = 0; i < 6; i++) {
        const ang = Phaser.Math.DegToRad(i * 60 + 30);
        for (let j = 0; j < 5; j++) {
          const r = gearR * (0.35 + j * 0.12);
          const x = center + Math.cos(ang) * r;
          const y = center + Math.sin(ang) * r;
          // Core glow
          g.fillStyle(0x2ddbde, 0.8);
          g.fillCircle(x, y, 1.5);
          // Halo
          g.fillStyle(0x2ddbde, 0.2);
          g.fillCircle(x, y, 4);
        }
      }

      // 6. Heavy Hub (Flywheel Core)
      // Core mass
      g.fillStyle(0x0a1215, 1);
      g.fillCircle(center, center, gearR * 0.28);
      // Metallic hub ring
      g.lineStyle(3, 0x3a4449, 1);
      g.strokeCircle(center, center, gearR * 0.28);
      // Center bore
      g.fillStyle(0x000000, 1);
      g.fillCircle(center, center, gearR * 0.1);
      g.lineStyle(1, 0x2ddbde, 0.5);
      g.strokeCircle(center, center, gearR * 0.1);

      g.generateTexture(textureKey, texSize, texSize);
      g.destroy();
    }

    this._sonicGearSprite = this.add.sprite(cx, cy, textureKey);
    this._sonicGearSprite.setOrigin(0.5);
    this._sonicGearSprite.setBlendMode(Phaser.BlendModes.SCREEN);
    this._sonicGearSprite.setAlpha(0.85);
    this._sonicGearSprite.setDepth(2);
  }

  // ─────────────────────────────────────────────────────────────────
  // FRICTION SPARKS (Visual manifestation of mechanical resistance)
  // ─────────────────────────────────────────────────────────────────

  _buildFrictionSparks(W, H) {
    const cx = W * 0.5;
    const cy = H * 0.50;

    // Emitter for sparks flying off the hexagram during unrusting
    this._frictionSparks = this.add.particles(cx, cy, 'labPt', {
      speed: { min: 80, max: 200 },
      scale: { start: 0.25, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: { min: 400, max: 700 },
      gravityY: 150,
      blendMode: 'ADD',
      tint: 0x2ddbde,
      frequency: -1, // Do not emit by default
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // ARCH PORTAL (Pre-baked texture + GPU sprite rotation)
  // ─────────────────────────────────────────────────────────────────

  _createArchRotatingSprite(W, H) {
    const cx = W * 0.5;
    const cy = H * 0.50;
    this._archHexR = (Math.max(W, H) * 0.45) * 0.53;
    const texSize = Math.ceil(this._archHexR * 2.2);

    // Create hexagram texture if not cached for this size
    const textureKey = `archRot_${Math.round(texSize)}`;
    
    if (!this.textures.exists(textureKey)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });

      // Two overlapping triangles (star of David / hexagram)
      for (let tri = 0; tri < 2; tri++) {
        const base = tri === 0 ? -90 : 90;
        g.lineStyle(1.5, 0x0f2c1e, 0.6);
        g.beginPath();
        for (let i = 0; i <= 3; i++) {
          const ang = Phaser.Math.DegToRad(base + i * 120);
          const px = texSize / 2 + Math.cos(ang) * this._archHexR;
          const py = texSize / 2 + Math.sin(ang) * this._archHexR;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }

      // Radial spokes
      g.lineStyle(1, 0x0a1810, 0.22);
      for (let deg = 0; deg < 360; deg += 30) {
        const rad = Phaser.Math.DegToRad(deg);
        g.lineBetween(
          texSize / 2, texSize / 2,
          texSize / 2 + Math.cos(rad) * this._archHexR * 0.88,
          texSize / 2 + Math.sin(rad) * this._archHexR * 0.88
        );
      }

      g.generateTexture(textureKey, texSize, texSize);
      g.destroy();
    }

    // Create sprite from cached texture
    this._archRotSprite = this.add.sprite(cx, cy, textureKey);
    this._archRotSprite.setOrigin(0.5);
    this._archRotSprite.setBlendMode(Phaser.BlendModes.SCREEN);
    this._archRotSprite.setAlpha(0.8);
    // Enable smooth GPU rotation
    this._archRotSprite.setInteractive?.();
  }

  // ─────────────────────────────────────────────────────────────────
  // BACKGROUND (Stone wall)
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
  // ARCH PORTAL  (centered halo around music player - full page circumference)
  // ─────────────────────────────────────────────────────────────────

  _drawArchStatic(W, H) {
    const g = this._archStatGfx;
    const cx = W * 0.5;
    const cy = H * 0.50;
    const outerR = Math.max(W, H) * 0.45;

    // 1. Soft outer glow halos — subtle aura around the player
    const halos = [
      { r: outerR + 80, w: 12, a: 0.02 },
      { r: outerR + 45, w: 8, a: 0.035 },
      { r: outerR + 20, w: 5, a: 0.06 },
    ];
    halos.forEach(({ r, w, a }) => {
      g.lineStyle(w, 0x004422, a);
      g.strokeCircle(cx, cy, r);
    });

    // 2. Main outer ring — dark metal
    g.lineStyle(6, 0x091610, 1);
    g.strokeCircle(cx, cy, outerR + 2);
    g.lineStyle(2, 0x14281a, 0.8);
    g.strokeCircle(cx, cy, outerR);
    g.lineStyle(1, 0x0a1810, 0.35);
    g.strokeCircle(cx, cy, outerR - 8);

    // 3. THE BEZEL: Massive Gilded Mounting Plate for Phonemic Pips
    const bezelR = outerR * 0.78;
    const bezelWidth = 32;

    // Heavy Brass/Iron Plate (Solid Mass)
    g.lineStyle(bezelWidth, 0x1a160a, 1);
    g.strokeCircle(cx, cy, bezelR);
    
    // Outer Bevel (Top-lit highlight)
    g.lineStyle(3, 0x8a723a, 0.5);
    g.strokeCircle(cx, cy, bezelR + (bezelWidth / 2));
    
    // Inner Bevel (Structural Shadow)
    g.lineStyle(2, 0x000000, 0.9);
    g.strokeCircle(cx, cy, bezelR - (bezelWidth / 2));
    
    // Surface Detail (Brushed metal etching)
    g.lineStyle(1, 0x2a2214, 0.4);
    g.strokeCircle(cx, cy, bezelR + 4);
    g.strokeCircle(cx, cy, bezelR - 4);

    // 4. PIP SOCKETS (8 Deep-Drilled Divots)
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const px = cx + Math.cos(ang) * bezelR;
      const py = cy + Math.sin(ang) * bezelR;
      
      // Socket Depth (Drilled into the plate)
      g.fillStyle(0x000000, 1);
      g.fillCircle(px, py, 8);
      // Socket Rim (Mechanical Chamfer)
      g.lineStyle(2, 0x5a4a2a, 0.6);
      g.strokeCircle(px, py, 9);
    }

    // 5. Tick marks
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

    // Interior fill — transparent center for music player orb
    g.fillStyle(0x010406, 0.15);
    g.fillCircle(cx, cy, outerR - 10);

    // Concentric inner rings — spaced to frame the player
    [outerR * 0.85, outerR * 0.70, outerR * 0.55, outerR * 0.40].forEach(r => {
      g.lineStyle(1, 0x0d2018, 0.35);
      g.strokeCircle(cx, cy, r);
    });

    // Cardinal cross — subtle alignment guides
    const hexR = outerR * 0.53;
    g.lineStyle(1, 0x0e2218, 0.20);
    g.lineBetween(cx - hexR, cy, cx + hexR, cy);
    g.lineBetween(cx, cy - hexR, cx, cy + hexR);

    // Center node — small marker behind player
    g.fillStyle(0x1a3828, 0.4);
    g.fillCircle(cx, cy, 6);
    g.lineStyle(1, 0x00aa66, 0.2);
    g.strokeCircle(cx, cy, 6);

    // Store for update()
    this._archCx = cx;
    this._archCy = cy;
    this._archHexR = hexR;
    this._bezelR = bezelR;
  }

  // ─────────────────────────────────────────────────────────────────
  // PARTICLE TEXTURE
  // ─────────────────────────────────────────────────────────────────

  _makeParticleTex() {
    // Already pre-baked in preload()
  }

  // ─────────────────────────────────────────────────────────────────
  // BUILD PARTICLES
  // ─────────────────────────────────────────────────────────────────

  _buildParticles(W, H) {
    const cx = W * 0.5;
    const cy = H * 0.50;
    const outerR = this._archHexR * 1.8;

    // Floating ember particles around portal
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const dist = outerR * (0.7 + Math.random() * 0.3);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;

      this.add.particles(x, y, 'labPt', {
        speed: { min: 8, max: 18 },
        angle: { min: 240, max: 300 },
        scale: { start: 0.3, end: 0 },
        alpha: { start: 0.4, end: 0 },
        lifespan: { min: 1800, max: 2800 },
        quantity: 1,
        tint: 0x00cc88,
        blendMode: 'ADD',
        frequency: 800,
        emitting: true,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // VIGNETTE
  // ─────────────────────────────────────────────────────────────────

  _drawVignette(W, H) {
    const g = this._vigGfx;

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

  update(_time) {
    const elapsed = (Date.now() - this._startTime) / 1000; // seconds since start
    const cx = this.scale.width * 0.5;
    const cy = this.scale.height * 0.50;

    // 1. Portal rotation and Ignition Sequence (15s total)
    if (this._archRotSprite) {
      let rotation;
      let alpha = 0.8;
      let tint = 0x2ddbde;

      if (elapsed < 15) {
        // --- IGNITION PHASE (0-15s) ---
        const progress = elapsed / 15;
        const easedProgress = 1 - Math.pow(1 - progress, 3); // cubic ease-out
        const targetAngle = (Math.PI * 2 / 30) * elapsed; // angle if at full speed
        rotation = targetAngle * easedProgress;

        if (elapsed < 13.5) {
          // 1.1 PULSE PHASE (3 x 4.5s = 13.5s)
          // Pulse from 0.2 to 1.0 opacity three times
          const pulseProgress = (elapsed % 4.5) / 4.5;
          const pulseIntensity = (Math.sin(pulseProgress * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5);
          alpha = 0.3 + (0.7 * pulseIntensity);
          
          // Friction sparks building with progress
          if (this._frictionSparks) {
            const innerR = this._archHexR * 0.577;
            const sparkChance = 0.05 + (progress * 0.3);
            for (let i = 0; i < 6; i++) {
              if (Math.random() < sparkChance * pulseIntensity) {
                const jointAngle = rotation + (i * Math.PI / 3) + (Math.PI / 6);
                this._frictionSparks.emitParticleAt(cx + Math.cos(jointAngle) * innerR, cy + Math.sin(jointAngle) * innerR, 1);
              }
            }
          }
        } else {
          // 1.2 STROBE PHASE (1.5s violent flicker)
          const isFlickerOn = Math.random() > 0.4;
          alpha = isFlickerOn ? 1.0 : 0.1;
          
          // Violent spark output during strobe
          if (this._frictionSparks) {
            const innerR = this._archHexR * 0.577;
            for (let i = 0; i < 6; i++) {
              if (Math.random() > 0.3) {
                const jointAngle = rotation + (i * Math.PI / 3) + (Math.PI / 6);
                this._frictionSparks.emitParticleAt(cx + Math.cos(jointAngle) * innerR, cy + Math.sin(jointAngle) * innerR, 2);
              }
            }
          }
        }

        // Tint shift: fade from cold dark teal to resonant cyan
        const tintInterp = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0x0f2c1e),
          Phaser.Display.Color.ValueToColor(0x2ddbde),
          1,
          easedProgress
        );
        tint = Phaser.Display.Color.GetColor(tintInterp.r, tintInterp.g, tintInterp.b);
      } else {
        // --- STASIS PHASE (15s+) ---
        const unrustEndAngle = (Math.PI * 2 / 30) * 15;
        const fullSpeedElapsed = elapsed - 15;
        rotation = unrustEndAngle + (Math.PI * 2 / 30) * fullSpeedElapsed;
        alpha = 0.9; // Solid, stable glow
        tint = 0x2ddbde;

        if (this._frictionSparks && this._frictionSparks.emitting) {
          this._frictionSparks.stop();
        }
      }

      this._archRotSprite.rotation = rotation;
      this._archRotSprite.setAlpha(alpha);
      this._archRotSprite.setTint(tint);

      // 2. Sonic Gear Counter-Rotation
      if (this._sonicGearSprite) {
        // Rotates in opposite direction, slightly faster for torque feel
        this._sonicGearSprite.rotation = -rotation * 1.5;
        this._sonicGearSprite.setAlpha(alpha * 0.8); // Slightly dimmer than the seal
        this._sonicGearSprite.setTint(tint);

        // Sonic Vibration in Stasis
        if (elapsed >= 15) {
          const vibe = Math.sin(Date.now() * 0.05) * 0.5;
          this._sonicGearSprite.x = cx + vibe;
          this._sonicGearSprite.y = cy + vibe;
        }
      }

      // 3. Phonemic Pips (Yellow Lights in Bezel Sockets)
      this._glowGfx.clear();
      if (this._bezelR) {
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const px = cx + Math.cos(ang) * this._bezelR;
          const py = cy + Math.sin(ang) * this._bezelR;
          
          // Use alpha from the ritual
          const pipAlpha = alpha * 0.9;
          
          // Core light (gem/tube)
          this._glowGfx.fillStyle(0xffcc44, pipAlpha);
          this._glowGfx.fillCircle(px, py, 3.5);
          
          // Inner glow (blooms from socket)
          this._glowGfx.fillStyle(0xffaa00, pipAlpha * 0.4);
          this._glowGfx.fillCircle(px, py, 8);
          
          // Outer bloom (bleeds onto brass)
          this._glowGfx.fillStyle(0xff8800, pipAlpha * 0.15);
          this._glowGfx.fillCircle(px, py, 14);
        }
      }
    }
  }

  updateState(data) {
    if (data.signalLevel !== undefined) {
      this._sig = data.signalLevel;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// STATIC RENDER FOR CACHING (LCP optimization)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Render static background to canvas data URL for caching.
 * This captures all non-animated elements for instant LCP on subsequent visits.
 * 
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Promise<string>} Data URL of rendered static background
 */
export async function renderStaticBackground(width, height) {
  // Create offscreen Phaser game
  const PhaserLib = (await import('phaser')).default;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const game = new PhaserLib.Game({
    type: PhaserLib.WEBGL,
    parent: canvas,
    width,
    height,
    backgroundColor: '#010305',
    transparent: false,
    antialias: true,
    scene: [],
    render: {
      pixelArt: false,
      antialias: true,
    },
  });
  
  return new Promise((resolve) => {
    game.events.once('ready', () => {
      // Create temporary scene to render static elements
      const tempScene = new AlchemicalLabScene();
      game.scene.add('temp', tempScene, true);
      
      // Wait for scene to create static elements
      setTimeout(() => {
        // Get data URL
        const dataURL = canvas.toDataURL('image/png', 0.9);
        
        // Clean up
        game.destroy(true);
        
        resolve(dataURL);
      }, 500);
    });
  });
}
