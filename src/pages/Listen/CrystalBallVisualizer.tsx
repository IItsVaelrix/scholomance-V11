import React, { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { CrystalBallScene } from './scenes/CrystalBallScene';

interface CrystalBallVisualizerProps {
  signalLevel: number;
  schoolColor: string;
  glyph: string;
  isTuning: boolean;
  schoolId?: string;
  size?: number;
}

export const CrystalBallVisualizer: React.FC<CrystalBallVisualizerProps> = ({
  signalLevel,
  schoolColor,
  glyph,
  isTuning,
  schoolId,
  size = 320,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CrystalBallScene | null>(null);

  useEffect(() => {
    let game: Phaser.Game | null = null;

    const initPhaser = async () => {
      const { default: PhaserLib } = await import('phaser');
      if (!containerRef.current) return;

      game = new PhaserLib.Game({
        type: PhaserLib.AUTO,
        width: size,
        height: size,
        parent: containerRef.current,
        transparent: true,
        antialias: true,
        scene: [CrystalBallScene],
        fps: { target: 60, forceSetTimeOut: true },
      });

      game.events.once('ready', () => {
        const scene = game?.scene.getScene('CrystalBallScene') as CrystalBallScene;
        sceneRef.current = scene;
        // Push initial state immediately
        scene?.updateState({ signalLevel, schoolColor, glyph, isTuning, schoolId });
      });

      gameRef.current = game;
    };

    void initPhaser();

    return () => {
      game?.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  useEffect(() => {
    sceneRef.current?.updateState({ signalLevel, schoolColor, glyph, isTuning, schoolId });
  }, [signalLevel, schoolColor, glyph, isTuning, schoolId]);

  return (
    <div
      ref={containerRef}
      className="crystal-ball-container"
      style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}
    />
  );
};
