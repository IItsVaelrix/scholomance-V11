import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import "./PixelBrainTerminal.css";

function LatticeCanvas({ coordinates, canvas, palettes, isAnalyzing }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const progressRef = useRef(0);

  const drawLattice = useCallback((ctx, width, height, progress = 1) => {
    // Clear canvas
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 0.5;
    const gridSize = canvas?.gridSize || 1;
    for (let x = 0; x <= width; x += gridSize * 4) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize * 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw golden point
    if (canvas?.goldenPoint) {
      const gpX = (canvas.goldenPoint.x / canvas.width) * width;
      const gpY = (canvas.goldenPoint.y / canvas.height) * height;
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      ctx.arc(gpX, gpY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(gpX, 0);
      ctx.lineTo(gpX, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, gpY);
      ctx.lineTo(width, gpY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Build palette lookup
    const paletteMap = new Map();
    (palettes || []).forEach((palette) => {
      paletteMap.set(palette.key, palette.colors);
    });

    // Draw coordinates with progressive reveal
    const safeCoords = (coordinates || []).slice(0, Math.ceil((coordinates || []).length * progress));

    safeCoords.forEach((coord, index) => {
      const x = (coord.snappedX / canvas.width) * width;
      const y = (coord.snappedY / canvas.height) * height;
      
      // Use direct color if available (from image), otherwise use palette
      let color = coord.color;
      if (!color) {
        const colors = paletteMap.get(coord.paletteKey) || ["#666666"];
        const colorIndex = Math.floor(coord.emphasis * (colors.length - 1));
        color = colors[Math.min(colorIndex, colors.length - 1)];
      }

      // Draw node
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 4 + coord.emphasis * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw connection to next point
      if (index < safeCoords.length - 1) {
        const nextCoord = safeCoords[index + 1];
        const nextX = (nextCoord.snappedX / canvas.width) * width;
        const nextY = (nextCoord.snappedY / canvas.height) * height;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1 + coord.emphasis * 2;
        ctx.globalAlpha = 0.4 + coord.emphasis * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nextX, nextY);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Draw token label (only for non-image sources)
      if (!coord.source || !coord.source.startsWith('image')) {
        ctx.fillStyle = "#888";
        ctx.font = "8px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(coord.token.substring(0, 6), x, y + 18);
      }
    });

    // Draw scan line effect
    if (isAnalyzing) {
      const scanY = (Date.now() / 5) % height;
      ctx.fillStyle = "rgba(0, 255, 136, 0.1)";
      ctx.fillRect(0, scanY - 20, width, 40);
    }
  }, [coordinates, canvas, palettes, isAnalyzing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = 320;
    const height = 288;
    canvas.width = width;
    canvas.height = height;

    if (isAnalyzing) {
      progressRef.current = 0;
      const animate = () => {
        progressRef.current = Math.min(1, progressRef.current + 0.02);
        drawLattice(ctx, width, height, progressRef.current);
        if (progressRef.current < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      drawLattice(ctx, width, height, 1);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [coordinates, canvas, palettes, isAnalyzing, drawLattice]);

  return (
    <div className="lattice-container">
      <canvas
        ref={canvasRef}
        className="lattice-canvas"
        aria-label="Phonetic lattice visualization"
        role="img"
      />
      <div className="lattice-overlay" aria-hidden="true">
        <div className="overlay-corner top-left"></div>
        <div className="overlay-corner top-right"></div>
        <div className="overlay-corner bottom-left"></div>
        <div className="overlay-corner bottom-right"></div>
      </div>
    </div>
  );
}

function PaletteDisplay({ palettes }) {
  if (!palettes || palettes.length === 0) {
    return (
      <div className="palette-section empty">
        <div className="section-header">
          <span className="header-icon">&#x25A0;</span>
          <span>PALETTE REGISTRY</span>
        </div>
        <div className="empty-message">NO PALETTES STABILIZED</div>
      </div>
    );
  }

  return (
    <div className="palette-section">
      <div className="section-header">
        <span className="header-icon">&#x25A0;</span>
        <span>PALETTE REGISTRY</span>
      </div>
      <div className="palette-grid">
        {palettes.map((palette, index) => (
          <motion.div
            key={palette.key}
            className="palette-entry"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="palette-header">
              <span className="palette-school">{palette.schoolId}</span>
              <span className="palette-rarity">{palette.rarity}</span>
              <span className="palette-effect">{palette.effect}</span>
            </div>
            <div className="palette-swatches">
              {palette.colors.map((color, colorIndex) => (
                <div
                  key={colorIndex}
                  className="palette-swatch"
                  style={{ backgroundColor: color }}
                  title={`Color ${colorIndex}: ${color}`}
                  aria-label={`Palette color ${colorIndex + 1}: ${color}`}
                />
              ))}
            </div>
            <div className="palette-bytecode">
              {palette.bytecode}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AnalysisMetrics({ result }) {
  if (!result) return null;

  if (result.message) {
    return (
      <div className="metrics-section">
        <div className="section-header">
          <span className="header-icon">&#x25C6;</span>
          <span>ANALYSIS METRICS</span>
        </div>
        <div className="empty-message" style={{ textAlign: "center", padding: "20px" }}>
          {result.message}
        </div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="metrics-section">
        <div className="section-header">
          <span className="header-icon">&#x25C6;</span>
          <span>ANALYSIS METRICS</span>
        </div>
        <div className="error-message" style={{ textAlign: "center", padding: "20px", color: "#ff6b6b" }}>
          {result.error}
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "TOKENS", value: result.tokenCount },
    { label: "ACTIVE", value: result.activeTokenCount },
    { label: "PALETTES", value: result.paletteCount },
    { label: "AXIS", value: result.dominantAxis?.toUpperCase() || "N/A" },
    { label: "SYMMETRY", value: result.dominantSymmetry?.toUpperCase() || "N/A" },
    { label: "COVERAGE", value: `${Math.round((result.activeTokenCount / Math.max(1, result.tokenCount)) * 100)}%` },
  ];

  return (
    <div className="metrics-section">
      <div className="section-header">
        <span className="header-icon">&#x25C6;</span>
        <span>ANALYSIS METRICS</span>
      </div>
      <div className="metrics-grid">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            className="metric-cell"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function IdleState() {
  return (
    <div className="terminal-idle">
      <div className="idle-glyph" aria-hidden="true">
        <svg viewBox="0 0 100 100" className="glyph-svg">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#333" strokeWidth="1" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="#222" strokeWidth="1" />
          <circle cx="50" cy="50" r="20" fill="none" stroke="#1a1a1a" strokeWidth="1" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#222" strokeWidth="0.5" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="#222" strokeWidth="0.5" />
          <line x1="22" y1="22" x2="78" y2="78" stroke="#222" strokeWidth="0.5" />
          <line x1="78" y1="22" x2="22" y2="78" stroke="#222" strokeWidth="0.5" />
        </svg>
      </div>
      <div className="idle-message">
        <p>AWAITING INPUT STREAM</p>
        <p className="idle-subtext">Initialize phonetic lattice synthesis</p>
      </div>
      <div className="idle-commands">
        <span className="command-key">ENTER</span>
        <span className="command-text">verse text above</span>
        <span className="command-key">CLICK</span>
        <span className="command-text">select preset</span>
        <span className="command-key">SCAN</span>
        <span className="command-text">initiate analysis</span>
      </div>
    </div>
  );
}

function AnalyzingState() {
  return (
    <div className="terminal-analyzing">
      <div className="analyzing-ring" aria-hidden="true">
        <div className="ring-outer"></div>
        <div className="ring-middle"></div>
        <div className="ring-inner"></div>
      </div>
      <div className="analyzing-text">
        <span className="text-line">PARSING PHONEMES</span>
        <span className="text-line">GENERATING BYTECODE</span>
        <span className="text-line">MAPPING COORDINATES</span>
        <span className="text-line">STABILIZING PALETTES</span>
      </div>
      <div className="analyzing-progress">
        <div className="progress-bar">
          <div className="progress-fill"></div>
        </div>
      </div>
    </div>
  );
}

export default function PixelBrainTerminal({ mode, analysisResult }) {
  return (
    <div className="pixelbrain-terminal">
      {/* CRT Effects */}
      <div className="crt-overlay" aria-hidden="true">
        <div className="scanlines"></div>
        <div className="phosphor-glow"></div>
        <div className="screen-curve"></div>
      </div>

      {/* Terminal Content */}
      <div className="terminal-screen">
        {mode === "input" && <IdleState />}
        {mode === "analyzing" && <AnalyzingState />}
        {mode === "result" && analysisResult && (
          <motion.div
            className="terminal-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="results-header">
              <span className="header-status">
                {analysisResult.error ? "ANALYSIS FAILED" : analysisResult.message ? "LIMITED RESULT" : "ANALYSIS COMPLETE"}
              </span>
              <span className="header-timestamp">
                {new Date().toLocaleTimeString()}
              </span>
            </div>

            <div className="results-content">
              {analysisResult.error || analysisResult.message ? (
                <div className="results-message">
                  <div className="message-content">
                    {analysisResult.error || analysisResult.message}
                  </div>
                </div>
              ) : (
                <LatticeCanvas
                  coordinates={analysisResult.coordinates}
                  canvas={analysisResult.canvas}
                  palettes={analysisResult.palettes}
                  isAnalyzing={false}
                />
              )}

              <div className="results-sidebar">
                {analysisResult.referenceImage && (
                  <div className="reference-image-display">
                    <div className="sidebar-label">REFERENCE</div>
                    <img
                      src={analysisResult.referenceImage.preview}
                      alt="Reference"
                      className="reference-thumbnail"
                    />
                    {analysisResult.referenceImage.analysis && (
                      <div className="reference-analysis-mini">
                        <div className="mini-colors">
                          {analysisResult.referenceImage.analysis.colors?.slice(0, 4).map((color, i) => (
                            <div
                              key={i}
                              className="mini-swatch"
                              style={{ backgroundColor: color.hex }}
                              title={`${color.hex} (${color.percentage}%)`}
                            />
                          ))}
                        </div>
                        <div className="mini-stats">
                          {analysisResult.referenceImage.analysis.composition?.dominantAxis}
                          {analysisResult.referenceImage.analysis.composition?.hasSymmetry ? ' • symmetric' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <AnalysisMetrics result={analysisResult} />
                <PaletteDisplay palettes={analysisResult.palettes} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Terminal Bezel */}
      <div className="terminal-bezel" aria-hidden="true">
        <div className="bezel-knob knob-left"></div>
        <div className="bezel-knob knob-right"></div>
        <div className="bezel-brand">PIXELBRAIN</div>
      </div>
    </div>
  );
}
