/**
 * BattleScene.js — Phaser 3 Scene
 * The entire visual game world: backdrop, sprites, HP bars, menus, animations.
 *
 * Communicates with React exclusively via combatBridge.
 * Never imports React. Never touches the DOM outside the Phaser canvas.
 *
 * SNES Final Fantasy VI aesthetic × Scholomance grimoire visual language.
 */

import Phaser from 'phaser';
import { combatBridge } from '../combatBridge.js';

const W = 800;
const H = 480;
const PANEL_Y = 302;     // Where the bottom UI panel begins
const PANEL_H = H - PANEL_Y;
const MENU_W = 260;

const SONIC_PURPLE = 0x651fff;
const GOLD = 0xc9a227;
const VOID_DARK = 0x0a0810;
const PARCHMENT = 0x1a1208;
const PANEL_BG = 0x0d0b08;
const TEXT_PRIMARY = '#c9a227';
const TEXT_DIM = '#6b5a2a';
const TEXT_WHITE = '#e8dfc8';
const TEXT_SONIC = '#651fff';
const TEXT_OPPONENT = '#00e5ff';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleScene' });
  }

  // ─── State ────────────────────────────────────────────────────────────────

  playerHP = 1000; maxPlayerHP = 1000;
  playerMP = 100;  maxPlayerMP = 100;
  opponentHP = 1500; maxOpponentHP = 1500;
  playerName = 'Scholar';
  opponentName = 'The Cryptonym';
  menuEnabled = false;
  cursorIndex = 0;
  MENU_ITEMS = ['INSCRIBE SPELL', 'FLEE'];

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create() {
    this.createBackground();
    this.createFloor();
    this.createBackgroundSigil();
    this.createOpponentSprite();
    this.createPlayerSprite();
    this.createOpponentInfoBar();
    this.createBottomPanel();
    this.createBattleMenu();
    this.createStatsPanel();
    this.createMessageWindow();
    this.setupBridgeListeners();
    this.playIntroSequence();
  }

  // ─── Background ────────────────────────────────────────────────────────────

  createBackground() {
    // Deep void sky — layered to simulate gradient
    const sky = this.add.graphics();

    // Base: near-black deep purple
    sky.fillStyle(0x080413, 1);
    sky.fillRect(0, 0, W, PANEL_Y);

    // Depth layers (additive-ish bands)
    const bands = [
      { color: 0x0e062f, y: 0,             h: PANEL_Y * 0.3, alpha: 0.5 },
      { color: 0x140d3a, y: PANEL_Y * 0.2, h: PANEL_Y * 0.3, alpha: 0.3 },
      { color: 0x1a1045, y: PANEL_Y * 0.4, h: PANEL_Y * 0.25, alpha: 0.2 },
    ];
    bands.forEach(({ color, y, h, alpha }) => {
      sky.fillStyle(color, alpha);
      sky.fillRect(0, y, W, h);
    });

    // Subtle stars
    const stars = this.add.graphics();
    stars.fillStyle(0xffffff, 1);
    for (let i = 0; i < 55; i++) {
      const sx = Phaser.Math.Between(0, W);
      const sy = Phaser.Math.Between(0, PANEL_Y * 0.75);
      const sr = Math.random() < 0.25 ? 1.2 : 0.7;
      stars.fillCircle(sx, sy, sr);
    }

    // Aurora shimmer band (SONIC school color)
    this._aurora = this.add.graphics();
    this._aurora.fillStyle(SONIC_PURPLE, 0.05);
    this._aurora.fillRect(0, PANEL_Y * 0.22, W, PANEL_Y * 0.14);
    this._aurora.fillStyle(SONIC_PURPLE, 0.03);
    this._aurora.fillRect(0, PANEL_Y * 0.08, W, PANEL_Y * 0.09);

    this.tweens.add({
      targets: this._aurora,
      alpha: { from: 0.6, to: 1 },
      duration: 3200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  createFloor() {
    const floor = this.add.graphics();

    // Stone floor base
    floor.fillStyle(0x0e0c09, 1);
    floor.fillRect(0, PANEL_Y, W, H - PANEL_Y + 2);

    // Horizon line (gold rule)
    floor.lineStyle(2, GOLD, 0.55);
    floor.lineBetween(0, PANEL_Y, W, PANEL_Y);

    // Perspective grid — lines converge to vanishing point at center-horizon
    const VPX = W / 2;
    floor.lineStyle(0.6, GOLD, 0.10);

    // Diagonal perspective lines
    const lines = 10;
    for (let i = 0; i <= lines; i++) {
      const bx = (W / lines) * i;
      floor.lineBetween(bx, H, VPX, PANEL_Y);
    }

    // Horizontal depth lines
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      const fy = PANEL_Y + (H - PANEL_Y) * t;
      floor.lineBetween(0, fy, W, fy);
    }
  }

  createBackgroundSigil() {
    // Faint arcane ritual circle in background sky
    const sigil = this.add.graphics();
    sigil.lineStyle(1, GOLD, 0.06);

    const cx = W / 2, cy = PANEL_Y * 0.48;
    sigil.strokeCircle(cx, cy, 90);
    sigil.strokeCircle(cx, cy, 60);
    sigil.strokeCircle(cx, cy, 30);

    // Cross arms
    sigil.lineBetween(cx - 90, cy, cx + 90, cy);
    sigil.lineBetween(cx, cy - 90, cx, cy + 90);

    // Diagonal arms
    const d = 90 * 0.707;
    sigil.lineBetween(cx - d, cy - d, cx + d, cy + d);
    sigil.lineBetween(cx + d, cy - d, cx - d, cy + d);

    // Rotate slowly
    this.tweens.add({
      targets: sigil,
      angle: 360,
      duration: 40000,
      repeat: -1,
      ease: 'Linear',
    });
  }

  // ─── Characters ────────────────────────────────────────────────────────────

  createPlayerSprite() {
    const cx = 580, cy = 230;

    // Ground aura (SONIC school)
    this._playerAura = this.add.ellipse(cx, cy + 54, 65, 14, SONIC_PURPLE, 0.18);

    // Robe (main body triangle)
    this.add.triangle(cx, cy - 32, cx - 26, cy + 56, cx + 26, cy + 56, 0x1c1408);

    // Inner robe highlight
    this.add.triangle(cx - 1, cy - 14, cx - 13, cy + 56, cx + 13, cy + 56, 0x2a1e0a);

    // Gold trim edges
    const trim = this.add.graphics();
    trim.lineStyle(1.5, GOLD, 0.6);
    trim.lineBetween(cx - 1, cy - 26, cx - 24, cy + 55);
    trim.lineBetween(cx - 1, cy - 26, cx + 24, cy + 55);
    // Center collar line
    trim.lineBetween(cx, cy - 26, cx, cy + 10);

    // Head
    this.add.circle(cx, cy - 46, 13, 0x3d2a12);
    this.add.circle(cx - 3, cy - 46, 14, 0x2a1a08, 0.4); // shadow side (facing left)

    // Eyes (facing left — toward opponent)
    this.add.rectangle(cx - 9, cy - 48, 4, 2.5, 0xffd700);
    this.add.rectangle(cx - 3, cy - 48, 4, 2.5, 0xffd700);

    // Scroll in outstretched hand
    const sx = cx + 34, sy = cy + 8;
    this.add.rectangle(sx, sy, 11, 19, 0xf5e6c8);
    const scrollDetail = this.add.graphics();
    scrollDetail.lineStyle(0.8, GOLD, 0.9);
    scrollDetail.strokeRect(sx - 5.5, sy - 9.5, 11, 19);
    scrollDetail.lineStyle(0.5, 0x5c3a1a, 0.7);
    scrollDetail.lineBetween(sx - 3, sy - 5, sx + 3, sy - 5);
    scrollDetail.lineBetween(sx - 3, sy - 1, sx + 3, sy - 1);
    scrollDetail.lineBetween(sx - 3, sy + 3, sx + 3, sy + 3);
    // Scroll glow
    this.add.rectangle(sx, sy, 11, 19, SONIC_PURPLE, 0.08);

    // School glyph above head (SONIC ♩)
    this._playerGlyph = this.add.text(cx, cy - 72, '♩', {
      fontSize: '15px',
      color: '#651fff',
      fontFamily: 'Georgia, serif',
    }).setOrigin(0.5).setAlpha(0.85);

    // Pulse glyph
    this.tweens.add({
      targets: this._playerGlyph,
      alpha: 0.4,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Pulse aura
    this.tweens.add({
      targets: this._playerAura,
      scaleX: 1.2,
      alpha: 0.08,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Store for shake reference
    this._playerCX = cx;
    this._playerCY = cy;
  }

  createOpponentSprite() {
    const cx = 210, cy = 210;

    // Ground aura (VOID — dark)
    this._opponentAura = this.add.ellipse(cx, cy + 62, 88, 18, 0x3d3d4a, 0.35);

    // Outer cloak — wider/taller than player (imposing)
    this.add.triangle(cx, cy - 62, cx - 38, cy + 66, cx + 38, cy + 66, VOID_DARK);

    // Inner cloak darkness
    this.add.triangle(cx - 1, cy - 44, cx - 20, cy + 66, cx + 20, cy + 66, 0x06040d);

    // Cloak trim (subtle gold — corrupted)
    const trim = this.add.graphics();
    trim.lineStyle(1, 0x2a2018, 0.5);
    trim.lineBetween(cx, cy - 56, cx - 36, cy + 65);
    trim.lineBetween(cx, cy - 56, cx + 36, cy + 65);

    // Hood
    this.add.circle(cx, cy - 78, 20, 0x0d0b14);
    this.add.circle(cx, cy - 74, 18, 0x06040d, 0.7);

    // Eyes — PSYCHIC cyan, bright and alien
    this._opponentEyeL = this.add.ellipse(cx - 9, cy - 80, 9, 6, 0x00e5ff, 0.9);
    this._opponentEyeR = this.add.ellipse(cx + 9, cy - 80, 9, 6, 0x00e5ff, 0.9);
    // Pupils
    this.add.rectangle(cx - 9, cy - 80, 3, 5, 0x000000);
    this.add.rectangle(cx + 9, cy - 80, 3, 5, 0x000000);

    // High-INT aura: floating school glyphs around head
    const intSymbols = ['∅', '◬', '⚗', '∅'];
    const angles = [210, 270, 330, 150];
    this._intGlyphs = intSymbols.map((sym, i) => {
      const angle = Phaser.Math.DegToRad(angles[i]);
      const gx = cx + Math.cos(angle) * 38;
      const gy = (cy - 78) + Math.sin(angle) * 28;
      const g = this.add.text(gx, gy, sym, {
        fontSize: '9px',
        color: '#00e5ff',
        fontFamily: 'Georgia, serif',
      }).setOrigin(0.5).setAlpha(0.45);

      this.tweens.add({
        targets: g,
        y: gy - 4,
        alpha: 0.2,
        duration: 1700 + i * 250,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 180,
      });

      return g;
    });

    // Pulsing eyes (menace)
    this.tweens.add({
      targets: [this._opponentEyeL, this._opponentEyeR],
      alpha: 0.3,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this._opponentCX = cx;
    this._opponentCY = cy;
  }

  // ─── UI Panels ────────────────────────────────────────────────────────────

  createOpponentInfoBar() {
    // Top-left: opponent name + HP bar
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.45);
    panel.fillRoundedRect(10, 10, 240, 44, 4);
    panel.lineStyle(1, GOLD, 0.3);
    panel.strokeRoundedRect(10, 10, 240, 44, 4);

    this._opponentNameText = this.add.text(18, 15, this.opponentName, {
      fontSize: '10px',
      fontFamily: 'Space Grotesk, sans-serif',
      color: TEXT_OPPONENT,
      letterSpacing: 1,
    });

    // HP label
    this.add.text(18, 30, 'HP', {
      fontSize: '8px',
      fontFamily: 'JetBrains Mono, monospace',
      color: TEXT_DIM,
    });

    // HP bar track
    const barX = 32, barY = 30, barW = 200, barH = 8;
    this.add.rectangle(barX + barW / 2, barY + barH / 2, barW, barH, 0x1a0808);
    this._opponentHPBar = this.add.rectangle(barX + barW / 2, barY + barH / 2, barW, barH, 0xcc2222);
    this._opponentHPBarBg = { x: barX, w: barW, h: barH, y: barY };
  }

  createBottomPanel() {
    // Dark panel — fills bottom of screen
    const panel = this.add.graphics();
    panel.fillStyle(PANEL_BG, 0.97);
    panel.fillRect(0, PANEL_Y + 2, W, PANEL_H);

    // Vertical divider between menu and stats
    panel.lineStyle(1.5, GOLD, 0.25);
    panel.lineBetween(MENU_W, PANEL_Y + 8, MENU_W, H - 8);
  }

  createBattleMenu() {
    const menuX = 14, menuY = PANEL_Y + 10;
    const itemH = 28;

    // Menu border
    const border = this.add.graphics();
    border.lineStyle(1.5, GOLD, 0.45);
    border.strokeRoundedRect(menuX, menuY, MENU_W - 22, PANEL_H - 18, 3);

    // Menu title
    this.add.text(menuX + 10, menuY + 8, 'ACTION', {
      fontSize: '8px',
      fontFamily: 'JetBrains Mono, monospace',
      color: TEXT_DIM,
      letterSpacing: 2,
    });

    // Cursor
    this._menuCursor = this.add.text(menuX + 10, menuY + 28, '▶', {
      fontSize: '10px',
      fontFamily: 'Space Grotesk, sans-serif',
      color: TEXT_PRIMARY,
    });

    // Animate cursor
    this.tweens.add({
      targets: this._menuCursor,
      x: menuX + 14,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Menu items
    this._menuItems = this.MENU_ITEMS.map((label, i) => {
      const text = this.add.text(menuX + 28, menuY + 24 + i * itemH, label, {
        fontSize: '11px',
        fontFamily: 'Space Grotesk, sans-serif',
        color: TEXT_WHITE,
        letterSpacing: 0.5,
      });
      text.setInteractive({ useHandCursor: true });

      text.on('pointerover', () => {
        if (!this.menuEnabled) return;
        this.cursorIndex = i;
        this._menuCursor.setY(menuY + 24 + i * itemH + 2);
        text.setColor(TEXT_PRIMARY);
      });

      text.on('pointerout', () => {
        text.setColor(TEXT_WHITE);
      });

      text.on('pointerdown', () => {
        if (!this.menuEnabled) return;
        this.handleMenuSelect(i);
      });

      return text;
    });

    // MP indicator below menu items
    this._mpText = this.add.text(menuX + 10, menuY + 24 + this.MENU_ITEMS.length * itemH + 4, `MP: ${this.playerMP}/${this.maxPlayerMP}`, {
      fontSize: '9px',
      fontFamily: 'JetBrains Mono, monospace',
      color: TEXT_DIM,
    });

    this.setMenuEnabled(false);
  }

  createStatsPanel() {
    const sx = MENU_W + 14, sy = PANEL_Y + 10;

    // Player name
    this._statsPlayerName = this.add.text(sx, sy + 6, this.playerName.toUpperCase(), {
      fontSize: '11px',
      fontFamily: 'Space Grotesk, sans-serif',
      color: TEXT_PRIMARY,
      letterSpacing: 1,
    });

    // HP label + value
    this.add.text(sx, sy + 26, 'HP', {
      fontSize: '9px',
      fontFamily: 'JetBrains Mono, monospace',
      color: TEXT_DIM,
    });
    this._statsHP = this.add.text(sx + 24, sy + 26, `${this.playerHP} / ${this.maxPlayerHP}`, {
      fontSize: '9px',
      fontFamily: 'JetBrains Mono, monospace',
      color: TEXT_WHITE,
    });

    // Player HP bar
    const barW = W - MENU_W - 28;
    this.add.rectangle(sx + barW / 2, sy + 45, barW, 7, 0x1a0808);
    this._playerHPBar = this.add.rectangle(sx + barW / 2, sy + 45, barW, 7, 0x22aa44);
    this._playerHPBarBg = { x: sx, w: barW, h: 7, y: sy + 45 };

    // MP label + value
    this.add.text(sx, sy + 57, 'MP', {
      fontSize: '9px',
      fontFamily: 'JetBrains Mono, monospace',
      color: TEXT_DIM,
    });
    this._statsMP = this.add.text(sx + 24, sy + 57, `${this.playerMP} / ${this.maxPlayerMP}`, {
      fontSize: '9px',
      fontFamily: 'JetBrains Mono, monospace',
      color: '#4488ff',
    });

    // MP bar
    this.add.rectangle(sx + barW / 2, sy + 70, barW, 5, 0x0a0a1a);
    this._playerMPBar = this.add.rectangle(sx + barW / 2, sy + 70, barW, 5, 0x4488ff);
    this._playerMPBarBg = { x: sx, w: barW, y: sy + 70 };

    // School badge
    this.add.text(sx, sy + 82, 'SCHOOL: SONIC THAUMATURGY', {
      fontSize: '8px',
      fontFamily: 'JetBrains Mono, monospace',
      color: TEXT_SONIC,
      letterSpacing: 0.5,
      alpha: 0.8,
    });
  }

  createMessageWindow() {
    const msgY = PANEL_Y + 10;
    const msgX = MENU_W + 14;
    const msgW = W - MENU_W - 22;

    // Hidden by default — shown during action sequences
    this._messageBox = this.add.graphics();
    this._messageBox.setAlpha(0);

    this._messageText = this.add.text(msgX, msgY + 4, '', {
      fontSize: '10px',
      fontFamily: 'Georgia, serif',
      color: TEXT_WHITE,
      wordWrap: { width: msgW - 8 },
      lineSpacing: 4,
    }).setAlpha(0);
  }

  // ─── Menu Logic ────────────────────────────────────────────────────────────

  setMenuEnabled(enabled) {
    this.menuEnabled = enabled;
    this._menuItems?.forEach((item) => {
      item.setColor(enabled ? TEXT_WHITE : TEXT_DIM);
      item.setAlpha(enabled ? 1 : 0.45);
    });
    if (this._menuCursor) {
      this._menuCursor.setAlpha(enabled ? 1 : 0);
    }
  }

  handleMenuSelect(index) {
    this.setMenuEnabled(false);
    if (index === 0) {
      combatBridge.emit('action:inscribe', {});
    } else if (index === 1) {
      combatBridge.emit('action:flee', {});
    }
  }

  showMessage(lines, durationMs = 2000, onDone) {
    const text = Array.isArray(lines) ? lines.join('\n') : lines;
    this._messageText.setText(text).setAlpha(1);
    if (onDone) {
      this.time.delayedCall(durationMs, onDone);
    }
  }

  // ─── Intro ─────────────────────────────────────────────────────────────────

  playIntroSequence() {
    this.setMenuEnabled(false);

    // Fade in from black
    this.cameras.main.fadeIn(800, 0, 0, 0);

    this.time.delayedCall(900, () => {
      this.showMessage([
        `${this.opponentName} appears.`,
        'The resonance lattice trembles.',
      ], 2000, () => {
        this._messageText.setAlpha(0);
        this.time.delayedCall(300, () => {
          this.setMenuEnabled(true);
          combatBridge.emit('state:update', {
            state: 'PLAYER_TURN',
            playerHP: this.playerHP,
            opponentHP: this.opponentHP,
            playerMP: this.playerMP,
          });
        });
      });
    });
  }

  // ─── Spell Animations ──────────────────────────────────────────────────────

  /**
   * Player casts toward opponent.
   * Golden sonic wave — orbs in a trail arc.
   */
  playPlayerSpellAnim(damage) {
    this.setMenuEnabled(false);
    this._messageText.setAlpha(0);

    const fromX = this._playerCX - 20;
    const fromY = this._playerCY;
    const toX   = this._opponentCX;
    const toY   = this._opponentCY - 20;

    // Create trailing orbs — staggered
    const orbCount = 5;
    const orbs = [];

    for (let i = 0; i < orbCount; i++) {
      const orb = this.add.circle(fromX, fromY, 5 - i * 0.5, i === 0 ? GOLD : SONIC_PURPLE, 1 - i * 0.15);
      const glowOrb = this.add.circle(fromX, fromY, 9 - i, SONIC_PURPLE, 0.12 - i * 0.02);
      orbs.push({ orb, glowOrb });
    }

    let done = 0;
    orbs.forEach(({ orb, glowOrb }, i) => {
      this.time.delayedCall(i * 55, () => {
        this.tweens.add({
          targets: [orb, glowOrb],
          x: toX,
          y: toY,
          duration: 500,
          ease: 'Power2.easeIn',
          onComplete: () => {
            orb.destroy();
            glowOrb.destroy();
            done++;
            if (done === orbCount) {
              this.onPlayerSpellHit(damage);
            }
          },
        });
      });
    });
  }

  onPlayerSpellHit(damage) {
    // Flash the opponent area
    this.cameras.main.flash(180, 101, 31, 255, false);

    // Shake opponent elements
    this.shakeElementAt(this._opponentCX, this._opponentCY);

    // Update opponent HP bar
    this.updateOpponentHP(this.opponentHP);

    // Damage number
    this.floatDamageNumber(this._opponentCX, this._opponentCY - 30, `-${damage}`, TEXT_PRIMARY);

    // School flourish text
    this.time.delayedCall(300, () => {
      const flourish = this.add.text(this._opponentCX, this._opponentCY - 60, 'SONIC', {
        fontSize: '9px',
        fontFamily: 'JetBrains Mono, monospace',
        color: TEXT_SONIC,
        letterSpacing: 3,
      }).setOrigin(0.5).setAlpha(0.9);

      this.tweens.add({
        targets: flourish,
        y: flourish.y - 20,
        alpha: 0,
        duration: 900,
        ease: 'Power2.easeOut',
        onComplete: () => {
          flourish.destroy();
          // Signal React — animation done
          this.time.delayedCall(400, () => {
            combatBridge.emit('anim:player:done', {});
          });
        },
      });
    });
  }

  /**
   * Opponent casts toward player.
   * Dark VOID wave — fragmented text shards.
   */
  playOpponentSpellAnim(damage) {
    const fromX = this._opponentCX + 20;
    const fromY = this._opponentCY;
    const toX   = this._playerCX;
    const toY   = this._playerCY;

    // Show spell text in message window briefly
    this.showMessage(`${this.opponentName} counter-inscribes...`, 800);

    // Fragmented shard orbs (VOID aesthetic)
    const shards = [];
    const shardColors = [0x3d3d4a, 0x00e5ff, 0x1a0a2a];

    for (let i = 0; i < 6; i++) {
      const color = shardColors[i % shardColors.length];
      const shard = this.add.rectangle(
        fromX + Phaser.Math.Between(-8, 8),
        fromY + Phaser.Math.Between(-8, 8),
        Phaser.Math.Between(4, 9),
        Phaser.Math.Between(2, 5),
        color,
        0.9
      );
      shards.push(shard);
    }

    let done = 0;
    shards.forEach((shard, i) => {
      this.time.delayedCall(i * 45, () => {
        this.tweens.add({
          targets: shard,
          x: toX + Phaser.Math.Between(-10, 10),
          y: toY + Phaser.Math.Between(-10, 10),
          duration: 480,
          ease: 'Power2.easeIn',
          onComplete: () => {
            shard.destroy();
            done++;
            if (done === shards.length) {
              this.onOpponentSpellHit(damage);
            }
          },
        });
      });
    });
  }

  onOpponentSpellHit(damage) {
    this.cameras.main.shake(220, 0.016);
    this.cameras.main.flash(160, 10, 4, 20, false);

    this.updatePlayerHP(this.playerHP);

    this.floatDamageNumber(this._playerCX, this._playerCY - 25, `-${damage}`, '#ff4444');

    this.time.delayedCall(600, () => {
      this._messageText.setAlpha(0);
      this.time.delayedCall(300, () => {
        combatBridge.emit('anim:opponent:done', {});
      });
    });
  }

  // ─── HP Bar Updates ────────────────────────────────────────────────────────

  updateOpponentHP(newHP) {
    this.opponentHP = newHP;
    const pct = Math.max(0, newHP / this.maxOpponentHP);
    const { x, w, h, y } = this._opponentHPBarBg;
    const newW = Math.max(1, w * pct);
    this._opponentHPBar.setPosition(x + newW / 2, y + h / 2);
    this._opponentHPBar.setSize(newW, h);
    // Color: green → yellow → red
    const color = pct > 0.5 ? 0x22aa44 : pct > 0.25 ? 0xddaa00 : 0xcc2222;
    this._opponentHPBar.setFillStyle(color);
  }

  updatePlayerHP(newHP) {
    this.playerHP = newHP;
    const pct = Math.max(0, newHP / this.maxPlayerHP);
    const { x, w, y } = this._playerHPBarBg;
    const newW = Math.max(1, w * pct);
    this._playerHPBar.setPosition(x + newW / 2, y);
    this._playerHPBar.setSize(newW, 7);
    const color = pct > 0.5 ? 0x22aa44 : pct > 0.25 ? 0xddaa00 : 0xcc2222;
    this._playerHPBar.setFillStyle(color);

    this._statsHP.setText(`${Math.max(0, newHP)} / ${this.maxPlayerHP}`);
  }

  updatePlayerMP(newMP) {
    this.playerMP = newMP;
    const pct = Math.max(0, newMP / this.maxPlayerMP);
    const { x, w } = this._playerMPBarBg;
    const newW = Math.max(1, w * pct);
    this._playerMPBar.setPosition(x + newW / 2, this._playerMPBarBg.y);
    this._playerMPBar.setSize(newW, 5);
    this._statsMP.setText(`${Math.max(0, newMP)} / ${this.maxPlayerMP}`);
    this._mpText?.setText(`MP: ${Math.max(0, newMP)}/${this.maxPlayerMP}`);
  }

  // ─── Effects ────────────────────────────────────────────────────────────────

  shakeElementAt(cx, cy) {
    // Create a quick position tween offset for visual feedback
    const marker = this.add.circle(cx, cy, 20, 0xffffff, 0);
    this.tweens.add({
      targets: marker,
      x: cx + 6,
      duration: 50,
      yoyo: true,
      repeat: 3,
      ease: 'Linear',
      onComplete: () => marker.destroy(),
    });
  }

  floatDamageNumber(x, y, text, color) {
    const dmgText = this.add.text(x, y, text, {
      fontSize: '22px',
      fontFamily: 'Georgia, serif',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: dmgText,
      y: y - 55,
      alpha: 0,
      duration: 1200,
      ease: 'Power2.easeOut',
      onComplete: () => dmgText.destroy(),
    });
  }

  // ─── End States ─────────────────────────────────────────────────────────────

  showVictoryEffect() {
    this.cameras.main.flash(600, 201, 162, 39, false);
    const txt = this.add.text(W / 2, H / 2 - 40, 'THE RITE IS COMPLETE', {
      fontSize: '20px',
      fontFamily: 'Georgia, serif',
      color: TEXT_PRIMARY,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0).setDepth(200);

    this.tweens.add({ targets: txt, alpha: 1, duration: 800, ease: 'Power2.easeOut' });
  }

  showDefeatEffect() {
    this.cameras.main.fade(1200, 0, 0, 0);
  }

  // ─── Bridge Listeners ──────────────────────────────────────────────────────

  setupBridgeListeners() {
    // React sends init data
    this._unsubInit = combatBridge.on('combat:init', ({ playerName, opponentName, playerHP, playerMP, opponentHP }) => {
      this.playerName = playerName;
      this.opponentName = opponentName;
      this.playerHP = playerHP;
      this.playerMP = playerMP;
      this.opponentHP = opponentHP;
      this.maxPlayerHP = playerHP;
      this.maxPlayerMP = playerMP;
      this.maxOpponentHP = opponentHP;
      this._opponentNameText?.setText(opponentName);
      this.updatePlayerHP(playerHP);
      this.updateOpponentHP(opponentHP);
      this.updatePlayerMP(playerMP);
    });

    // React: player cast — play animation
    this._unsubPlayerCast = combatBridge.on('player:cast', ({ damage }) => {
      this.playPlayerSpellAnim(damage);
    });

    // React: opponent cast — play animation
    this._unsubOpponentCast = combatBridge.on('opponent:cast', ({ damage }) => {
      this.playOpponentSpellAnim(damage);
    });

    // React: state changed — update visuals
    this._unsubState = combatBridge.on('state:update', ({ state, playerHP, opponentHP, playerMP }) => {
      if (playerHP !== undefined) this.updatePlayerHP(playerHP);
      if (opponentHP !== undefined) this.updateOpponentHP(opponentHP);
      if (playerMP !== undefined) this.updatePlayerMP(playerMP);

      if (state === 'PLAYER_TURN') {
        this.setMenuEnabled(true);
        this._messageText.setAlpha(0);
      } else if (state === 'VICTORY') {
        this.setMenuEnabled(false);
        this.showVictoryEffect();
      } else if (state === 'DEFEAT') {
        this.setMenuEnabled(false);
        this.showDefeatEffect();
      } else {
        this.setMenuEnabled(false);
      }
    });
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy() {
    this._unsubInit?.();
    this._unsubPlayerCast?.();
    this._unsubOpponentCast?.();
    this._unsubState?.();
    super.destroy();
  }
}
