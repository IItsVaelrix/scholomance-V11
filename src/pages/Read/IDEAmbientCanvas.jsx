/**
 * IDEAmbientCanvas — React wrapper for IDEAmbientScene
 *
 * Mounts a transparent Phaser canvas as an absolute-positioned layer
 * behind the IDE main content. Skips entirely when prefers-reduced-motion.
 *
 * Props:
 *   schoolColor {string} — hex color for the active school (e.g. "#651fff")
 */
import { useEffect, useRef } from 'react';

export default function IDEAmbientCanvas({ schoolColor = '#c8a84b' }) {
  const elRef       = useRef(null);
  const gameRef     = useRef(null);
  const colorRef    = useRef(schoolColor);

  // Keep colorRef current so Phaser can read the latest value after async load
  useEffect(() => {
    colorRef.current = schoolColor;
  }, [schoolColor]);

  // Mount Phaser once on first render
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    // Respect reduced motion — skip the entire canvas
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let alive = true;

    (async () => {
      try {
        const [{ default: Phaser }, { buildAmbientScene }] = await Promise.all([
          import('phaser'),
          import('./scenes/IDEAmbientScene.js'),
        ]);
        if (!alive) return;

        const W = el.offsetWidth  || window.innerWidth;
        const H = el.offsetHeight || window.innerHeight;

        const game = new Phaser.Game({
          type:        Phaser.AUTO,
          parent:      el,
          width:       W,
          height:      H,
          transparent: true,
          antialias:   true,
          scene:       [buildAmbientScene(Phaser)],
          audio:       { noAudio: true },
          scale:       { mode: Phaser.Scale.RESIZE },
          banner:      false,
        });

        game.events.once('ready', () => {
          if (!alive) { game.destroy(true); return; }
          if (game.canvas) game.canvas.style.pointerEvents = 'none';
          gameRef.current = game;
          // Apply the school color that may have been set before Phaser loaded
          const scene = game.scene.getScene('IDEAmbientScene');
          scene?.setSchoolColor?.(colorRef.current);
        });
      } catch {
        /* Phaser unavailable (test env / no WebGL) — ambient layer absent */
      }
    })();

    return () => {
      alive = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Push school color updates into the live scene
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    const scene = game.scene.getScene('IDEAmbientScene');
    scene?.setSchoolColor?.(schoolColor);
  }, [schoolColor]);

  return (
    <div
      ref={elRef}
      className="ide-ambient-canvas"
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    />
  );
}
