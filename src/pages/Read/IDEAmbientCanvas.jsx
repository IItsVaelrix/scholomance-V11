/**
 * IDEAmbientCanvas — React wrapper for IDEAmbientScene
 *
 * Defers Phaser initialization to browser idle time (requestIdleCallback,
 * 4 s timeout). This guarantees it never competes with first-interaction
 * paint and has zero INP impact during initial load.
 *
 * Props:
 *   schoolColor {string} — hex color for the active school (e.g. "#651fff")
 */
import { useEffect, useRef } from 'react';

const useRIC = typeof requestIdleCallback !== 'undefined';

export default function IDEAmbientCanvas({ schoolColor = '#c8a84b' }) {
  const elRef    = useRef(null);
  const gameRef  = useRef(null);
  const colorRef = useRef(schoolColor);

  useEffect(() => { colorRef.current = schoolColor; }, [schoolColor]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let alive = true;

    async function initPhaser() {
      if (!alive) return;
      try {
        const [{ default: Phaser }, { buildAmbientScene }] = await Promise.all([
          import('phaser'),
          import('./scenes/IDEAmbientScene.js'),
        ]);
        if (!alive) return;

        const W = el.offsetWidth  || window.innerWidth;
        const H = el.offsetHeight || window.innerHeight;

        const game = new Phaser.Game({
          type:        Phaser.WEBGL,
          parent:      el,
          width:       W,
          height:      H,
          transparent: true,
          antialias:   true,
          scene:       [buildAmbientScene(Phaser)],
          audio:       { noAudio: true },
          scale:       { mode: Phaser.Scale.RESIZE },
          banner:      false,
          render: {
            powerPreference: 'high-performance',
            batchSize: 4096,
          },
        });

        game.events.once('ready', () => {
          if (!alive) { game.destroy(true); return; }
          if (game.canvas) game.canvas.style.pointerEvents = 'none';
          gameRef.current = game;
          const scene = game.scene.getScene('IDEAmbientScene');
          scene?.setSchoolColor?.(colorRef.current);
        });
      } catch {
        /* Phaser unavailable — ambient layer absent */
      }
    }

    // Defer to idle time so first-interaction paint is never blocked.
    // Falls back to a 1.2 s setTimeout in browsers without RIC (Safari < 2023).
    const idleHandle = useRIC
      ? requestIdleCallback(initPhaser, { timeout: 4000 })
      : setTimeout(initPhaser, 1200);

    return () => {
      alive = false;
      if (useRIC) cancelIdleCallback(idleHandle);
      else        clearTimeout(idleHandle);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Push school color updates into the live scene
  useEffect(() => {
    const scene = gameRef.current?.scene?.getScene('IDEAmbientScene');
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
