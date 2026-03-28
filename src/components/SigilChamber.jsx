/**
 * SigilChamber — Phaser-powered ritual circle visualization
 *
 * Renders a living sigil: rotating rune rings, syllable-count orbital nodes,
 * school glyph at center, ADD-blend particles.
 *
 * Phaser is loaded via dynamic import so the module is safe in test/SSR
 * environments where canvas APIs are unavailable.
 */
import { useEffect, useRef } from "react";

/* ── Color util (no Phaser dep) ───────────────────────────────────────────── */
function hexToNum(hex) {
  if (!hex || typeof hex !== "string") return 0xc8a84b;
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return 0xc8a84b;
  return parseInt(clean, 16);
}

/* ── Scene factory — receives Phaser as argument so no top-level import ──── */
function buildSceneClass(Phaser, initData) {
  return class SigilScene extends Phaser.Scene {
    constructor() {
      super({ key: "SigilScene" });
      this.d       = initData;
      this.outerC  = null;
      this.midC    = null;
      this.innerC  = null;
      this.glyphT  = null;
      this.emitter = null;
      this.R = 0; this.cx = 0; this.cy = 0;
    }

    preload() {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(5, 5, 5);
      g.generateTexture("sdot", 10, 10);
      g.destroy();
    }

    create() {
      const W = this.scale.width;
      const H = this.scale.height;
      this.cx = W / 2;
      this.cy = H / 2;
      this.R  = Math.min(W, H) * 0.43;
      this._starfield(W, H);
      this._build();
      this._enter();
    }

    _starfield(W, H) {
      const g = this.add.graphics().setDepth(0);
      for (let i = 0; i < 30; i++) {
        g.fillStyle(0xffffff, Math.random() * 0.32 + 0.05);
        g.fillCircle(Math.random() * W, Math.random() * H, Math.random() * 1.2 + 0.2);
      }
      this.tweens.add({
        targets: g, alpha: { from: 0.55, to: 1 },
        duration: 4800, repeat: -1, yoyo: true, ease: "Sine.easeInOut",
      });
    }

    _build() {
      const { color, glyph, syllables } = this.d;
      const cn = hexToNum(color);
      const { cx, cy, R } = this;

      /* Outer ring — CW rotation */
      this.outerC = this.add.container(cx, cy).setDepth(2);
      const og = this.add.graphics();
      og.lineStyle(1.5, cn, 0.48);
      og.strokeCircle(0, 0, R);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const px = Math.cos(a) * R, py = Math.sin(a) * R;
        if (i % 3 === 0) {
          og.fillStyle(cn, 0.88);
          og.fillCircle(px, py, 2.8);
          og.lineStyle(0.8, cn, 0.42);
          og.lineBetween(px, py, Math.cos(a) * (R - 9), Math.sin(a) * (R - 9));
        } else {
          og.fillStyle(cn, 0.24);
          og.fillCircle(px, py, 1.4);
        }
      }
      this.outerC.add(og);
      this.tweens.add({ targets: this.outerC, rotation: Math.PI * 2, duration: 34000, repeat: -1, ease: "Linear" });

      /* Mid ring — syllable nodes, CCW */
      this.midC = this.add.container(cx, cy).setDepth(3);
      const mg   = this.add.graphics();
      const midR = R * 0.65;
      mg.lineStyle(1, cn, 0.28);
      mg.strokeCircle(0, 0, midR);
      const syl = Math.max(1, Math.min(syllables || 1, 8));
      for (let i = 0; i < syl; i++) {
        const a  = (i / syl) * Math.PI * 2 - Math.PI / 2;
        const sx = Math.cos(a) * midR, sy = Math.sin(a) * midR;
        mg.fillStyle(cn, 0.9);
        mg.fillCircle(sx, sy, 4.2);
        mg.lineStyle(0.65, cn, 0.22);
        mg.strokeCircle(sx, sy, 8);
      }
      this.midC.add(mg);
      this.tweens.add({ targets: this.midC, rotation: -(Math.PI * 2), duration: 21000, repeat: -1, ease: "Linear" });

      /* Inner ring — static double ring + 3-line seal */
      this.innerC = this.add.container(cx, cy).setDepth(4);
      const ig = this.add.graphics();
      const iR = R * 0.36;
      ig.lineStyle(2, cn, 0.72);
      ig.strokeCircle(0, 0, iR);
      ig.lineStyle(0.65, cn, 0.2);
      ig.strokeCircle(0, 0, iR + 5);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ig.lineStyle(0.4, cn, 0.12);
        ig.lineBetween(
          Math.cos(a) * iR * 0.86, Math.sin(a) * iR * 0.86,
          -Math.cos(a) * iR * 0.86, -Math.sin(a) * iR * 0.86
        );
      }
      this.innerC.add(ig);

      /* Center glyph — breathing pulse */
      this.glyphT?.destroy();
      const fs = Math.max(18, Math.round(iR * 1.1));
      this.glyphT = this.add
        .text(cx, cy, glyph || "✦", {
          fontFamily: '"Apple Color Emoji","Segoe UI Emoji",serif',
          fontSize: `${fs}px`,
          color: color || "#c8a84b",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(6);
      this.tweens.add({
        targets: this.glyphT,
        scaleX: { from: 0.9, to: 1.12 }, scaleY: { from: 0.9, to: 1.12 },
        duration: 3800, repeat: -1, yoyo: true, ease: "Sine.easeInOut",
      });

      /* Particles — drift from inner ring */
      this.emitter?.destroy();
      try {
        this.emitter = this.add.particles(cx, cy, "sdot", {
          speed: { min: 8, max: 38 },
          scale: { start: 0.26, end: 0 },
          alpha: { start: 0.55, end: 0 },
          lifespan: 2200, frequency: 160, quantity: 1,
          emitZone: { type: "edge", source: new Phaser.Geom.Circle(0, 0, iR * 0.9), quantity: 8 },
          tint: cn, blendMode: "ADD",
        }).setDepth(5);
      } catch {
        /* Particle system is an enhancement — degrade gracefully */
      }
    }

    _enter() {
      [this.outerC, this.midC, this.innerC].forEach((c, i) => {
        if (!c) return;
        c.setScale(0).setAlpha(0);
        this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, alpha: 1, duration: 580, delay: i * 90, ease: "Back.easeOut" });
      });
      if (this.glyphT) {
        this.glyphT.setAlpha(0).setScale(0.5);
        this.tweens.add({ targets: this.glyphT, alpha: 1, scaleX: 1, scaleY: 1, duration: 440, delay: 270, ease: "Back.easeOut" });
      }
    }

    updateWord(nd) {
      this.d = nd;
      const targets = [this.outerC, this.midC, this.innerC, this.glyphT, this.emitter].filter(Boolean);
      this.tweens.add({
        targets, alpha: 0, scaleX: 0.62, scaleY: 0.62,
        duration: 160, ease: "Quad.easeIn",
        onComplete: () => {
          [this.outerC, this.midC, this.innerC, this.glyphT, this.emitter].forEach(o => o?.destroy());
          this.outerC = this.midC = this.innerC = this.glyphT = this.emitter = null;
          this._build();
          this._enter();
        },
      });
    }
  };
}

/* ── React wrapper ────────────────────────────────────────────────────────── */
export default function SigilChamber({ color, glyph, syllables, word }) {
  const elRef          = useRef(null);
  const gameRef        = useRef(null);
  const latestDataRef  = useRef({ color, glyph, syllables, word });

  /* Track latest props so pending updates are applied after Phaser loads */
  useEffect(() => {
    latestDataRef.current = { color, glyph, syllables, word };
  }, [color, glyph, syllables, word]);

  /* Create Phaser game once — dynamic import keeps jsdom/SSR safe */
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let alive = true;

    import("phaser")
      .then(({ default: Phaser }) => {
        if (!alive) return;
        const W = el.offsetWidth  || 370;
        const H = el.offsetHeight || 160;
        const { color: c, glyph: g, syllables: s } = latestDataRef.current;

        const game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: el,
          width: W, height: H,
          transparent: true,
          antialias: true,
          scene: [buildSceneClass(Phaser, { color: c, glyph: g, syllables: s || 1 })],
          audio: { noAudio: true },
          scale: { mode: Phaser.Scale.NONE },
          banner: false,
        });

        game.events.once("ready", () => {
          if (!alive) { game.destroy(true); return; }
          if (game.canvas) game.canvas.style.pointerEvents = "none";
          gameRef.current = game;
        });
      })
      .catch(() => {
        /* Phaser unavailable (test env / no WebGL) — sigil chamber renders empty */
      });

    return () => {
      alive = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Push word updates into the live scene */
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    const scene = game.scene.getScene("SigilScene");
    if (scene?.updateWord) {
      scene.updateWord({ color, glyph, syllables: syllables || 1 });
    }
  }, [color, glyph, syllables, word]);

  return (
    <div
      ref={elRef}
      className="sigil-chamber"
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    />
  );
}
