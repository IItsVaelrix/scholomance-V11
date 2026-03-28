import Phaser from 'phaser';

/**
 * CrystalBallScene.js — Phaser 3 Scene
 * Visualizes the "Aetheric Signal" inside an Arcane Crystal Ball.
 * 
 * Reactions:
 * - Signal Level (from AmbientPlayer) drives EQ bar height and glow intensity.
 * - School Color drives the palette.
 * - School Glyph appears at the center.
 */
export class CrystalBallScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CrystalBallScene' });
  }

  init(data) {
    this.signalLevel = data.signalLevel || 0;
    this.schoolColor = data.schoolColor || '#c9a227';
    this.glyph = data.glyph || '*';
    this.isTuning = data.isTuning || false;
  }

  create() {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.42;

    // --- Textures ---
    if (!this.textures.exists('particle_flare')) {
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(8, 8, 8);
      graphics.generateTexture('particle_flare', 16, 16);
    }

    // --- Outer Aura ---
    this.aura = this.add.graphics();
    
    // --- The Glass Sphere ---
    this.sphere = this.add.graphics();
    
    // --- EQ Visualizer (Circular Bars) ---
    this.eqBars = this.add.graphics();
    this.numBars = 64;

    // --- Center Glyph ---
    this.glyphText = this.add.text(centerX, centerY, this.glyph, {
      fontSize: '80px',
      fontFamily: '"Cormorant Garamond", serif',
      color: this.schoolColor,
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5).setAlpha(0.6);

    // --- Particles (Mana Motes) ---
    this.motes = this.add.particles(0, 0, 'particle_flare', {
      speed: { min: 5, max: 20 },
      scale: { start: 0.15, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 3000,
      blendMode: 'ADD',
      frequency: 150,
      emitZone: { 
        type: 'random', 
        source: new Phaser.Geom.Circle(centerX, centerY, radius) 
      }
    });

    // --- Masking (Keep everything inside the ball) ---
    const maskShape = this.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillCircle(centerX, centerY, radius);
    const mask = maskShape.createGeometryMask();
    
    this.eqBars.setMask(mask);
    this.glyphText.setMask(mask);
    this.motes.setMask(mask);

    // --- Grid Lines (Plugin Polish) ---
    this.gridLines = this.add.graphics();
    this.gridLines.setMask(mask);
    this.drawGridLines(centerX, centerY, radius);

    // --- Noise Overlay (for "Tuning" effect) ---
    this.noiseGraphics = this.add.graphics();
    this.noiseGraphics.setMask(mask);
  }

  drawGridLines(x, y, radius) {
    this.gridLines.clear();
    this.gridLines.lineStyle(1, 0xc9a227, 0.1);
    
    // Vertical lines
    for (let i = -3; i <= 3; i++) {
      const lx = x + (i * radius * 0.25);
      const dy = Math.sqrt(radius * radius - (lx - x) * (lx - x));
      this.gridLines.lineBetween(lx, y - dy, lx, y + dy);
    }
    
    // Horizontal lines
    for (let i = -3; i <= 3; i++) {
      const ly = y + (i * radius * 0.25);
      const dx = Math.sqrt(radius * radius - (ly - y) * (ly - y));
      this.gridLines.lineBetween(x - dx, ly, x + dx, ly);
    }
  }

  /**
   * Called by React bridge/hook to update state.
   */
  updateState(data) {
    if (data.signalLevel !== undefined) this.signalLevel = data.signalLevel;
    if (data.schoolColor !== undefined) this.schoolColor = data.schoolColor;
    if (data.glyph !== undefined) this.glyph = data.glyph;
    if (data.isTuning !== undefined) this.isTuning = data.isTuning;
  }

  update(time, delta) {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.42;
    const colorInt = Phaser.Display.Color.HexStringToColor(this.schoolColor).color;

    // 1. Draw Aura (Outer Glow)
    this.aura.clear();
    const glowIntensity = 0.2 + this.signalLevel * 0.5;
    for (let i = 0; i < 8; i++) {
      this.aura.lineStyle(3, colorInt, (glowIntensity * (8 - i)) / 8);
      this.aura.strokeCircle(centerX, centerY, radius + i * 3);
    }

    // 2. Draw Glass Sphere (Reflections)
    this.sphere.clear();
    // Dark core
    this.sphere.fillStyle(0x0a0812, 0.85);
    this.sphere.fillCircle(centerX, centerY, radius);
    // Subtle inner rim light
    this.sphere.lineStyle(2, colorInt, 0.3);
    this.sphere.strokeCircle(centerX, centerY, radius - 1);
    // Surface highlight (top-left)
    this.sphere.fillStyle(0xffffff, 0.08);
    this.sphere.fillCircle(centerX - radius * 0.35, centerY - radius * 0.35, radius * 0.25);

    // 3. Draw EQ Visualizer (Parametric look inside the orb)
    this.eqBars.clear();
    const baseRadius = radius * 0.75;
    
    for (let i = 0; i < this.numBars; i++) {
      const angle = (i / this.numBars) * Math.PI * 2 + time * 0.0005;
      // Frequency simulation using perlin-like noise or random
      const freqVar = Math.sin(time * 0.002 + i * 0.5) * 0.15 + Math.cos(time * 0.001 + i * 0.8) * 0.1;
      const magnitude = (this.signalLevel * 0.7 + Math.max(0, freqVar)) * radius * 0.4;
      
      const startX = centerX + Math.cos(angle) * baseRadius;
      const startY = centerY + Math.sin(angle) * baseRadius;
      const endX = centerX + Math.cos(angle) * (baseRadius + magnitude);
      const endY = centerY + Math.sin(angle) * (baseRadius + magnitude);
      
      this.eqBars.lineStyle(2, colorInt, 0.5 + this.signalLevel * 0.4);
      this.eqBars.lineBetween(startX, startY, endX, endY);
    }

    // 4. Update Center Glyph
    this.glyphText.setText(this.glyph);
    this.glyphText.setColor(this.schoolColor);
    const glyphPulse = 1 + this.signalLevel * 0.15;
    this.glyphText.setScale(glyphPulse);
    this.glyphText.setAlpha(0.3 + this.signalLevel * 0.6);

    // 5. Update Particles
    this.motes.setParticleColor(colorInt);

    // 6. Tuning Noise
    this.noiseGraphics.clear();
    if (this.isTuning) {
      this.noiseGraphics.fillStyle(0xffffff, 0.05);
      for (let i = 0; i < 40; i++) {
        const nx = centerX + (Math.random() - 0.5) * radius * 2;
        const ny = centerY + (Math.random() - 0.5) * radius * 2;
        const nw = Math.random() * 4 + 1;
        this.noiseGraphics.fillRect(nx, ny, nw, nw);
      }
    }
  }
}
