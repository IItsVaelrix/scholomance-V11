import React, { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { ThaumaturgyRadarScene } from './scenes/ThaumaturgyRadarScene';

interface ThaumaturgyRadarProps {
  signalLevel: number;
  schoolColor: string;
  glyph: string;
  isTuning: boolean;
  schoolId?: string;
  size?: number;
}

export const ThaumaturgyRadar: React.FC<ThaumaturgyRadarProps> = ({
  signalLevel,
  schoolColor,
  glyph,
  isTuning,
  schoolId,
  size = 400,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<ThaumaturgyRadarScene | null>(null);

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
        scene: [ThaumaturgyRadarScene],
        fps: { target: 60 },
      });

      game.events.once('ready', () => {
        const scene = game?.scene.getScene('ThaumaturgyRadarScene') as ThaumaturgyRadarScene;
        sceneRef.current = scene;
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
    <div className="thaumaturgy-radar-container">
      <div
        ref={containerRef}
        style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}
      />
      {/* Brass Frame Overlay */}
      <div className="radar-frame" />
    </div>
  );
};
