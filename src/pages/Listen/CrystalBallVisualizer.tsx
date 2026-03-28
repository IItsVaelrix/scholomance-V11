import React, { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { CrystalBallScene } from './scenes/CrystalBallScene';

interface CrystalBallVisualizerProps {
  signalLevel: number;
  schoolColor: string;
  glyph: string;
  isTuning: boolean;
  size?: number;
}

/**
 * CrystalBallVisualizer — React wrapper for the Phaser Crystal Ball scene.
 */
export const CrystalBallVisualizer: React.FC<CrystalBallVisualizerProps> = ({
  signalLevel,
  schoolColor,
  glyph,
  isTuning,
  size = 320
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CrystalBallScene | null>(null);

  useEffect(() => {
    let game: Phaser.Game | null = null;

    const initPhaser = async () => {
      const { default: Phaser } = await import('phaser');
      
      if (!containerRef.current) return;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: size,
        height: size,
        parent: containerRef.current,
        transparent: true,
        antialias: true,
        scene: [CrystalBallScene],
        fps: { target: 60, forceSetTimeOut: true }
      });

      game.events.once('ready', () => {
        const scene = game?.scene.getScene('CrystalBallScene') as CrystalBallScene;
        sceneRef.current = scene;
      });

      gameRef.current = game;
    };

    initPhaser();

    return () => {
      if (game) {
        game.destroy(true);
      }
    };
  }, [size]);

  // Sync React state to Phaser scene
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updateState({ signalLevel, schoolColor, glyph, isTuning });
    }
  }, [signalLevel, schoolColor, glyph, isTuning]);

  return (
    <div 
      ref={containerRef} 
      className="crystal-ball-container"
      style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}
    />
  );
};
