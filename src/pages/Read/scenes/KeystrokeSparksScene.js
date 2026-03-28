/**
 * KeystrokeSparksScene — typing spark particles + Truesight ring effects
 *
 * Performance: the particle emitter is pre-created in create() and reused for
 * every keystroke. It is only rebuilt when the school color changes (infrequent).
 * This eliminates the cost of this.add.particles() on every keypress.
 *
 * Public API:
 *   triggerSparks(x, y, colorHex)   — burst of sparks at (x, y) on keypress
 *   triggerBloom(x, y, colorHex)    — expanding ring pulse when Truesight activates
 *   triggerCollapse(x, y, colorHex) — contracting ring when Truesight deactivates
 */

function hexToNum(hex) {
  if (!hex || typeof hex !== 'string') return 0xc8a84b;
  const clean = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return 0xc8a84b;
  return parseInt(clean, 16);
}

export function buildSparksScene(Phaser) {
  return class KeystrokeSparksScene extends Phaser.Scene {
    constructor() {
      super({ key: 'KeystrokeSparksScene' });
      this._W = 0;
      this._H = 0;
      this._emitter = null;
      this._currentColor = 0xc8a84b;
    }

    preload() {
      if (this.textures.exists('kspark-dot')) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(3, 3, 3);
      g.generateTexture('kspark-dot', 6, 6);
      g.destroy();
    }

    create() {
      this._W = this.scale.width;
      this._H = this.scale.height;
      this._buildEmitter(this._currentColor);
    }

    /**
     * Build (or rebuild) the reusable spark emitter for a given color.
     * Called once at create() and again only when school color changes.
     */
    _buildEmitter(color) {
      if (this._emitter?.active) this._emitter.destroy();
      this._currentColor = color;
      try {
        this._emitter = this.add.particles(0, 0, 'kspark-dot', {
          speed:    { min: 25, max: 75 },
          angle:    { min: 200, max: 340 }, // upward arc
          scale:    { start: 0.6, end: 0 },
          alpha:    { start: 0.75, end: 0 },
          lifespan: { min: 250, max: 420 },
          quantity: 5,
          tint:     color,
          blendMode: 'ADD',
          frequency: -1, // manual explode only
        });
      } catch {
        this._emitter = null;
      }
    }

    /**
     * Emit a spark burst from (x, y). Reuses the pre-built emitter;
     * only rebuilds it when color changes (school switch).
     */
    triggerSparks(x, y, colorHex) {
      const color = hexToNum(colorHex);
      const cx = Number.isFinite(x) ? x : this._W / 2;
      const cy = Number.isFinite(y) ? y : this._H / 2;

      if (color !== this._currentColor) this._buildEmitter(color);
      if (!this._emitter) return;

      this._emitter.setPosition(cx, cy);
      this._emitter.explode(5);
    }

    /**
     * Expanding golden ring pulse — fired when Truesight activates.
     */
    triggerBloom(x, y, colorHex) {
      const color = hexToNum(colorHex || '#c8a84b');
      const cx = Number.isFinite(x) ? x : this._W / 2;
      const cy = Number.isFinite(y) ? y : this._H / 2;
      const maxR = Math.min(this._W, this._H) * 0.48;

      const g = this.add.graphics().setDepth(10);

      this.tweens.addCounter({
        from: 8,
        to: maxR,
        duration: 680,
        ease: 'Quad.easeOut',
        onUpdate: (tween) => {
          const r = tween.getValue();
          const progress = (r - 8) / (maxR - 8);
          g.clear();
          g.lineStyle(1.8, color, 0.85 * (1 - progress));
          g.strokeCircle(cx, cy, r);
          if (progress < 0.6) {
            g.lineStyle(0.8, color, 0.35 * (1 - progress / 0.6));
            g.strokeCircle(cx, cy, r * 0.72);
          }
        },
        onComplete: () => g.destroy(),
      });

      const flash = this.add.graphics().setDepth(9);
      flash.fillStyle(color, 0.07);
      flash.fillCircle(cx, cy, maxR * 0.5);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 500,
        ease: 'Quad.easeOut',
        onComplete: () => flash.destroy(),
      });
    }

    /**
     * Contracting ring ripple — fired when Truesight deactivates.
     */
    triggerCollapse(x, y, colorHex) {
      const color = hexToNum(colorHex);
      const cx = Number.isFinite(x) ? x : this._W / 2;
      const cy = Number.isFinite(y) ? y : this._H / 2;
      const startR = Math.min(this._W, this._H) * 0.35;

      const g = this.add.graphics().setDepth(10);

      this.tweens.addCounter({
        from: startR,
        to: 4,
        duration: 380,
        ease: 'Quad.easeIn',
        onUpdate: (tween) => {
          const r = tween.getValue();
          const progress = 1 - (r - 4) / (startR - 4);
          g.clear();
          g.lineStyle(1.2, color, 0.55 * (1 - progress));
          g.strokeCircle(cx, cy, r);
        },
        onComplete: () => g.destroy(),
      });
    }
  };
}
