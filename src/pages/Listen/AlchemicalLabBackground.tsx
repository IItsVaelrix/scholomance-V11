import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { AlchemicalLabScene } from './scenes/AlchemicalLabScene';

/**
 * AlchemicalLabBackground — Phaser canvas mounted behind the Thaumaturgy Console.
 *
 * Full-viewport, pointer-events:none. Handles clean teardown on unmount.
 * Frame rate capped at 30 fps — background ambiance doesn't need 60.
 */
export const AlchemicalLabBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    const el = containerRef.current;

    let game: Phaser.Game | null = null;

    const initPhaser = async () => {
      const { default: PhaserLib } = await import('phaser');
      if (!el || gameRef.current) return;

      game = new PhaserLib.Game({
        type: PhaserLib.WEBGL,
        parent: el,
        width: el.offsetWidth  || window.innerWidth,
        height: el.offsetHeight || window.innerHeight,
        backgroundColor: '#010305',
        transparent: false,
        antialias: true,
        powerPreference: 'low-power',
        fps: { target: 30, forceSetTimeOut: false },
        scene: [AlchemicalLabScene],
        // Disable all input — this is a background
        input: { mouse: false, touch: false, keyboard: false, gamepad: false },
      });

      // Ensure canvas stretches to fill the container
      game.events.once('ready', () => {
        const canvas = el.querySelector('canvas');
        if (canvas) {
          canvas.style.position = 'absolute';
          canvas.style.inset    = '0';
          canvas.style.width    = '100%';
          canvas.style.height   = '100%';
          canvas.style.display  = 'block';
        }
      });

      gameRef.current = game;
    };

    void initPhaser();

    return () => {
      game?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    />
  );
};
