/**
 * IDEAmbientScene — soft arcane ambient layer for the Scholomance IDE
 *
 * Non-interactive Phaser scene rendered as a transparent background canvas.
 * - School-tinted floating motes (ADD blend, very low alpha)
 * - Soft radial bloom centered in the editor
 * - Thin corner arc fragments rotating slowly
 *
 * Public API: setSchoolColor(hex: string)
 */

function hexToNum(hex) {
  if (!hex || typeof hex !== 'string') return 0xc8a84b;
  const clean = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return 0xc8a84b;
  return parseInt(clean, 16);
}

export function buildAmbientScene(Phaser) {
  return class IDEAmbientScene extends Phaser.Scene {
    constructor() {
      super({ key: 'IDEAmbientScene' });
      this._colorHex = '#c8a84b';
      this._color = 0xc8a84b;
      this._W = 0;
      this._H = 0;
      this._bloom = null;
      this._motes = [];
    }

    create() {
      this._W = this.scale.width;
      this._H = this.scale.height;
      this._initDotTexture();
      this._buildMotes();
    }

    _initDotTexture() {
      if (this.textures.exists('iamb-dot')) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture('iamb-dot', 8, 8);
      g.destroy();
    }

    _buildMotes() {
      for (const m of this._motes) m.obj?.destroy();
      this._motes = [];

      for (let i = 0; i < 12; i++) {
        const baseAlpha = Math.random() * 0.055 + 0.012;
        const startX = Math.random() * this._W;
        const startY = Math.random() * this._H;
        
        const obj = this.add.image(startX, startY, 'iamb-dot')
          .setAlpha(baseAlpha)
          .setScale(Math.random() * 0.85 + 0.2)
          .setTint(this._color)
          .setDepth(1)
          .setBlendMode('ADD');

        // Slow breathing alpha tween per mote (Phaser tweens are absolute-time managed)
        this.tweens.add({
          targets: obj,
          alpha: { from: baseAlpha * 0.25, to: baseAlpha * 1.7 },
          duration: 4500 + Math.random() * 7000,
          repeat: -1,
          yoyo: true,
          ease: 'Sine.easeInOut',
          delay: Math.random() * 6000,
        });

        this._motes.push({
          obj,
          startX,
          startY,
          // Absolute velocity in pixels per second
          vxp: (Math.random() - 0.5) * 8,
          vyp: -(Math.random() * 15 + 5),
        });
      }
    }

    update(time) {
      const t = time * 0.001; // absolute time in seconds
      const padding = 20;
      const boundsW = this._W + padding * 2;
      const boundsH = this._H + padding * 2;

      for (const m of this._motes) {
        // Position = (Start + Velocity * Time) mod Bounds
        // We use absolute time to ensure determinism and frame-rate independence.
        let x = (m.startX + padding + m.vxp * t) % boundsW;
        let y = (m.startY + padding + m.vyp * t) % boundsH;
        
        // Handle negative modulo for wrapping
        if (x < 0) x += boundsW;
        if (y < 0) y += boundsH;

        m.obj.setPosition(x - padding, y - padding);
      }
    }

    /**
     * Called by IDEAmbientCanvas when the active school changes.
     * Rebuilds all colored elements with the new hue.
     */
    setSchoolColor(hex) {
      if (!hex || hex === this._colorHex) return;
      this._colorHex = hex;
      this._color = hexToNum(hex);
      this._buildMotes();
    }
  };
}
