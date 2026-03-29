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
      this._buildBloom();
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

    _buildBloom() {
      if (this._bloom) { this._bloom.destroy(); this._bloom = null; }
      const g = this.add.graphics().setDepth(0);
      // Soft multi-layer radial fade
      for (let i = 6; i > 0; i--) {
        const r = Math.min(this._W, this._H) * 0.65 * (i / 6);
        g.fillStyle(this._color, 0.007 * i);
        g.fillCircle(this._W / 2, this._H / 2, r);
      }
      this._bloom = g;
      this.tweens.add({
        targets: g,
        alpha: { from: 0.5, to: 1.0 },
        duration: 9200,
        repeat: -1,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    }

    _buildMotes() {
      for (const m of this._motes) m.obj?.destroy();
      this._motes = [];

      for (let i = 0; i < 12; i++) {
        const baseAlpha = Math.random() * 0.055 + 0.012;
        const obj = this.add.image(
          Math.random() * this._W,
          Math.random() * this._H,
          'iamb-dot'
        )
          .setAlpha(baseAlpha)
          .setScale(Math.random() * 0.85 + 0.2)
          .setTint(this._color)
          .setDepth(1)
          .setBlendMode('ADD');

        // Slow breathing alpha tween per mote
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
          vy: -(Math.random() * 0.2 + 0.04),
          vx: (Math.random() - 0.5) * 0.1,
        });
      }
    }

    update() {
      // Drift motes upward and wrap vertically
      for (const m of this._motes) {
        m.obj.x += m.vx;
        m.obj.y += m.vy;
        if (m.obj.y < -10)               m.obj.y = this._H + 10;
        if (m.obj.x < -10)               m.obj.x = this._W + 10;
        else if (m.obj.x > this._W + 10) m.obj.x = -10;
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
      this._buildBloom();
      this._buildMotes();
    }
  };
}
