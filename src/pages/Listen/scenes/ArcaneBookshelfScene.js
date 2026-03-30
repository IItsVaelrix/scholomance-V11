/**
 * ArcaneBookshelfScene.js — 3D perspective bookshelf for the Listen page side panels.
 *
 * Renders a pseudo-3D bookshelf with grimoire books, alchemical props,
 * candle flames, and a glowing orb — all reactive to school color and signal level.
 *
 * Use the factory: createArcaneBookshelfScene(side) → Scene class
 * Side: 'left' | 'right' — determines which depth face is visible.
 */

import Phaser from 'phaser';

// ── Canvas dimensions ─────────────────────────────────────────────────────────
const W = 320;
const H = 900;

// ── 3D perspective constants ──────────────────────────────────────────────────
const DEPTH   = 16;   // depth offset in px
const SLOPE   = 0.5;  // y-drop per depth unit (top face taper)

// ── Book palettes per tier ────────────────────────────────────────────────────
const BOOK_TIERS = [
  // Tier 0 — highest shelf (smallest books, tightest pack)
  [
    { w: 20, h: 88,  color: 0x0d2030, accent: 0x4a9aba, dot: true  },
    { w: 16, h: 74,  color: 0x200808, accent: 0xb8280b, dot: false },
    { w: 22, h: 96,  color: 0x0a0a1a, accent: 0xc9a227, dot: true  },
    { w: 15, h: 68,  color: 0x0a1808, accent: 0x27ae60, dot: false },
    { w: 19, h: 80,  color: 0x1a0e26, accent: 0x8e44ad, dot: true  },
    { w: 17, h: 72,  color: 0x1a1000, accent: 0xd4a017, dot: false },
    { w: 14, h: 64,  color: 0x0a1418, accent: 0x17a589, dot: false },
  ],
  // Tier 1
  [
    { w: 24, h: 108, color: 0x1a0e06, accent: 0xc9a227, dot: true  },
    { w: 18, h: 96,  color: 0x0a1a20, accent: 0x5dade2, dot: false },
    { w: 21, h: 102, color: 0x1a0626, accent: 0x9b59b6, dot: true  },
    { w: 16, h: 84,  color: 0x1c1a06, accent: 0xe8c93a, dot: false },
    { w: 26, h: 112, color: 0x061418, accent: 0x1abc9c, dot: true  },
    { w: 14, h: 78,  color: 0x180a0a, accent: 0xe74c3c, dot: false },
  ],
  // Tier 2
  [
    { w: 22, h: 104, color: 0x0a0a16, accent: 0x6e38c9, dot: true  },
    { w: 19, h: 92,  color: 0x1a0e00, accent: 0xd4a017, dot: false },
    { w: 25, h: 116, color: 0x061020, accent: 0x2e86c1, dot: true  },
    { w: 17, h: 86,  color: 0x1a0810, accent: 0xa93226, dot: true  },
    { w: 20, h: 98,  color: 0x0a1600, accent: 0x229954, dot: false },
    { w: 15, h: 76,  color: 0x16161e, accent: 0x5d6d7e, dot: false },
  ],
  // Tier 3 — lowest visible shelf
  [
    { w: 23, h: 110, color: 0x0e0a02, accent: 0xc9a227, dot: true  },
    { w: 18, h: 90,  color: 0x060c18, accent: 0x3498db, dot: false },
    { w: 21, h: 106, color: 0x1a0622, accent: 0x7d3c98, dot: true  },
    { w: 16, h: 80,  color: 0x0a1a10, accent: 0x1e8449, dot: false },
    { w: 24, h: 114, color: 0x0c0c0c, accent: 0xc9a227, dot: true  },
    { w: 17, h: 88,  color: 0x180a06, accent: 0xca6f1e, dot: false },
  ],
];

// ── Color helpers ─────────────────────────────────────────────────────────────
function hexToInt(hex) {
  return parseInt((hex || '#d5b34b').replace('#', ''), 16);
}

function darken(hexInt, amount) {
  const r = Math.max(0, ((hexInt >> 16) & 0xff) - amount);
  const g = Math.max(0, ((hexInt >> 8)  & 0xff) - amount);
  const b = Math.max(0, ( hexInt        & 0xff) - amount);
  return (r << 16) | (g << 8) | b;
}

function lighten(hexInt, amount) {
  const r = Math.min(255, ((hexInt >> 16) & 0xff) + amount);
  const g = Math.min(255, ((hexInt >> 8)  & 0xff) + amount);
  const b = Math.min(255, ( hexInt        & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}

// ── Factory ───────────────────────────────────────────────────────────────────
export function createArcaneBookshelfScene(side) {
  const isLeft = side === 'left';
  const KEY = `ArcaneBookshelf_${side}`;

  // Shelf geometry constants
  const FRAME_X     = 14;
  const FRAME_W     = W - 28;
  const FRAME_THICK = 12;
  const INNER_X     = FRAME_X + FRAME_THICK + 2;
  const INNER_W     = FRAME_W - FRAME_THICK * 2 - 4;

  // Tier Y positions (bottom of books / top of plank)
  const TIER_Y = [210, 390, 570, 760];

  // Prop anchor points
  const LANTERN_X = isLeft ? INNER_X + 16 : INNER_X + INNER_W - 28;
  const ORB_X     = isLeft ? INNER_X + INNER_W - 36 : INNER_X + 32;
  const CANDLE_X  = isLeft ? INNER_X + INNER_W * 0.52 : INNER_X + INNER_W * 0.48;

  // ── Scene class (closed over side) ─────────────────────────────────────────

  class ArcaneBookshelfScene extends Phaser.Scene {
    constructor() {
      super({ key: KEY });
      this._side        = side;
      this._isLeft      = isLeft;
      this._col         = 0xd5b34b;
      this._colHex      = '#d5b34b';
      this._isPlaying   = false;
      this._signalLevel = 0;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    create() {
      // Bake static geometry into a RenderTexture (zero runtime redraws)
      this._rtStatic = this.add.renderTexture(0, 0, W, H);
      this._bakeStatic();

      // Dynamic graphics object (updated every frame)
      this._gfxDyn = this.add.graphics();

      // Floating motes
      this._motes = Array.from({ length: 14 }, (_, i) => ({
        x:       INNER_X + 6 + (i * 19.3) % (INNER_W - 12),
        y:       80 + (i * 61.7) % (H - 160),
        vy:      -(0.18 + (i * 0.07) % 0.32),
        phase:   (i * 0.79) % (Math.PI * 2),
        size:    0.6 + (i * 0.11) % 1.0,
        alpha:   0.12 + (i * 0.019) % 0.22,
      }));
    }

    // ── Bake static layers ────────────────────────────────────────────────────

    _bakeStatic() {
      const g = this.make.graphics({ x: 0, y: 0, add: false });

      this._drawWall(g);
      this._drawFrame(g);
      for (let t = 0; t < TIER_Y.length; t++) {
        this._drawPlank(g, TIER_Y[t]);
        this._drawBooks(g, TIER_Y[t], BOOK_TIERS[t]);
      }
      this._drawLantern(g, LANTERN_X, TIER_Y[0] - 10);
      this._drawPotionVial(g, isLeft ? INNER_X + INNER_W - 28 : INNER_X + 8, TIER_Y[1] - 8);
      this._drawOrbStand(g, ORB_X, TIER_Y[2] - 12);

      this._rtStatic.draw(g, 0, 0);
      g.destroy();
    }

    // ── Wall ─────────────────────────────────────────────────────────────────

    _drawWall(g) {
      // Base
      g.fillStyle(0x05070e, 1);
      g.fillRect(0, 0, W, H);

      // Stone course horizontal lines
      for (let y = 0; y < H; y += 36) {
        g.lineStyle(1, 0x0f1218, 0.7);
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath();
      }
      // Vertical mortar joints (offset per course)
      for (let row = 0; row < H / 36; row++) {
        const offset = (row % 2) * 54;
        for (let x = offset; x < W; x += 108) {
          g.lineStyle(1, 0x0f1218, 0.5);
          g.beginPath();
          g.moveTo(x, row * 36);
          g.lineTo(x, row * 36 + 36);
          g.strokePath();
        }
      }

      // Edge gradient — darker toward edges
      if (isLeft) {
        for (let x = 0; x < 32; x++) {
          g.fillStyle(0x000000, (32 - x) / 32 * 0.5);
          g.fillRect(W - 32 + x, 0, 1, H);
        }
      } else {
        for (let x = 0; x < 32; x++) {
          g.fillStyle(0x000000, x / 32 * 0.5);
          g.fillRect(x, 0, 1, H);
        }
      }
    }

    // ── Frame ─────────────────────────────────────────────────────────────────

    _drawFrame(g) {
      const wood1 = 0x1c0e06;  // dark face
      const wood2 = 0x2d1a0a;  // mid face
      const wood3 = 0x3a2010;  // lighter edge
      const brass = 0x7a5e14;
      const brassLight = 0xaa8822;

      // ── 3D side depth of the outer frame posts ────────────────────────────
      const sideDepth = DEPTH;
      const slopeDY   = Math.round(sideDepth * SLOPE);

      if (isLeft) {
        // Depth face on RIGHT side of left frame
        g.fillStyle(darken(wood1, 20), 1);
        // Right post side
        g.fillRect(FRAME_X + FRAME_W, 0, sideDepth, H);
        // Shading gradient (fake)
        for (let d = 0; d < sideDepth; d++) {
          g.fillStyle(0x000000, (1 - d / sideDepth) * 0.4);
          g.fillRect(FRAME_X + FRAME_W + d, 0, 1, H);
        }
      } else {
        // Depth face on LEFT side of right frame
        g.fillStyle(darken(wood1, 20), 1);
        g.fillRect(FRAME_X - sideDepth, 0, sideDepth, H);
        for (let d = 0; d < sideDepth; d++) {
          g.fillStyle(0x000000, d / sideDepth * 0.4);
          g.fillRect(FRAME_X - sideDepth + d, 0, 1, H);
        }
      }

      // ── Front face — left post ─────────────────────────────────────────────
      g.fillStyle(wood2, 1);
      g.fillRect(FRAME_X, 0, FRAME_THICK, H);
      // Highlight edge
      g.fillStyle(wood3, 1);
      g.fillRect(FRAME_X, 0, 2, H);

      // ── Front face — right post ────────────────────────────────────────────
      g.fillStyle(wood2, 1);
      g.fillRect(FRAME_X + FRAME_W - FRAME_THICK, 0, FRAME_THICK, H);
      g.fillStyle(wood3, 1);
      g.fillRect(FRAME_X + FRAME_W - 2, 0, 2, H);

      // ── Top bar ───────────────────────────────────────────────────────────
      g.fillStyle(wood2, 1);
      g.fillRect(FRAME_X, 0, FRAME_W, FRAME_THICK + 2);
      // Top face of top bar (3D)
      g.fillStyle(wood3, 1);
      g.fillRect(FRAME_X, 0, FRAME_W, 3);

      // ── Bottom bar ────────────────────────────────────────────────────────
      g.fillStyle(wood2, 1);
      g.fillRect(FRAME_X, H - FRAME_THICK, FRAME_W, FRAME_THICK);

      // ── Wood grain texture on posts ───────────────────────────────────────
      g.lineStyle(1, wood1, 0.35);
      for (let y = 10; y < H; y += 9) {
        g.beginPath(); g.moveTo(FRAME_X + 3, y);       g.lineTo(FRAME_X + FRAME_THICK - 3, y); g.strokePath();
        g.beginPath(); g.moveTo(FRAME_X + FRAME_W - FRAME_THICK + 3, y); g.lineTo(FRAME_X + FRAME_W - 3, y); g.strokePath();
      }

      // ── Brass corner accents ──────────────────────────────────────────────
      const corners = [
        [FRAME_X, 0],
        [FRAME_X + FRAME_W - 14, 0],
        [FRAME_X, H - 14],
        [FRAME_X + FRAME_W - 14, H - 14],
      ];
      for (const [cx, cy] of corners) {
        g.fillStyle(brass, 1);
        g.fillRect(cx, cy, 14, 14);
        g.fillStyle(brassLight, 0.7);
        g.fillRect(cx + 2, cy + 2, 6, 6);
        g.lineStyle(1, darken(brass, 30), 0.8);
        g.strokeRect(cx, cy, 14, 14);
      }

      // ── Mid-frame horizontal rail ─────────────────────────────────────────
      for (const railY of [TIER_Y[0] - 140, TIER_Y[2] - 140]) {
        g.fillStyle(wood1, 1);
        g.fillRect(FRAME_X, railY, FRAME_W, 6);
        g.fillStyle(wood3, 0.4);
        g.fillRect(FRAME_X, railY, FRAME_W, 1);
        // Brass brackets
        for (const bx of [FRAME_X + FRAME_THICK, FRAME_X + FRAME_W / 2 - 8, FRAME_X + FRAME_W - FRAME_THICK - 16]) {
          g.fillStyle(brass, 0.8);
          g.fillRect(bx, railY - 2, 16, 10);
          g.lineStyle(1, darken(brass, 20), 0.6);
          g.strokeRect(bx, railY - 2, 16, 10);
        }
      }
    }

    // ── Shelf plank ───────────────────────────────────────────────────────────

    _drawPlank(g, y) {
      const wood2    = 0x2d1a0a;
      const woodTop  = 0x402418;
      const woodEdge = 0x180c04;
      const plankH   = 11;
      const topH     = Math.round(DEPTH * SLOPE);

      // 3D top face of plank
      g.fillStyle(woodTop, 1);
      g.fillRect(INNER_X, y - plankH - topH, INNER_W, topH + 1);
      // Highlight line
      g.fillStyle(0xffffff, 0.04);
      g.fillRect(INNER_X, y - plankH - topH, INNER_W, 1);

      // Front face
      g.fillStyle(wood2, 1);
      g.fillRect(INNER_X, y - plankH, INNER_W, plankH);

      // Bottom shadow edge
      g.fillStyle(woodEdge, 1);
      g.fillRect(INNER_X, y, INNER_W, 2);

      // Wood grain on front face
      g.lineStyle(1, 0x180c04, 0.3);
      for (let x = INNER_X; x < INNER_X + INNER_W; x += 14) {
        g.beginPath(); g.moveTo(x, y - plankH); g.lineTo(x, y); g.strokePath();
      }
    }

    // ── Books ─────────────────────────────────────────────────────────────────

    _drawBooks(g, tierY, books) {
      let x = INNER_X + 4;
      const plankH = 11;
      const topH   = 4; // book top face height

      for (const book of books) {
        if (x + book.w + 4 > INNER_X + INNER_W) break;

        const bx = x;
        const by = tierY - plankH - book.h;

        // ── 3D depth side face ───────────────────────────────────────────────
        const sideFaceColor = darken(book.color, 18);
        if (isLeft) {
          // Right-side depth face
          for (let d = 0; d < 4; d++) {
            g.fillStyle(sideFaceColor, 1 - d * 0.18);
            g.fillRect(bx + book.w + d, by + d, 1, book.h - d);
          }
        } else {
          // Left-side depth face
          for (let d = 0; d < 4; d++) {
            g.fillStyle(sideFaceColor, 1 - d * 0.18);
            g.fillRect(bx - 1 - d, by + d, 1, book.h - d);
          }
        }

        // ── Top face ─────────────────────────────────────────────────────────
        g.fillStyle(lighten(book.color, 14), 1);
        g.fillRect(bx, by - topH, book.w, topH);
        g.fillStyle(0xffffff, 0.06);
        g.fillRect(bx, by - topH, book.w, 1);

        // ── Spine (front face) ────────────────────────────────────────────────
        g.fillStyle(book.color, 1);
        g.fillRect(bx, by, book.w, book.h);

        // Spine inner bevel
        g.fillStyle(lighten(book.color, 8), 0.5);
        g.fillRect(bx, by, 1, book.h);

        // ── Gold border on spine ───────────────────────────────────────────────
        g.lineStyle(1, book.accent, 0.55);
        g.strokeRect(bx + 2, by + 5, book.w - 4, book.h - 10);

        // ── Top/bottom accent bars ─────────────────────────────────────────────
        g.fillStyle(book.accent, 0.35);
        g.fillRect(bx + 3, by + 4, book.w - 6, 1);
        g.fillRect(bx + 3, by + book.h - 5, book.w - 6, 1);

        // ── Center glyph (dot + ring for narrow, larger for wide) ─────────────
        if (book.dot) {
          const cx = bx + book.w / 2;
          const cy = by + book.h / 2;
          g.fillStyle(book.accent, 0.72);
          g.fillCircle(cx, cy, 2.5);
          g.lineStyle(1, book.accent, 0.4);
          g.strokeCircle(cx, cy, 4.5);
        }

        // ── Horizontal text lines (decorative) ────────────────────────────────
        g.fillStyle(book.accent, 0.18);
        for (let ly = by + 14; ly < by + book.h - 14; ly += 6) {
          g.fillRect(bx + 4, ly, book.w - 8, 1);
        }

        x += book.w + 3;
      }
    }

    // ── Lantern prop ──────────────────────────────────────────────────────────

    _drawLantern(g, lx, ly) {
      const cx = lx + 12;
      const brass = 0x8a6e1e;
      const brassLight = 0xb89030;
      const glass = 0x1a1006;

      // Base
      g.fillStyle(brass, 1);
      g.fillRect(cx - 8, ly + 50, 16, 5);
      g.fillRect(cx - 5, ly + 55, 10, 3);

      // Stem
      g.fillStyle(brass, 1);
      g.fillRect(cx - 2, ly + 28, 4, 22);

      // Body frame
      g.fillStyle(brass, 1);
      g.fillRect(cx - 10, ly + 10, 20, 38);

      // Glass panels (dark with slight glow)
      g.fillStyle(glass, 1);
      g.fillRect(cx - 8, ly + 13, 16, 32);

      // Top cap
      g.fillStyle(brass, 1);
      g.fillRect(cx - 10, ly + 8, 20, 5);
      g.fillTriangle(cx - 6, ly + 8, cx + 6, ly + 8, cx, ly);

      // Brass corner rivets
      g.fillStyle(brassLight, 1);
      for (const [rx, ry] of [[cx - 9, ly + 12], [cx + 7, ly + 12], [cx - 9, ly + 40], [cx + 7, ly + 40]]) {
        g.fillCircle(rx, ry, 1.5);
      }

      // Hanging chain
      g.lineStyle(1, brass, 0.6);
      for (let hy = ly - 20; hy < ly; hy += 5) {
        g.fillStyle(brass, 0.5);
        g.fillCircle(cx, hy, 1.2);
      }
    }

    // ── Potion vial ───────────────────────────────────────────────────────────

    _drawPotionVial(g, vx, vy) {
      const cx = vx + 9;
      // Body
      g.fillStyle(0x0a0a10, 1);
      g.fillEllipse(cx, vy + 28, 18, 24);
      // Liquid fill (teal)
      g.fillStyle(0x0a4a40, 1);
      g.fillEllipse(cx, vy + 31, 14, 16);
      g.fillStyle(0x00cfc8, 0.25);
      g.fillEllipse(cx, vy + 29, 12, 12);
      // Neck
      g.fillStyle(0x0a0a10, 1);
      g.fillRect(cx - 4, vy + 10, 8, 12);
      // Cork
      g.fillStyle(0x6b4226, 1);
      g.fillRect(cx - 3, vy + 8, 6, 6);
      // Shine
      g.fillStyle(0xffffff, 0.08);
      g.fillEllipse(cx - 3, vy + 24, 5, 8);
    }

    // ── Orb stand (static base — glow is dynamic) ─────────────────────────────

    _drawOrbStand(g, ox, oy) {
      const cx = ox + 18;
      const wood2 = 0x2d1a0a;
      const brass  = 0x8a6e1e;

      // Stand base
      g.fillStyle(wood2, 1);
      g.fillRect(cx - 16, oy + 18, 32, 6);
      g.fillStyle(wood2, 1);
      g.fillRect(cx - 12, oy + 14, 24, 6);
      // Pedestal collar
      g.fillStyle(brass, 1);
      g.lineStyle(1, brass, 0.8);
      g.strokeCircle(cx, oy + 12, 14);
      // Three claw brackets
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const bx = cx + Math.cos(angle) * 12;
        const by = oy + 12 + Math.sin(angle) * 12;
        g.fillStyle(brass, 0.9);
        g.fillCircle(bx, by, 2);
      }
    }

    // ── Update (public API, called from React) ────────────────────────────────

    updateState({ schoolColor, isPlaying, signalLevel }) {
      if (schoolColor) {
        this._colHex = schoolColor;
        this._col    = hexToInt(schoolColor);
      }
      this._isPlaying   = isPlaying   ?? this._isPlaying;
      this._signalLevel = signalLevel ?? this._signalLevel;
    }

    // ── Game loop ─────────────────────────────────────────────────────────────

    update(time) {
      this._gfxDyn.clear();

      // Floating motes
      this._updateMotes(time);

      // Dynamic lantern glow
      this._drawLanternGlow(this._gfxDyn, LANTERN_X + 12, TIER_Y[0] - 10 + 28, time);

      // Dynamic orb glow
      this._drawOrbGlow(this._gfxDyn, ORB_X + 18, TIER_Y[2] - 12 + 6, time);

      // Candle (bottom area)
      this._drawCandleDynamic(this._gfxDyn, CANDLE_X, TIER_Y[3] + 60, time);

      // Edge ambient light reactive to signal
      if (this._signalLevel > 0.05) {
        const alpha = this._signalLevel * 0.08;
        this._gfxDyn.fillStyle(this._col, alpha);
        if (isLeft) {
          this._gfxDyn.fillRect(W - 3, 0, 3, H);
        } else {
          this._gfxDyn.fillRect(0, 0, 3, H);
        }
      }
    }

    _updateMotes(time) {
      for (const m of this._motes) {
        m.y += m.vy;
        m.x += Math.sin(time * 0.00085 + m.phase) * 0.28;
        if (m.y < -8) {
          m.y = H + 4;
          m.x = INNER_X + 4 + Math.random() * (INNER_W - 8);
        }
        const pulse = 0.55 + Math.sin(time * 0.0018 + m.phase) * 0.45;
        this._gfxDyn.fillStyle(this._col, m.alpha * pulse);
        this._gfxDyn.fillCircle(m.x, m.y, m.size);
      }
    }

    _drawLanternGlow(g, cx, cy, time) {
      const flicker = 0.82 + Math.sin(time * 0.011) * 0.1 + Math.sin(time * 0.027) * 0.08;
      const r = 22 * flicker;

      // Warm glow bloom
      g.fillStyle(0xd47a1c, 0.06 * flicker);
      g.fillCircle(cx, cy, r * 2.2);
      g.fillStyle(0xffa040, 0.22 * flicker);
      g.fillCircle(cx, cy, r);
      g.fillStyle(0xffee88, 0.55 * flicker);
      g.fillCircle(cx, cy, r * 0.42);
      g.fillStyle(0xffffff, 0.2 * flicker);
      g.fillCircle(cx, cy, r * 0.18);

      // Cast light on nearby shelf
      g.fillStyle(0xd47a1c, 0.04 * flicker);
      g.fillRect(cx - 30, cy - 10, 60, 40);
    }

    _drawOrbGlow(g, cx, cy, time) {
      const sig    = 0.38 + this._signalLevel * 0.62;
      const pulse  = 0.7 + Math.sin(time * 0.0028) * 0.3;
      const r      = 16;

      // Outer nebula glow
      g.fillStyle(this._col, 0.055 * pulse * sig);
      g.fillCircle(cx, cy, r * 3.2);
      g.fillStyle(this._col, 0.1 * pulse * sig);
      g.fillCircle(cx, cy, r * 2);

      // Orb body
      g.fillStyle(0x08060e, 1);
      g.fillCircle(cx, cy, r);

      // Inner galaxy texture (three radial blobs)
      g.fillStyle(this._col, 0.55 * pulse * sig);
      g.fillCircle(cx - 3, cy - 3, r * 0.45);
      g.fillStyle(darken(this._col, 40), 0.3 * pulse);
      g.fillCircle(cx + 4, cy + 2, r * 0.32);

      // Orb ring
      g.lineStyle(1.5, this._col, 0.7 * pulse);
      g.strokeCircle(cx, cy, r);
      g.lineStyle(1, this._col, 0.28 * pulse);
      g.strokeCircle(cx, cy, r + 4);

      // Shine
      g.fillStyle(0xffffff, 0.12);
      g.fillCircle(cx - 5, cy - 5, 4);

      // Playing state extra pulse ring
      if (this._isPlaying) {
        const pr = r + 8 + Math.sin(time * 0.005) * 4;
        g.lineStyle(1, this._col, 0.2 * pulse);
        g.strokeCircle(cx, cy, pr);
      }
    }

    _drawCandleDynamic(g, cx, cy, time) {
      const flicker = 0.86 + Math.sin(time * 0.013) * 0.08 + Math.sin(time * 0.034) * 0.06;
      const fx = cx + Math.sin(time * 0.008) * 1.2;
      const fy = cy - 4;

      // Candle body
      g.fillStyle(0xf0e0c0, 1);
      g.fillRect(cx - 4, cy - 26, 8, 26);
      // Wax drips
      g.fillStyle(0xe8d4a8, 1);
      g.fillRect(cx - 5, cy - 24, 3, 4);
      g.fillRect(cx + 3, cy - 20, 3, 6);
      // Base
      g.fillStyle(0x8a6e1e, 1);
      g.fillRect(cx - 7, cy, 14, 4);
      g.fillRect(cx - 5, cy + 4, 10, 2);

      // Flame glow
      g.fillStyle(this._col, 0.07 * flicker);
      g.fillEllipse(fx, fy - 10, 44, 44);
      g.fillStyle(0xd47a1c, 0.08 * flicker);
      g.fillEllipse(fx, fy - 4, 28, 28);

      // Flame body
      g.fillStyle(0xff8c1a, 0.85 * flicker);
      g.fillEllipse(fx, fy - 8, 9, 16);
      g.fillStyle(0xffdd44, 0.9 * flicker);
      g.fillEllipse(fx, fy - 10, 5, 11);
      g.fillStyle(0xffffff, 0.55 * flicker);
      g.fillEllipse(fx, fy - 11, 2.5, 6);
    }
  }

  return ArcaneBookshelfScene;
}
