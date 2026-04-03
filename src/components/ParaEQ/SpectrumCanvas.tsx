import React, { useRef, useEffect } from 'react';
import { SCHOOLS } from '../../data/schools';

interface SpectrumCanvasProps {
  isPlaying: boolean;
  getByteFrequencyData: (array: Uint8Array) => void;
  currentSchoolId: string | null;
  signalLevel: number;
}

// Master Detection Zones (Derived from Acoustic Phonetics & Genre Mastering Curves)
const SCHOOL_DEFINITIONS = {
  void: { label: 'VOID', range: [20, 150], color: SCHOOLS.VOID?.color || '#a1a1aa' },
  sonic: { label: 'SONIC', range: [150, 500], color: SCHOOLS.SONIC?.color || '#651fff' },
  will: { label: 'WILL', range: [500, 2000], color: SCHOOLS.WILL?.color || '#FF8A00' },
  alchemy: { label: 'ALCHEMY', range: [2000, 6000], color: SCHOOLS.ALCHEMY?.color || '#D500F9' },
  psychic: { label: 'PSYCHIC', range: [6000, 20000], color: SCHOOLS.PSYCHIC?.color || '#00E5FF' },
};

/**
 * SpectrumCanvas — High-acuity spectral waveform graph.
 * Detects the song's "Sonic School" based on real-time energy distribution.
 */
export const SpectrumCanvas: React.FC<SpectrumCanvasProps> = ({
  isPlaying,
  getByteFrequencyData,
  currentSchoolId,
  signalLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataArrayRef = useRef<Uint8Array>(new Uint8Array(1024));
  const rafIdRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (!canvas || !ctx) return;

      // Sync internal resolution with display size
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const W = canvas.width;
      const H = canvas.height;

      // 1. Background
      ctx.fillStyle = '#0d0b06';
      ctx.fillRect(0, 0, W, H);

      // 2. Logarithmic Grid
      ctx.strokeStyle = 'rgba(201,162,39,0.10)';
      ctx.lineWidth = 1;
      const logGrid = [100, 1000, 10000];
      logGrid.forEach(freq => {
        const x = (Math.log10(freq / 20) / Math.log10(20000 / 20)) * W;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      });

      if (isPlaying) {
        getByteFrequencyData(dataArrayRef.current);
        const data = dataArrayRef.current;
        const bufferLength = data.length;

        // Energy bins for school detection
        const schoolEnergy = { void: 0, sonic: 0, will: 0, alchemy: 0, psychic: 0 };
        
        const getLogX = (index: number) => {
          const freq = (index * 22050) / bufferLength;
          if (freq <= 20) return 0;
          return (Math.log10(freq / 20) / Math.log10(20000 / 20)) * W;
        };

        // 3. Render Input Spectrum + Analyze Energy
        ctx.fillStyle = 'rgba(201,162,39,0.12)';
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let i = 0; i < bufferLength; i++) {
          const x = getLogX(i);
          const v = data[i] / 255.0;
          const y = H - (v * H);
          ctx.lineTo(x, y);

          // Bin energy by frequency
          const freq = (i * 22050) / bufferLength;
          if (freq >= 20 && freq < 150) schoolEnergy.void += v;
          else if (freq >= 150 && freq < 500) schoolEnergy.sonic += v;
          else if (freq >= 500 && freq < 2000) schoolEnergy.will += v;
          else if (freq >= 2000 && freq < 6000) schoolEnergy.alchemy += v;
          else if (freq >= 6000) schoolEnergy.psychic += v;
        }
        ctx.lineTo(W, H);
        ctx.fill();

        // 4. Render Sharp Output Waveform
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#c9a227';
        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const x = getLogX(i);
          const v = data[i] / 255.0;
          const y = H - (v * H);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 5. Dynamic School Detection Curves
        let maxEnergy = 0;
        let dominantSchool = 'void';
        Object.entries(schoolEnergy).forEach(([key, energy]) => {
          if (energy > maxEnergy) {
            maxEnergy = energy;
            dominantSchool = key;
          }
        });

        Object.entries(SCHOOL_DEFINITIONS).forEach(([key, def]) => {
          const energy = (schoolEnergy as any)[key];
          // Normalize energy relative to band width
          const normalizedEnergy = Math.min(1, energy / (bufferLength * 0.15));
          if (normalizedEnergy < 0.05) return;

          const startX = (Math.log10(def.range[0] / 20) / Math.log10(20000 / 20)) * W;
          const endX = (Math.log10(def.range[1] / 20) / Math.log10(20000 / 20)) * W;
          
          ctx.setLineDash([4, 4]);
          // School-hued ghost curve with dynamic opacity
          ctx.strokeStyle = `${def.color}${Math.floor(normalizedEnergy * 160).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = key === dominantSchool ? 4 : 1.5;
          
          ctx.beginPath();
          ctx.moveTo(startX, H);
          ctx.quadraticCurveTo((startX + endX)/2, H - (normalizedEnergy * H * 0.85), endX, H);
          ctx.stroke();
          
          // Label detected school in real-time
          if (key === dominantSchool && normalizedEnergy > 0.2) {
            ctx.fillStyle = def.color;
            ctx.font = '10px JetBrains Mono';
            ctx.fillText(def.label, startX + 5, H - (normalizedEnergy * H * 0.85) - 8);
          }
        });
        ctx.setLineDash([]);
      }

      rafIdRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isPlaying, getByteFrequencyData, currentSchoolId, signalLevel]);

  return (
    <canvas 
      ref={canvasRef} 
      className="paraeq-spectrum-canvas"
      style={{ width: '100%', height: '100%', borderRadius: '4px' }}
    />
  );
};
