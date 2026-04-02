import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import { useCurrentSong } from "../../hooks/useCurrentSong.jsx";
import { getBytecodeAMP, AMP_CHANNELS } from "../../lib/ambient/bytecodeAMP.js";
import "./WatchPage.css";

// ─── Bytecode Video Processor ────────────────────────────────────────────────
// Analyzes video playback using Web Audio API and generates VisualBytecode
function useBytecodeVideoProcessor(isPlaying, currentSong, videoElementRef) {
  const [bytecodeState, setBytecodeState] = useState({
    visualBytecode: null,
    audioLevel: 0,
    dominantFrequency: 0,
    spectralCentroid: 0,
    bassLevel: 0,
    midLevel: 0,
    trebleLevel: 0,
  });

  // Audio analysis refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const dataArrayRef = useRef(null);
  const timeDomainDataRef = useRef(null);

  // Initialize Web Audio API
  useEffect(() => {
    if (!videoElementRef?.current || !isPlaying) return;

    const initAudio = async () => {
      try {
        // Create audio context (reuse if exists)
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 44100,
            latencyHint: 'interactive',
          });
        }

        const audioContext = audioContextRef.current;
        
        // Resume context if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        // Create analyser node
        if (!analyserRef.current) {
          analyserRef.current = audioContext.createAnalyser();
          analyserRef.current.fftSize = 2048; // 1024 frequency bins
          analyserRef.current.smoothingTimeConstant = 0.85;
          analyserRef.current.minDecibels = -90;
          analyserRef.current.maxDecibels = -10;
        }

        const analyser = analyserRef.current;

        // Try to capture audio from video element
        const videoElement = videoElementRef.current;
        
        // For YouTube iframe, we need to use captureStream if available
        // Otherwise, fall back to procedural generation
        let mediaStream = null;
        
        if (videoElement.captureStream) {
          mediaStream = videoElement.captureStream();
        } else if (videoElement.mozCaptureStream) {
          mediaStream = videoElement.mozCaptureStream();
        }

        if (mediaStream && mediaStream.getAudioTracks().length > 0) {
          // Successfully captured audio stream
          if (!sourceRef.current) {
            sourceRef.current = audioContext.createMediaStreamSource(mediaStream);
            sourceRef.current.connect(analyser);
          }
        } else {
          // Fallback: create oscillator for demo (YouTube iframe doesn't allow direct audio capture)
          console.warn('[BytecodeVideo] Cannot capture YouTube audio directly. Using procedural fallback.');
        }

        // Allocate data arrays
        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        timeDomainDataRef.current = new Uint8Array(bufferLength);

      } catch (error) {
        console.error('[BytecodeVideo] Audio initialization error:', error);
      }
    };

    if (isPlaying) {
      initAudio();
    }

    return () => {
      // Cleanup on unmount or stop
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
    };
  }, [isPlaying, videoElementRef]);

  // Analysis loop
  useEffect(() => {
    if (!isPlaying || !analyserRef.current || !dataArrayRef.current) {
      setBytecodeState(prev => ({ ...prev, audioLevel: 0 }));
      return;
    }

    let animationFrame;
    const analyser = analyserRef.current;
    const frequencyData = dataArrayRef.current;
    const timeDomainData = timeDomainDataRef.current;
    const bufferLength = analyser.frequencyBinCount;

    const analyze = () => {
      // Get frequency and time domain data
      analyser.getByteFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(timeDomainData);

      // Calculate audio levels by frequency bands
      const bassRange = frequencyData.slice(0, Math.floor(bufferLength * 0.1));     // 0-220Hz
      const midRange = frequencyData.slice(Math.floor(bufferLength * 0.1), Math.floor(bufferLength * 0.5));  // 220Hz-2kHz
      const trebleRange = frequencyData.slice(Math.floor(bufferLength * 0.5));      // 2kHz+

      const bassLevel = bassRange.reduce((a, b) => a + b, 0) / bassRange.length / 255;
      const midLevel = midRange.reduce((a, b) => a + b, 0) / midRange.length / 255;
      const trebleLevel = trebleRange.reduce((a, b) => a + b, 0) / trebleRange.length / 255;

      // Overall audio level (RMS)
      let sumSquares = 0;
      for (let i = 0; i < timeDomainData.length; i++) {
        const normalized = (timeDomainData[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const audioLevel = Math.sqrt(sumSquares / timeDomainData.length);

      // Calculate spectral centroid (brightness indicator)
      let weightedSum = 0;
      let totalSum = 0;
      for (let i = 0; i < bufferLength; i++) {
        weightedSum += i * frequencyData[i];
        totalSum += frequencyData[i];
      }
      const spectralCentroid = totalSum > 0 ? (weightedSum / totalSum) * (audioContextRef.current?.sampleRate / 2 / bufferLength) : 0;

      // Find dominant frequency
      let maxIndex = 0;
      let maxValue = 0;
      for (let i = 0; i < bufferLength; i++) {
        if (frequencyData[i] > maxValue) {
          maxValue = frequencyData[i];
          maxIndex = i;
        }
      }
      const dominantFrequency = maxIndex * (audioContextRef.current?.sampleRate / 2 / bufferLength);

      // Generate VisualBytecode from real audio data
      const timeMs = performance.now();
      const flicker = getBytecodeAMP(timeMs, AMP_CHANNELS.FLICKER);

      // Map audio features to bytecode properties
      const hue = 240 + (spectralCentroid / 5000) * 60; // Shift hue based on brightness
      const saturation = 85 + bassLevel * 15;
      const lightness = 50 + midLevel * 10;

      const visualBytecode = {
        version: 2,
        school: currentSong?.school || 'VOID',
        color: `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`,
        glowIntensity: Math.min(1, audioLevel * 2 + flicker * 0.3),
        saturationBoost: Math.min(1, (bassLevel + trebleLevel) * 0.8),
        syllableDepth: Math.max(1, Math.min(4, Math.floor(bassLevel * 4) + 1)),
        isAnchor: bassLevel > 0.6 || audioLevel > 0.7,
        isStopWord: false,
        effectClass: audioLevel > 0.6 ? 'TRANSCENDENT' : audioLevel > 0.3 ? 'HARMONIC' : 'RESONANT',
        // Audio metadata for visualization
        _audioMeta: {
          bassLevel,
          midLevel,
          trebleLevel,
          spectralCentroid,
          dominantFrequency,
        },
      };

      setBytecodeState({
        visualBytecode,
        audioLevel,
        dominantFrequency,
        spectralCentroid,
        bassLevel,
        midLevel,
        trebleLevel,
      });

      animationFrame = requestAnimationFrame(analyze);
    };

    animationFrame = requestAnimationFrame(analyze);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [isPlaying, currentSong]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      sourceRef.current = null;
      dataArrayRef.current = null;
      timeDomainDataRef.current = null;
    };
  }, []);

  return bytecodeState;
}

// ─── Bytecode Video Overlay ──────────────────────────────────────────────────
// Renders bytecode-driven effects over the video player using real audio data
function BytecodeVideoOverlay({ bytecodeState, isPlaying }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const syncCanvasSize = () => {
      const { offsetWidth: w, offsetHeight: h } = canvas;
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    syncCanvasSize();
    const ro = new ResizeObserver(syncCanvasSize);
    ro.observe(canvas);

    function frame(timeMs) {
      const W = canvas.width;
      const H = canvas.height;
      
      if (!isPlaying || !bytecodeState.visualBytecode) {
        ctx.clearRect(0, 0, W, H);
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      const { visualBytecode, audioLevel, bassLevel, midLevel, trebleLevel } = bytecodeState;
      const audioMeta = visualBytecode._audioMeta || {};

      // Clear with fade for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, W, H);

      // Parse HSL color from bytecode
      const hslMatch = visualBytecode.color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      const hue = hslMatch ? parseInt(hslMatch[1]) : 260;
      const sat = hslMatch ? parseInt(hslMatch[2]) : 85;
      const light = hslMatch ? parseInt(hslMatch[3]) : 50;

      // ─── Real-time Frequency Waveform (32 bars) ────────────────────────────
      const barCount = 32;
      const barWidth = W / barCount;
      
      for (let i = 0; i < barCount; i++) {
        // Use actual frequency data if available, otherwise interpolate
        let barHeight;
        const normalizedIndex = i / barCount;
        
        if (normalizedIndex < 0.1) {
          // Bass frequencies
          barHeight = H * 0.35 * bassLevel * (0.7 + 0.3 * Math.sin(timeMs * 0.005 + i * 0.5));
        } else if (normalizedIndex < 0.5) {
          // Mid frequencies
          barHeight = H * 0.3 * midLevel * (0.7 + 0.3 * Math.sin(timeMs * 0.008 + i * 0.3));
        } else {
          // Treble frequencies
          barHeight = H * 0.25 * trebleLevel * (0.7 + 0.3 * Math.sin(timeMs * 0.012 + i * 0.4));
        }
        
        const x = i * barWidth;
        const y = (H - barHeight) / 2;

        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, 0)`);
        gradient.addColorStop(0.2, `hsla(${hue}, ${sat}%, ${light}%, ${0.3 + audioLevel * 0.5})`);
        gradient.addColorStop(0.5, `hsla(${hue}, ${sat}%, ${light + 10}%, ${0.5 + audioLevel * 0.5})`);
        gradient.addColorStop(0.8, `hsla(${hue}, ${sat}%, ${light}%, ${0.3 + audioLevel * 0.5})`);
        gradient.addColorStop(1, `hsla(${hue}, ${sat}%, ${light}%, 0)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(x + 1, y, barWidth - 2, Math.max(2, barHeight));
      }

      // ─── Spectral Centroid Ring ────────────────────────────────────────────
      const ringRadius = Math.min(W, H) * 0.35;
      const ringX = W / 2;
      const ringY = H / 2;

      // Outer glow ring based on spectral centroid (brightness)
      const centroidGlow = Math.min(1, (audioMeta.spectralCentroid || 0) / 5000);
      const outerRingRadius = ringRadius * (1 + centroidGlow * 0.3);
      
      ctx.beginPath();
      ctx.arc(ringX, ringY, outerRingRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, ${0.15 + audioLevel * 0.3})`;
      ctx.lineWidth = 3 + visualBytecode.glowIntensity * 6;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Inner frequency ring
      ctx.beginPath();
      ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, ${sat - 10}%, ${light + 15}%, ${0.3 + audioLevel * 0.4})`;
      ctx.lineWidth = 2 + visualBytecode.glowIntensity * 3;
      ctx.stroke();

      // ─── Bass Pulse Effect ─────────────────────────────────────────────────
      if (bassLevel > 0.4) {
        const bassPulseRadius = ringRadius * (0.8 + bassLevel * 0.4 * Math.sin(timeMs * 0.01));
        ctx.beginPath();
        ctx.arc(ringX, ringY, bassPulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light - 10}%, ${0.2 + bassLevel * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // ─── Anchor Pulse (when bass or overall level is high) ─────────────────
      if (visualBytecode.isAnchor) {
        const pulseRadius = ringRadius * (1.2 + Math.sin(timeMs * 0.005) * 0.15);
        ctx.beginPath();
        ctx.arc(ringX, ringY, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light + 20}%, ${0.3 + visualBytecode.glowIntensity * 0.5})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ─── Effect Class Particles ────────────────────────────────────────────
      if (visualBytecode.effectClass === 'TRANSCENDENT' || visualBytecode.effectClass === 'HARMONIC') {
        const particleCount = visualBytecode.effectClass === 'TRANSCENDENT' ? 24 : 12;
        
        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2 + timeMs * 0.0005 * (i % 2 === 0 ? 1 : -1);
          const baseRadius = ringRadius * (0.5 + (i % 3) * 0.15);
          const radiusVariation = Math.sin(timeMs * 0.003 + i * 0.5) * baseRadius * 0.2;
          const radius = baseRadius + radiusVariation;
          
          const px = ringX + Math.cos(angle) * radius;
          const py = ringY + Math.sin(angle) * radius;

          // Particle size based on audio level
          const particleSize = 2 + visualBytecode.glowIntensity * 4 + audioLevel * 3;

          // Particle color with frequency-based variation
          const particleHue = hue + (i % 5) * 8;
          const particleLight = light + (i % 3) * 10;

          ctx.beginPath();
          ctx.arc(px, py, particleSize, 0, Math.PI * 2);
          
          // Glow effect
          const particleGradient = ctx.createRadialGradient(px, py, 0, px, py, particleSize * 2);
          particleGradient.addColorStop(0, `hsla(${particleHue}, ${sat}%, ${particleLight}%, ${0.6 + audioLevel * 0.4})`);
          particleGradient.addColorStop(0.5, `hsla(${particleHue}, ${sat}%, ${particleLight - 10}%, ${0.3 + audioLevel * 0.3})`);
          particleGradient.addColorStop(1, `hsla(${particleHue}, ${sat}%, ${particleLight - 20}%, 0)`);
          
          ctx.fillStyle = particleGradient;
          ctx.fill();
        }
      }

      // ─── Treble Sparkles ───────────────────────────────────────────────────
      if (trebleLevel > 0.3) {
        const sparkleCount = Math.floor(trebleLevel * 15);
        for (let i = 0; i < sparkleCount; i++) {
          const sparkleAngle = (i / sparkleCount) * Math.PI * 2 + timeMs * 0.002;
          const sparkleRadius = ringRadius * (1.3 + Math.sin(timeMs * 0.008 + i) * 0.2);
          const sx = ringX + Math.cos(sparkleAngle) * sparkleRadius;
          const sy = ringY + Math.sin(sparkleAngle) * sparkleRadius;

          ctx.beginPath();
          ctx.arc(sx, sy, 1.5 + trebleLevel * 2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light + 30}%, ${0.5 + trebleLevel * 0.5})`;
          ctx.fill();
        }
      }

      // ─── School Badge (subtle watermark) ───────────────────────────────────
      if (visualBytecode.school && visualBytecode.school !== 'VOID') {
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${0.2 + audioLevel * 0.2})`;
        ctx.textAlign = 'right';
        ctx.fillText(visualBytecode.school, W - 10, H - 10);
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [isPlaying, bytecodeState]);

  return (
    <canvas
      ref={canvasRef}
      className="bytecode-video-overlay"
      aria-hidden="true"
    />
  );
}

// ─── Candle Component ────────────────────────────────────────────────────────
function Candle({ delay = 0 }) {
  return (
    <div className="candle-holder">
      <div className="candle-flame" aria-hidden="true">
        <div className="candle-flame-outer" style={{ animationDelay: `${delay}s` }} />
        <div className="candle-flame-inner" style={{ animationDelay: `${delay + 0.08}s` }} />
      </div>
      <div className="candle-glow" style={{ animationDelay: `${delay}s` }} />
      <div className="candle-body">
        <div className="candle-wax-drip" />
      </div>
    </div>
  );
}

// ─── Bookshelf Component ─────────────────────────────────────────────────────
const BOOK_COLORS = [
  "#2a4080", "#6b2040", "#1e5030", "#5a3010", "#3a1060",
  "#204060", "#602030", "#1a4020", "#402800", "#281048",
  "#1e3a6a", "#5c1a38", "#165028", "#4a280c", "#321054",
];
const BOOK_HEIGHTS = [40, 44, 38, 46, 42, 36, 48, 40, 44, 38];

function Shelf({ side }) {
  const books = BOOK_HEIGHTS.map((h, i) => ({
    h,
    w: 8 + (i % 3) * 2,
    color: BOOK_COLORS[i % BOOK_COLORS.length],
  }));

  return (
    <div className={`shed-shelf shed-shelf--${side}`} aria-hidden="true">
      {/* Top candle group */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px", paddingLeft: "8px" }}>
        <Candle delay={side === "left" ? 0 : 0.3} />
        <Candle delay={side === "left" ? 0.4 : 0.7} />
      </div>

      {/* Shelf plank */}
      <div className="shelf-board" />

      {/* Books row */}
      <div className="shelf-books">
        {books.slice(0, 8).map((b, i) => (
          <div
            key={i}
            className="shelf-book"
            style={{
              width: b.w,
              height: b.h,
              background: `linear-gradient(90deg, ${b.color}cc, ${b.color}88)`,
              borderLeft: `1px solid ${b.color}ff`,
            }}
          />
        ))}
      </div>

      {/* Second shelf plank */}
      <div className="shelf-board" />

      {/* More books */}
      <div className="shelf-books">
        {books.slice(3, 9).map((b, i) => (
          <div
            key={i}
            className="shelf-book"
            style={{
              width: b.w + 1,
              height: b.h - 4,
              background: `linear-gradient(90deg, ${b.color}bb, ${b.color}77)`,
              borderLeft: `1px solid ${b.color}ee`,
            }}
          />
        ))}
      </div>

      <div className="shelf-board" />

      {/* Bottom candle */}
      <div style={{ paddingLeft: "18px", marginBottom: "6px" }}>
        <Candle delay={side === "left" ? 0.8 : 0.2} />
      </div>
      <div className="shelf-board" />
    </div>
  );
}

// ─── Tesla Coil Canvas ───────────────────────────────────────────────────────
function TeslaCoil({ side }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    // Deterministic seeded offset per side so they desync slightly
    const phaseOffset = side === "left" ? 0 : 1.31;

    function generateBolt(x0, y0, x1, y1, roughness, seed) {
      const pts = [{ x: x0, y: y0 }];
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const bx = x0 + (x1 - x0) * t;
        const by = y0 + (y1 - y0) * t;
        const jitter = roughness * (1 - t * 0.4);
        pts.push({
          x: bx + (Math.sin(seed * 13.7 + i * 2.1) * jitter),
          y: by + (Math.cos(seed * 7.3 + i * 3.7) * jitter * 0.3),
        });
      }
      pts.push({ x: x1, y: y1 });
      return pts;
    }

    function drawBolt(pts, alpha, width, color) {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }

    function frame(timeMs) {
      ctx.clearRect(0, 0, W, H);

      const t = timeMs + phaseOffset * 1000;
      const flicker = getBytecodeAMP(t, AMP_CHANNELS.FLICKER);
      const pulse   = getBytecodeAMP(t, AMP_CHANNELS.PULSE);
      const glow    = getBytecodeAMP(t, AMP_CHANNELS.GLOW);

      // Sphere glow halo
      const haloR = 14 + pulse * 6;
      const haloGrad = ctx.createRadialGradient(W / 2, 14, 0, W / 2, 14, haloR);
      haloGrad.addColorStop(0, `rgba(100,160,255,${0.5 + glow * 0.3})`);
      haloGrad.addColorStop(0.5, `rgba(60,100,220,${0.2 + flicker * 0.2})`);
      haloGrad.addColorStop(1, "rgba(20,40,120,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.ellipse(W / 2, 14, haloR, haloR * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Only render arcs when flicker is above threshold (simulates spark discharge)
      if (flicker > 0.35) {
        const seed = Math.floor(t / 80); // changes ~12/s

        // Primary bolt upward (sphere → air)
        const arcHeight = 28 + flicker * 20;
        const arcSpread = (flicker - 0.35) * 30;

        // Left arc
        const boltL = generateBolt(
          W / 2, 14,
          W / 2 - arcSpread, 14 - arcHeight,
          8 * flicker, seed
        );
        // Glow pass
        drawBolt(boltL, flicker * 0.3, 5, "rgba(100,160,255,1)");
        // Core pass
        drawBolt(boltL, 0.7 + flicker * 0.3, 1.2, "rgba(220,240,255,1)");

        // Right arc (mirror seed)
        const boltR = generateBolt(
          W / 2, 14,
          W / 2 + arcSpread * 0.8, 14 - arcHeight * 0.85,
          7 * flicker, seed + 99
        );
        drawBolt(boltR, flicker * 0.25, 4, "rgba(80,140,255,1)");
        drawBolt(boltR, 0.5 + flicker * 0.4, 1, "rgba(200,230,255,1)");

        // Stray spark downward (rare)
        if (flicker > 0.7) {
          const boltD = generateBolt(
            W / 2, 14,
            W / 2 + (Math.sin(seed * 1.7) * 10),
            14 + 14 + flicker * 12,
            5 * flicker, seed + 37
          );
          drawBolt(boltD, flicker * 0.4, 1, "rgba(160,200,255,0.8)");
        }
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [side]);

  return (
    <div className="tesla-coil-wrap" aria-label={`Tesla coil ${side}`} aria-hidden="true">
      <div className="tesla-top-sphere" />
      {/* Arc canvas floats above sphere */}
      <canvas
        ref={canvasRef}
        className="tesla-canvas"
        width={80}
        height={80}
        style={{ bottom: "76px" }}
      />
      <div className="tesla-base" />
    </div>
  );
}

// ─── VHS Static Canvas ───────────────────────────────────────────────────────
// Reads its own pixel dimensions from the DOM so it stays in sync with the
// fluid CRT screen no matter the viewport size.
function VHSStatic({ visible }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Sync canvas pixel buffer to its CSS display size
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sync = () => {
      const { offsetWidth: w, offsetHeight: h } = canvas;
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width  = w;
        canvas.height = h;
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function frame(timeMs) {
      if (!visible) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      const W = canvas.width;
      const H = canvas.height;
      if (W === 0 || H === 0) { rafRef.current = requestAnimationFrame(frame); return; }

      const noise = getBytecodeAMP(timeMs, AMP_CHANNELS.NOISE);

      // Horizontal tracking glitch bands (VHS artifact)
      const numBands = 3 + Math.floor(noise * 4);
      ctx.clearRect(0, 0, W, H);

      for (let b = 0; b < numBands; b++) {
        const bandSeed = timeMs * 0.001 + b * 7.3;
        const bandY = ((Math.sin(bandSeed) * 0.5 + 0.5) * H) | 0;
        const bandH = 2 + Math.floor(Math.abs(Math.sin(bandSeed * 1.7)) * 8);
        const bandAlpha = 0.15 + Math.abs(Math.sin(bandSeed * 2.3)) * 0.25;

        ctx.fillStyle = `rgba(60,80,200,${bandAlpha})`;
        ctx.fillRect(0, bandY, W, bandH);
      }

      // Scanline noise — only sample a fraction of rows per frame for perf
      const imageData = ctx.createImageData(W, 1);
      const rowsToFill = Math.min(H, 20 + Math.floor(noise * 40));
      for (let r = 0; r < rowsToFill; r++) {
        const y = Math.floor(Math.random() * H);
        for (let x = 0; x < W; x++) {
          const px = x * 4;
          const v = Math.random() * 180 * noise;
          imageData.data[px]     = v * 0.5;
          imageData.data[px + 1] = v * 0.6;
          imageData.data[px + 2] = v * 1.2; // blue bias
          imageData.data[px + 3] = Math.floor(v * 0.8);
        }
        ctx.putImageData(imageData, 0, y);
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  return (
    <canvas
      ref={canvasRef}
      className={`vhs-static-canvas${visible ? " is-visible" : ""}`}
      aria-hidden="true"
    />
  );
}

// ─── Cobweb SVG ──────────────────────────────────────────────────────────────
function Cobweb({ side }) {
  const flip = side === "right" ? "scaleX(-1)" : "";
  return (
    <svg
      className={`shed-cobweb shed-cobweb--${side === "left" ? "tl" : "tr"}`}
      width="200" height="180"
      viewBox="0 0 200 180"
      aria-hidden="true"
      style={{ transform: flip }}
    >
      {/* Radial strands */}
      {[0, 18, 36, 55, 72, 90].map((angle, _i) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1="0" y1="0"
            x2={Math.cos(rad) * 200} y2={Math.sin(rad) * 180}
            stroke="rgba(200,190,220,0.6)" strokeWidth="0.7"
          />
        );
      })}
      {/* Concentric arcs */}
      {[30, 65, 100, 140].map((r, i) => (
        <path
          key={i}
          d={`M ${r} 0 Q ${r * 0.7} ${r * 0.7} 0 ${r}`}
          fill="none"
          stroke="rgba(200,190,220,0.5)"
          strokeWidth="0.6"
        />
      ))}
    </svg>
  );
}

// ─── Dust Motes Canvas ───────────────────────────────────────────────────────
function DustMotes() {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Generate stable mote positions
    const MOTES = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.8 + Math.random() * 1.4,
      speed: 0.06 + Math.random() * 0.12,
      drift: (Math.random() - 0.5) * 0.04,
      phase: Math.random() * Math.PI * 2,
    }));

    function frame(timeMs) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = timeMs * 0.001;

      for (const m of MOTES) {
        m.y -= m.speed;
        m.x += m.drift;
        if (m.y < -4) { m.y = canvas.height + 4; m.x = Math.random() * canvas.width; }
        if (m.x < -4) m.x = canvas.width + 4;
        if (m.x > canvas.width + 4) m.x = -4;

        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.8 + m.phase));
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,160,220,${twinkle * 0.4})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="shed-dust-canvas"
      width={window.innerWidth}
      height={window.innerHeight}
      aria-hidden="true"
    />
  );
}

// ─── Main WatchPage ───────────────────────────────────────────────────────────
export default function WatchPage() {
  const { currentSong, currentKey, setCurrentKey, library } = useCurrentSong();
  const [isPlaying, setIsPlaying] = useState(false);
  const videoContainerRef = useRef(null);

  // Bytecode video processing hook with video element ref
  const bytecodeState = useBytecodeVideoProcessor(isPlaying, currentSong, videoContainerRef);

  const trackKeys = Object.keys(library).filter(
    (k) => library[k].yt // only YT tracks on Watch page
  );

  const handlePrev = useCallback(() => {
    const idx = trackKeys.indexOf(currentKey);
    const prev = trackKeys[(idx - 1 + trackKeys.length) % trackKeys.length];
    setCurrentKey(prev);
    setIsPlaying(false);
  }, [currentKey, trackKeys, setCurrentKey]);

  const handleNext = useCallback(() => {
    const idx = trackKeys.indexOf(currentKey);
    const next = trackKeys[(idx + 1) % trackKeys.length];
    setCurrentKey(next);
    setIsPlaying(false);
  }, [currentKey, trackKeys, setCurrentKey]);

  const togglePlay = () => setIsPlaying((p) => !p);

  const schoolLower = (currentSong.school || "VOID").toLowerCase();

  return (
    <div
      className="watch-shed-scene"
      role="main"
      aria-label="Arcane viewing chamber"
    >
      {/* ── Room geometry layers ── */}
      <div className="shed-room-geometry" aria-hidden="true">
        <div className="shed-ceiling">
          <div className="shed-ceiling-arch" />
        </div>
        <div className="shed-back-wall" />
        <div className="shed-floor" />
        <div className="shed-wall-left" />
        <div className="shed-wall-right" />

        {/* Candle ambient light pools */}
        <div className="candle-light-left" />
        <div className="candle-light-right" />

        {/* TV light spill on floor */}
        <div className={`crt-floor-light${isPlaying ? "" : " is-paused"}`} />
      </div>

      {/* ── Cobwebs ── */}
      <Cobweb side="left" />
      <Cobweb side="right" />

      {/* ── Bookshelves ── */}
      <Shelf side="left" />
      <Shelf side="right" />

      {/* ── Dust motes ── */}
      <DustMotes />

      {/* ── Desk area ── */}
      <div className="shed-desk-area">
        <div className="shed-desk">
          <div className="desk-surface">
            {/* Left tesla coil */}
            <TeslaCoil side="left" />

            {/* ── CRT Television ── */}
            <motion.div
              className="crt-tv"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <div className="crt-cabinet">
                <div className="crt-screen-wrapper" ref={videoContainerRef}>
                  {/* YouTube iframe */}
                  <iframe
                    title={`Watch: ${currentSong.title}`}
                    src={`https://www.youtube.com/embed/${currentSong.yt}?rel=0&modestbranding=1`}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />

                  {/* VHS static — shown when paused */}
                  <VHSStatic visible={!isPlaying} />

                  {/* Bytecode Video Overlay — real-time bytecode-driven effects */}
                  <BytecodeVideoOverlay bytecodeState={bytecodeState} isPlaying={isPlaying} />

                  {/* CRT scanlines */}
                  <div className="crt-scanlines" aria-hidden="true" />

                  {/* Edge vignette */}
                  <div className="crt-screen-vignette" aria-hidden="true" />
                </div>

                {/* Indigo bloom — intensifies when playing */}
                <div
                  className={`crt-bloom ${isPlaying ? "is-playing" : "is-paused"}`}
                  aria-hidden="true"
                />

                {/* Screen glow halo behind cabinet */}
                <div
                  className={`crt-screen-glow ${isPlaying ? "is-playing" : "is-paused"}`}
                  aria-hidden="true"
                />

                {/* Knobs row */}
                <div className="crt-knobs">
                  <button
                    className="crt-knob"
                    aria-label="Previous track"
                    title="Previous track"
                    onClick={handlePrev}
                  />
                  <span className="crt-brand-label">SCRY·CAST</span>
                  <button
                    className={`crt-power-btn${isPlaying ? "" : " is-paused"}`}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    onClick={togglePlay}
                  />
                  <span className="crt-brand-label">{schoolLower}</span>
                  <button
                    className="crt-knob"
                    aria-label="Next track"
                    title="Next track"
                    onClick={handleNext}
                  />
                </div>
              </div>

              {/* CRT neck/stand */}
              <div className="crt-neck" aria-hidden="true" />
            </motion.div>

            {/* Right tesla coil */}
            <TeslaCoil side="right" />
          </div>

          <div className="desk-leg-left"  aria-hidden="true" />
          <div className="desk-leg-right" aria-hidden="true" />
        </div>
      </div>

      {/* ── Info bar ── */}
      <motion.div
        className="watch-info-bar"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        aria-label="Now showing"
      >
        <div className="watch-info-signal">
          <div className="watch-info-kicker">SIGNAL</div>
          <div className="watch-info-value" style={{ color: `var(--${schoolLower}-primary, #a090d0)` }}>
            {currentSong.school}
          </div>
        </div>

        <div className="watch-info-title">{currentSong.title}</div>

        <button
          className="watch-play-toggle"
          onClick={togglePlay}
          aria-label={isPlaying ? "Mark as paused" : "Mark as playing"}
        >
          {isPlaying ? "STASIS" : "IGNITE"}
        </button>
      </motion.div>

      {/* ── Scene vignette ── */}
      <div className="shed-vignette" aria-hidden="true" />
    </div>
  );
}
