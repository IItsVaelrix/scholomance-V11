/**
 * ArcaneBookshelfCanvas — Mounts a Phaser ArcaneBookshelfScene into a DOM div.
 *
 * Props:
 *   side              'left' | 'right'
 *   schoolColor       hex string e.g. '#6e38c9'
 *   isPlaying         boolean
 *   signalLevel       0–1
 *   prefersReducedMotion  boolean
 */

import { useEffect, useRef } from 'react';

// Canvas logical size — matches arcane-shelf max-width
const CANVAS_W = 320;
const CANVAS_H = 900;

export function ArcaneBookshelfCanvas({
  side = 'left',
  schoolColor = '#d5b34b',
  isPlaying = false,
  signalLevel = 0,
  prefersReducedMotion = false,
}) {
  const containerRef = useRef(null);
  const gameRef      = useRef(null);
  const sceneRef     = useRef(null);

  // ── Mount Phaser once ──────────────────────────────────────────────────────
  useEffect(() => {
    let game = null;

    const mount = async () => {
      if (!containerRef.current) return;

      const [{ default: PhaserLib }, { createArcaneBookshelfScene }] = await Promise.all([
        import('phaser'),
        import('./scenes/ArcaneBookshelfScene'),
      ]);

      // Build scene class with side captured in closure
      const SceneClass = createArcaneBookshelfScene(side);

      const resolution = Math.min(window.devicePixelRatio || 1, 1.5);

      game = new PhaserLib.Game({
        type:        PhaserLib.AUTO,
        width:       CANVAS_W,
        height:      CANVAS_H,
        parent:      containerRef.current,
        transparent: true,
        antialias:   true,
        powerPreference: 'default',
        resolution,
        scene: [SceneClass],
        scale: {
          mode:       PhaserLib.Scale.FILL,
          autoCenter: PhaserLib.Scale.CENTER_BOTH,
          width:      CANVAS_W,
          height:     CANVAS_H,
        },
        fps: {
          target:         prefersReducedMotion ? 10 : 30,
          forceSetTimeOut: false,
        },
      });

      game.events.once('ready', () => {
        const key   = `ArcaneBookshelf_${side}`;
        const scene = game?.scene.getScene(key);
        if (!scene) return;
        sceneRef.current = scene;
        scene.updateState({ schoolColor, isPlaying, signalLevel });
      });

      gameRef.current = game;
    };

    void mount();

    return () => {
      game?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  // ── Push reactive state into scene ────────────────────────────────────────
  useEffect(() => {
    sceneRef.current?.updateState({ schoolColor, isPlaying, signalLevel });
  }, [schoolColor, isPlaying, signalLevel]);

  return (
    <aside
      className={[
        'arcane-shelf',
        `arcane-shelf--${side}`,
        isPlaying ? 'is-active' : '',
        prefersReducedMotion ? 'is-reduced-motion' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <div
        ref={containerRef}
        className="arcane-shelf__phaser-mount"
      />
    </aside>
  );
}
