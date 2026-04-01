/**
 * PixelBrainPage — Game Asset Generation with Bytecode
 * 
 * Main page component integrating the new UI overhaul
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../hooks/useTheme.jsx";

// New components
import { UploadSection } from "./components/UploadSection.jsx";
import { AnalysisResults } from "./components/AnalysisResults.jsx";
import { FormulaEditor } from "./components/FormulaEditor.jsx";
import { StyleTransmuter } from "./components/StyleTransmuter.jsx";
import { ParameterSliders } from "./components/ParameterSliders.jsx";
import { ExtensionSelector } from "./components/ExtensionSelector.jsx";
import { ExportOptions } from "./components/ExportOptions.jsx";
import { StatusDisplay } from "./components/StatusDisplay.jsx";

// Legacy components (keep for backward compatibility)
import PixelBrainTerminal from "./PixelBrainTerminal.jsx";
import TemplateEditor from "./TemplateEditor.jsx";

// Core logic
import { 
  generatePixelArtFromImage, 
  evaluateFormulaWithColor, 
  parseErrorForAI 
} from "../../lib/pixelbrain.adapter.js";
import { processorBridge } from "../../lib/processor-bridge.js";
import { analyzeImageClientSide } from "./utils/imageAnalysis.client.js";

import "./PixelBrainPage.css";

const SCHOOLS = ['SONIC', 'PSYCHIC', 'ALCHEMY', 'WILL', 'VOID'];

// Map slider keys to formula keys
const PARAM_MAP = {
  amplitude: 'a',
  frequency: 'b',
  phase: 'c',
  points: 'n',
  scale: 'scale',
  complexity: 'complexity',
  cx: 'cx',
  cy: 'cy'
};

const REVERSE_PARAM_MAP = Object.entries(PARAM_MAP).reduce((acc, [k, v]) => {
  acc[v] = k;
  return acc;
}, {});

export default function PixelBrainPage() {
  const { theme } = useTheme();
  
  // State
  const [activeSchool, setActiveSchool] = useState('VOID');
  const [referenceImage, setReferenceImage] = useState(null);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [formula, setFormula] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [palettes, setPalettes] = useState([]);
  const [parameters, setParameters] = useState({});
  const [extensions, setExtensions] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [leftTab, setLeftTab] = useState('upload'); // 'upload' or 'transmute'
  
  const canvasRef = useRef(null);

  // Sync parameters state from formula
  useEffect(() => {
    if (formula?.coordinateFormula?.parameters) {
      const newParams = {};
      Object.entries(formula.coordinateFormula.parameters).forEach(([k, v]) => {
        const sliderKey = REVERSE_PARAM_MAP[k] || k;
        newParams[sliderKey] = v;
      });
      setParameters(newParams);
    }
  }, [formula]);

  // Handle parameter change
  const handleParameterChange = useCallback((key, value) => {
    setParameters(prev => {
      const updated = { ...prev, [key]: value };
      
      // If we have a formula, update it and regenerate coordinates
      if (formula) {
        const formulaKey = PARAM_MAP[key] || key;
        const updatedFormula = {
          ...formula,
          coordinateFormula: {
            ...formula.coordinateFormula,
            parameters: {
              ...formula.coordinateFormula.parameters,
              [formulaKey]: value
            }
          }
        };
        
        // Evaluate formula to get new coordinates
        const newCoords = evaluateFormulaWithColor(updatedFormula, { width: 160, height: 144 });
        setCoordinates(newCoords);
        setFormula(updatedFormula);
      }
      
      return updated;
    });
  }, [formula]);

  // Handle image upload
  // PRIMARY path: client-side Canvas API analysis (no backend needed).
  // SECONDARY path: server enhancement attempted silently — never blocks.
  const handleImageUpload = useCallback(async (file) => {
    setStatus('analyzing');
    setError(null);

    try {
      // Step 1: Client-side decode — PNG/JPEG/BMP via Canvas API, always works
      const preview = URL.createObjectURL(file);
      setReferenceImage({ file, preview });

      let analysis = await analyzeImageClientSide(file);
      analysis = { ...analysis, preview };

      // Step 2: Server enhancement — optional, non-fatal
      try {
        const formData = new FormData();
        formData.append('image', file);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch('/api/image/analyze', {
          method: 'POST', body: formData, signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const responseData = await response.json();
          // Guard both correct and double-wrapped server response shapes
          const serverAnalysis = responseData.analysis?.colors
            ? responseData.analysis
            : responseData.analysis?.analysis;
          if (serverAnalysis?.colors) {
            analysis = { ...serverAnalysis, preview };
          }
        }
      } catch { /* server unavailable — client analysis is sufficient */ }

      setImageAnalysis(analysis);
      setStatus('generating');

      // Step 3: Background edge trace (non-fatal — generatePixelArtFromImage
      // runs its own internal trace if workerResult.coordinates is empty)
      const workerResult = await processorBridge.execute('pixel.trace', {
        pixelData: analysis.pixelData,
        dimensions: analysis.dimensions,
        threshold: 30,
      });

      // Step 4: Generate pixel art coords + formula
      const result = await generatePixelArtFromImage(
        { ...analysis, coordinates: workerResult.coordinates },
        { width: 160, height: 144, gridSize: 1 },
        extensions.length > 0 ? extensions[0] : null
      );

      setFormula(result.formula);
      setCoordinates(result.coordinates ?? []);
      setPalettes(result.palettes ?? []);
      setStatus('ready');

    } catch (err) {
      console.error('Image upload failed:', err);
      setError(err.message || 'Image analysis failed. Please try again.');
      setStatus('error');
      setReferenceImage(null);
      setImageAnalysis(null);
    }
  }, [extensions]);

  const handleTransmuteResult = useCallback((result) => {
    setCoordinates(result.coordinates);
    setPalettes(result.palettes);
    // Note: Transmuter returns canvas info, we could update page canvas state here
    setStatus('ready');
  }, []);

  // Generate result from image
  const regenerateFromImage = useCallback(async () => {
    if (!imageAnalysis) return;
    
    try {
      setStatus('generating');
      
      const result = await generatePixelArtFromImage(
        imageAnalysis, 
        { width: 160, height: 144, gridSize: 1 },
        extensions.length > 0 ? extensions[0] : null
      );
      
      setFormula(result.formula);
      setCoordinates(result.coordinates);
      setPalettes(result.palettes);
      
      setStatus('ready');
    } catch (err) {
      setError(err.message || 'Generation failed');
      setStatus('error');
    }
  }, [imageAnalysis, extensions]);

  // Handle export
  const handleExport = useCallback(async (presetKey) => {
    try {
      setStatus('generating');
      
      const preset = {
        GODOT: { scale: 1, name: 'godot' },
        UNITY: { scale: 2, name: 'unity' },
        WEB: { scale: 1, name: 'web' },
        FORMULA: { format: 'json', name: 'formula' }
      }[presetKey];

      if (preset.format === 'json') {
        const data = JSON.stringify({ formula, coordinates, palettes }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pixelbrain_${activeSchool.toLowerCase()}_${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // Render to temporary canvas at requested scale
        const exportCanvas = document.createElement('canvas');
        const scale = preset.scale || 1;
        exportCanvas.width = 160 * scale;
        exportCanvas.height = 144 * scale;
        const ectx = exportCanvas.getContext('2d');
        
        // Background (transparent for assets)
        ectx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
        
        // Draw coordinates
        coordinates.forEach(coord => {
          ectx.fillStyle = coord.color;
          const px = Math.round(coord.x * scale);
          const py = Math.round(coord.y * scale);
          ectx.fillRect(px, py, scale, scale);
        });
        
        // Download PNG
        const url = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = `pixelbrain_${activeSchool.toLowerCase()}_${preset.name}_${Date.now()}.png`;
        link.click();
      }
      
      setStatus('ready');
      
    } catch (err) {
      setError(err.message || 'Export failed');
      setStatus('error');
    }
  }, [coordinates, palettes, formula, activeSchool]);

  // Handle clear
  const handleClear = useCallback(() => {
    setReferenceImage(null);
    setImageAnalysis(null);
    setFormula(null);
    setCoordinates([]);
    setPalettes([]);
    setParameters({});
    setStatus('idle');
    setError(null);
  }, []);

  // Render canvas preview — flat 2D only, no Z transforms
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Use detected source dimensions (no arbitrary standard)
    const srcW = imageAnalysis?.dimensions?.width || 32;
    const srcH = imageAnalysis?.dimensions?.height || 32;

    // Calculate scale to fit canvas while preserving aspect ratio
    const scale = Math.min(canvas.width / srcW, canvas.height / srcH) * 0.85;
    const offsetX = Math.floor((canvas.width - srcW * scale) / 2);
    const offsetY = Math.floor((canvas.height - srcH * scale) / 2);

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (imageAnalysis?.preview) {
      const img = new Image();
      img.onload = () => {
        // Draw full sprite at native dimensions (nearest-neighbor, fully colored)
        ctx.drawImage(img, offsetX, offsetY, srcW * scale, srcH * scale);

        // Draw pixel grid overlay
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = Math.max(0.5, scale * 0.1);
        
        // Vertical lines
        for (let x = 0; x <= srcW; x++) {
          const px = offsetX + x * scale;
          ctx.beginPath();
          ctx.moveTo(px, offsetY);
          ctx.lineTo(px, offsetY + srcH * scale);
          ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= srcH; y++) {
          const py = offsetY + y * scale;
          ctx.beginPath();
          ctx.moveTo(offsetX, py);
          ctx.lineTo(offsetX + srcW * scale, py);
          ctx.stroke();
        }

        // Draw coordinate dots for edge visualization
        if (coordinates.length > 0) {
          coordinates.forEach(coord => {
            const px = offsetX + Math.floor((coord.snappedX ?? coord.x) * scale);
            const py = offsetY + Math.floor((coord.snappedY ?? coord.y) * scale);
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.8;
            ctx.fillRect(px, py, Math.max(1, scale * 0.3), Math.max(1, scale * 0.3));
            ctx.globalAlpha = 1;
          });
        }
      };
      img.src = imageAnalysis.preview;
    } else if (coordinates.length > 0) {
      // No image, just coordinates (formula-only mode)
      coordinates.forEach(coord => {
        const px = offsetX + Math.floor((coord.snappedX ?? coord.x) * scale);
        const py = offsetY + Math.floor((coord.snappedY ?? coord.y) * scale);
        ctx.fillStyle = coord.color || '#a0a0c0';
        ctx.fillRect(px, py, Math.max(1, scale), Math.max(1, scale));
      });
    }
  }, [coordinates, imageAnalysis]);

  return (
    <div className="pixelbrain-page">
      {/* Top Bar */}
      <header className="pixelbrain-topbar">
        <div className="topbar-left">
          <h1 className="topbar-title">PixelBrain</h1>
          <span className="topbar-subtitle">Arcane Asset Generation</span>
        </div>
        
        <div className="topbar-center">
          <div className="school-selector">
            {SCHOOLS.map(school => (
              <button
                key={school}
                className={`school-btn ${activeSchool === school ? 'is-active' : ''}`}
                onClick={() => setActiveSchool(school)}
                data-school={school.toLowerCase()}
              >
                {school}
              </button>
            ))}
          </div>
        </div>
        
        <div className="topbar-right">
          <button
            className="btn btn-ghost"
            onClick={() => setShowTerminal(!showTerminal)}
          >
            {showTerminal ? 'Hide Terminal' : 'Show Terminal'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pixelbrain-main">
        {/* Left Panel */}
        <aside className="pixelbrain-panel pixelbrain-panel--left">
          <div className="panel-tabs">
            <button 
              className={`tab-btn ${leftTab === 'upload' ? 'active' : ''}`}
              onClick={() => setLeftTab('upload')}
            >
              Analysis
            </button>
            <button 
              className={`tab-btn ${leftTab === 'transmute' ? 'active' : ''}`}
              onClick={() => setLeftTab('transmute')}
            >
              Void Echo
            </button>
          </div>

          {leftTab === 'upload' ? (
            <>
              <UploadSection
                onImageUpload={handleImageUpload}
                analysis={imageAnalysis}
                onClear={handleClear}
                uploadError={error}
              />

              {imageAnalysis && (
                <AnalysisResults analysis={imageAnalysis} />
              )}
            </>
          ) : (
            <StyleTransmuter
              referenceFile={referenceImage?.file}
              onTransmute={handleTransmuteResult}
              isProcessing={status === 'analyzing'}
            />
          )}

          {/* Lattice Grid Editor — for Aseprite export */}
          {formula && imageAnalysis && (
            <TemplateEditor
              initialFormula={formula}
              initialImage={imageAnalysis}
              onExport={handleExport}
              onFormulaChange={setFormula}
            />
          )}
        </aside>

        {/* Center Panel */}
        <section className="pixelbrain-panel pixelbrain-panel--center">
          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              className="preview-canvas"
              width={800}
              height={600}
              aria-label="Asset preview"
            />
          </div>

          <StatusDisplay
            status={status}
            error={error}
            bytecode={error ? parseErrorForAI(error)?.bytecode : null}
          />
        </section>

        {/* Right Panel */}
        <aside className="pixelbrain-panel pixelbrain-panel--right">
          <ParameterSliders
            parameters={parameters}
            onChange={handleParameterChange}
            school={activeSchool}
          />
          
          <ExtensionSelector
            selectedExtensions={extensions}
            onChange={setExtensions}
          />
          
          {coordinates.length > 0 && (
            <ExportOptions
              onExport={handleExport}
              formula={formula}
              coordinates={coordinates}
              palettes={palettes}
            />
          )}
        </aside>
      </main>

      {/* Terminal Overlay */}
      <AnimatePresence>
        {showTerminal && (
          <motion.div
            className="terminal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PixelBrainTerminal
              mode={imageAnalysis ? "result" : "input"}
              analysisResult={imageAnalysis ? {
                ...imageAnalysis,
                coordinates,
                palettes,
                formula,
                canvas: { width: 160, height: 144, gridSize: 1 },
                tokenCount: coordinates.length,
                activeTokenCount: coordinates.length,
                paletteCount: palettes.length,
                dominantAxis: imageAnalysis.composition?.dominantAxis,
                dominantSymmetry: imageAnalysis.composition?.hasSymmetry ? imageAnalysis.composition.symmetryType : 'none',
                referenceImage: { preview: imageAnalysis.preview, analysis: imageAnalysis }
              } : null}
              onClose={() => setShowTerminal(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
