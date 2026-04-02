/**
 * KeystrokeSparksCanvas — React wrapper for KeystrokeSparksScene
 *
 * Performance contract:
 *   - Phaser is NOT initialized on mount.
 *   - It initializes lazily on the user's FIRST printable keypress.
 *   - Until then this is a zero-cost transparent div (no WebGL, no game loop).
 *   - Subsequent keypresses are throttled to ≤ 1 spark burst per 80 ms.
 *
 * Props:
 *   schoolColor {string}  — hex color for the active school
 */
import { useEffect, useRef } from 'react';

export default function KeystrokeSparksCanvas({
  schoolColor = '#c8a84b',
}) {
  const elRef        = useRef(null);
  const gameRef      = useRef(null);
  const mouseRef     = useRef({ x: null, y: null });
  const colorRef     = useRef(schoolColor);

  useEffect(() => { colorRef.current = schoolColor; }, [schoolColor]);

  // Track mouse position relative to canvas element
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Lazy Phaser init: fires on first printable keypress, never on mount.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let alive = true;

    async function initPhaser() {
      if (!alive) return;
      try {
        const [{ default: Phaser }, { buildSparksScene }] = await Promise.all([
          import('phaser'),
          import('./scenes/KeystrokeSparksScene.js'),
        ]);
        if (!alive) return;

        const W = el.offsetWidth  || 800;
        const H = el.offsetHeight || 600;

        const game = new Phaser.Game({
          type:        Phaser.WEBGL,
          parent:      el,
          width:       W,
          height:      H,
          transparent: true,
          antialias:   true,
          scene:       [buildSparksScene(Phaser)],
          audio:       { noAudio: true },
          scale:       { mode: Phaser.Scale.RESIZE },
          banner:      false,
          render: {
            powerPreference: 'high-performance',
            batchSize: 2048,
          },
        });

        game.events.once('ready', () => {
          if (!alive) { game.destroy(true); return; }
          if (game.canvas) game.canvas.style.pointerEvents = 'none';
          gameRef.current = game;
        });
      } catch {
        /* Phaser unavailable — sparks layer absent */
      }
    }

    // Remove itself and trigger init on first valid keypress
    function onFirstKey(e) {
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return;
      document.removeEventListener('keydown', onFirstKey);
      initPhaser();
    }

    document.addEventListener('keydown', onFirstKey);

    return () => {
      alive = false;
      document.removeEventListener('keydown', onFirstKey);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Keydown → spark burst (throttled, only active once game is ready)
  useEffect(() => {
    let lastFire = 0;
    const onKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return;
      const game = gameRef.current;
      if (!game) return;
      const now = Date.now();
      if (now - lastFire < 80) return; // max ~12 bursts/sec
      lastFire = now;
      const scene = game.scene.getScene('KeystrokeSparksScene');
      const { x, y } = mouseRef.current;
      scene?.triggerSparks?.(x, y, colorRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      ref={elRef}
      className="ide-sparks-canvas"
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    />
  );
}
