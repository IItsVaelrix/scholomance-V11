import React, { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { CrystalBallScene } from './scenes/CrystalBallScene';
import { getAmbientPlayerService } from '../../lib/ambient/ambientPlayer.service.js';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.js';

interface CrystalBallVisualizerProps {
  signalLevel: number;
  schoolColor: string;
  glyph: string;
  isTuning: boolean;
  isPlaying?: boolean;
  schoolId?: string;
  size?: number;
}

export const CrystalBallVisualizer: React.FC<CrystalBallVisualizerProps> = ({
  signalLevel,
  schoolColor,
  glyph,
  isTuning,
  isPlaying = false,
  schoolId,
  size = 320,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CrystalBallScene | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let game: Phaser.Game | null = null;

    const initPhaser = async () => {
      const { default: PhaserLib } = await import('phaser');
      if (!containerRef.current) return;

      game = new PhaserLib.Game({
        type: PhaserLib.WEBGL,
        width: size,
        height: size,
        parent: containerRef.current,
        transparent: true,
        antialias: true,
        scene: [CrystalBallScene],
        fps: { target: 60 },
        render: {
          powerPreference: 'high-performance',
          batchSize: 1024,
        }
      });

      game.events.once('ready', () => {
        const scene = game?.scene.getScene('CrystalBallScene') as CrystalBallScene;
        sceneRef.current = scene;
        // Push initial state immediately
        const bpm = getAmbientPlayerService()?.getBPM?.() || 90;
        scene?.updateState({ signalLevel, schoolColor, glyph, isTuning, isPlaying, schoolId, bpm, reducedMotion: prefersReducedMotion });
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
    const bpm = getAmbientPlayerService()?.getBPM?.() || 90;
    sceneRef.current?.updateState({ signalLevel, schoolColor, glyph, isTuning, isPlaying, schoolId, bpm, reducedMotion: prefersReducedMotion });
  }, [signalLevel, schoolColor, glyph, isTuning, isPlaying, schoolId, prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className="crystal-ball-container"
      style={{ width: size, height: size, position: 'relative', overflow: 'visible' }}
    />
  );
};
