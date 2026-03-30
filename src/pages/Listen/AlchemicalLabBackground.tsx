import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';

// Shared game reference for SignalChamberConsole to attach to
let sharedPhaserGame: Phaser.Game | null = null;

export function getSharedPhaserGame(): Phaser.Game | null {
  return sharedPhaserGame;
}

/**
 * AlchemicalLabBackground — Creates a SINGLE Phaser game with multiple scenes:
 * - AlchemicalLabScene (zIndex: 0) — Background atmosphere with rotating hexagram
 * - SignalChamberScene (zIndex: 10) — Console UI (mounted by SignalChamberConsole)
 * 
 * Note: Three.js bookshelves removed — now using Phaser-only background.
 */
export const AlchemicalLabBackground: React.FC<{ signalLevel?: number }> = ({ signalLevel = 0 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);
  const bgSceneRef   = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    const el = containerRef.current;

    // ── Initialize SINGLE Phaser Game with Both Scenes ──
    const initPhaser = async () => {
      const { default: PhaserLib } = await import('phaser');
      const { AlchemicalLabScene } = await import('./scenes/AlchemicalLabScene');
      const { SignalChamberScene } = await import('./scenes/SignalChamberScene');
      
      if (!el || gameRef.current) return;

      const config = {
        type: PhaserLib.WEBGL,
        parent: el,
        width: el.offsetWidth  || window.innerWidth,
        height: el.offsetHeight || window.innerHeight,
        backgroundColor: '#010305',
        transparent: false,
        antialias: true,
        powerPreference: 'high-performance' as const,
        fps: { target: 60, forceSetTimeOut: false },
        scene: [AlchemicalLabScene, SignalChamberScene],
        input: { mouse: true, touch: true, keyboard: true, gamepad: false },
        render: {
          pixelArt: false,
          antialias: true,
        },
      };

      const game = new PhaserLib.Game(config);
      sharedPhaserGame = game;
      gameRef.current = game;

      game.events.once('ready', () => {
        // Get background scene
        const bgScene = game.scene.getScene('AlchemicalLabScene');
        if (bgScene) {
          bgSceneRef.current = bgScene;
          // Set background scene to render first (lowest zIndex)
          bgScene.scene.settings.zIndex = 0;
        }

        const canvas = el.querySelector('canvas');
        if (canvas) {
          canvas.style.position = 'absolute';
          canvas.style.inset    = '0';
          canvas.style.width    = '100%';
          canvas.style.height   = '100%';
          canvas.style.display  = 'block';
          canvas.style.zIndex   = '1';
        }
      });
    };

    void initPhaser();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      bgSceneRef.current = null;
      sharedPhaserGame = null;
    };
  }, []);

  useEffect(() => {
    // Sync React state to Phaser background scene
    if (bgSceneRef.current) {
      bgSceneRef.current.updateState({ signalLevel });
    }
  }, [signalLevel]);

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
