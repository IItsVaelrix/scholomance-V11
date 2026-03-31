import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { cacheBackground } from '../../lib/cache/backgroundCache';
import { getAmbientPlayerService } from '../../lib/ambient/ambientPlayer.service.js';

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
 * Performance: Cache + Hydrate pattern for instant LCP
 * - First visit: Shows CSS background, loads Phaser, caches rendered static layer
 * - Subsequent: Shows cached image instantly, hydrates with Phaser in background
 */
export const AlchemicalLabBackground: React.FC<{ signalLevel?: number }> = ({ signalLevel = 0 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const bgSceneRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    const el = containerRef.current;

    // Load Phaser in background (non-blocking)
    const initBackground = async () => {
      const { default: PhaserLib } = await import('phaser');
      const { AlchemicalLabScene } = await import('./scenes/AlchemicalLabScene');
      const { SignalChamberScene } = await import('./scenes/SignalChamberScene');

      if (!el || gameRef.current) return;

      const config = {
        type: PhaserLib.WEBGL,
        parent: el,
        width: el.offsetWidth || window.innerWidth,
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
          bgScene.scene.settings.zIndex = 0;
        }

        // Style the Phaser canvas
        const canvas = el.querySelector('canvas');
        if (canvas) {
          canvas.style.position = 'absolute';
          canvas.style.inset = '0';
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.display = 'block';
          canvas.style.zIndex = '1';
        }

        // Fade in the Phaser canvas
        setIsLoaded(true);

        // Cache the static background for next visit (after a delay to not block render)
        setTimeout(() => {
          cacheStaticBackground(PhaserLib, bgScene);
        }, 1000);
      });
    };

    // Render and cache static background
    const cacheStaticBackground = async (PhaserLib: any, bgScene: any) => {
      if (!bgScene || !sharedPhaserGame) return;

      try {
        // Get the canvas from the game
        const canvas = sharedPhaserGame.canvas as HTMLCanvasElement;
        if (!canvas) return;

        // Create a temporary canvas to render static-only version
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        // Draw current frame (includes all static elements)
        tempCtx.drawImage(canvas, 0, 0);

        // Cache the data URL
        const dataURL = tempCanvas.toDataURL('image/png', 0.85);
        await cacheBackground(dataURL);
      } catch (error) {
        console.warn('Failed to cache background:', error);
      }
    };

    void initBackground();

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
      const bpm = getAmbientPlayerService()?.getBPM?.() || 90;
      bgSceneRef.current.updateState({ signalLevel, bpm });
    }
  }, [signalLevel]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="alchemical-lab-background"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* 
        STATIC CSS BACKGROUND - Shows instantly on ALL visits
        This is the LCP element - pure CSS, no JS required
      */}
      <div className="alchemical-lab-static-bg" aria-hidden="true">
        {/* Stone wall pattern */}
        <div className="alchemical-stone-wall" />
        
        {/* Central arch portal */}
        <div className="alchemical-arch-portal">
          <div className="arch-ring arch-ring--outer" />
          <div className="arch-ring arch-ring--mid" />
          <div className="arch-ring arch-ring--inner" />
          <div className="arch-pentagram">
            <svg viewBox="0 0 200 200" className="pentagram-svg">
              {/* Pentagram drawn with a single continuous stroke for sharp magical look */}
              <path d="M100 20 L147 165 L24 75 L176 75 L53 165 Z" className="pentagram-path" />
            </svg>
          </div>
        </div>
        
        {/* Vignette overlay */}
        <div className="alchemical-vignette" />
      </div>

      {/* Phaser canvas container - loads in background */}
      <div
        className="alchemical-lab-phaser"
        ref={containerRef}
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />
    </div>
  );
};
