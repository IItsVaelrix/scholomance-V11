/**
 * KeystrokeSparksScene — typing spark particles + Truesight ring effects
 *
 * Non-interactive Phaser scene overlaid on the scroll editor area.
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
    }

    /**
     * Emit a small burst of sparks from the cursor position.
     * Called on every printable keypress.
     */
    triggerSparks(x, y, colorHex) {
      const color = hexToNum(colorHex);
      const cx = Number.isFinite(x) ? x : this._W / 2;
      const cy = Number.isFinite(y) ? y : this._H / 2;

      try {
        const emitter = this.add.particles(cx, cy, 'kspark-dot', {
          speed: { min: 25, max: 75 },
          angle: { min: 200, max: 340 }, // upward arc, slightly randomized
          scale: { start: 0.6, end: 0 },
          alpha: { start: 0.75, end: 0 },
          lifespan: { min: 250, max: 420 },
          quantity: 5,
          tint: color,
          blendMode: 'ADD',
          frequency: -1,
        });
        emitter.explode(5);
        // Self-destruct after the longest possible lifespan
        this.time.delayedCall(480, () => {
          if (emitter?.active) emitter.destroy();
        });
      } catch {
        /* Particle system unavailable — degrade gracefully */
      }
    }

    /**
     * Expanding golden ring pulse — fired when Truesight activates.
     * Radius animates outward; alpha fades to 0.
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
          // Second ring, slightly offset
          if (progress < 0.6) {
            g.lineStyle(0.8, color, 0.35 * (1 - progress / 0.6));
            g.strokeCircle(cx, cy, r * 0.72);
          }
        },
        onComplete: () => g.destroy(),
      });

      // Inner area flash
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
