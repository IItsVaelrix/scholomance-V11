/**
 * PixelBrainPage — Game Asset Generation with Bytecode
 * 
 * Main page component integrating the new UI overhaul
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../hooks/useTheme.jsx";
import { useCurrentSong } from "../../hooks/useCurrentSong.jsx";

// New components
import { UploadSection } from "./components/UploadSection.jsx";
import { AnalysisResults } from "./components/AnalysisResults.jsx";
import { FormulaEditor } from "./components/FormulaEditor.jsx";
import { ParameterSliders } from "./components/ParameterSliders.jsx";
import { ExtensionSelector } from "./components/ExtensionSelector.jsx";
import { ExportOptions } from "./components/ExportOptions.jsx";
import { StatusDisplay } from "./components/StatusDisplay.jsx";

// Legacy components (keep for backward compatibility)
import PixelBrainTerminal from "./PixelBrainTerminal.jsx";
import TemplateEditor from "./TemplateEditor.jsx";
import FormulaLibrary from "./FormulaLibrary.jsx";

// Core logic
import { 
  generatePixelArtFromImage, 
  evaluateFormulaWithColor, 
  parseErrorForAI 
} from "../../lib/pixelbrain.adapter.js";
import { workerClient } from "../../lib/microprocessor.worker-client.js";

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
  const { currentSong } = useCurrentSong();
  
  // State
  const [activeSchool, setActiveSchool] = useState('VOID');
  const [inputMode, setInputMode] = useState('reference-image');
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
  const handleImageUpload = useCallback(async (file) => {
    setStatus('analyzing');
    setError(null);
    
    try {
      // Create preview
      const preview = URL.createObjectURL(file);
      setReferenceImage({ file, preview });
      
      // Call backend analysis API
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/image/analyze', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        let errorMessage = 'Analysis failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Fallback if response is not JSON
          errorMessage = `Server Error (${response.status})`;
        }
        throw new Error(errorMessage);
      }
      
      const { analysis } = await response.json();
      
      // Add client-side preview to analysis
      const fullAnalysis = {
        ...analysis,
        preview
      };
      
      setImageAnalysis(fullAnalysis);
      setStatus('generating');
      
      // BACKGROUND PIPELINE: Use WebWorker for tracing lattice
      // This ensures 5MB+ images don't freeze the UI during edge detection
      const workerResult = await workerClient.execute('pixel.trace', {
        pixelData: fullAnalysis.pixelData,
        dimensions: fullAnalysis.dimensions,
        threshold: 30
      });

      // Generate result from image analysis (merging worker coordinates)
      const result = generatePixelArtFromImage(
        { ...fullAnalysis, coordinates: workerResult.coordinates }, 
        { width: 160, height: 144, gridSize: 1 },
        extensions.length > 0 ? extensions[0] : null
      );
      
      setFormula(result.formula);
      setCoordinates(result.coordinates);
      setPalettes(result.palettes);
      
      setStatus('ready');
      
    } catch (err) {
      console.error('Image upload failed:', err);
      setError(err.message || 'Image analysis failed');
      setStatus('error');
    }
  }, [extensions]);

  // Generate result from image
  const regenerateFromImage = useCallback(async () => {
    if (!imageAnalysis) return;
    
    try {
      setStatus('generating');
      
      const result = generatePixelArtFromImage(
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

  // Render canvas preview
  useEffect(() => {
    if (!canvasRef.current || !coordinates.length) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = theme === 'dark' ? '#0a0a12' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate preview scale (canvas is 800x600, source is 160x144)
    const previewScale = Math.min(canvas.width / 160, canvas.height / 144) * 0.8;
    const offsetX = (canvas.width - 160 * previewScale) / 2;
    const offsetY = (canvas.height - 144 * previewScale) / 2;
    
    // Draw grid
    ctx.strokeStyle = theme === 'dark' ? '#1a1a2e' : '#e0e0e0';
    ctx.lineWidth = 1;
    const gridStep = 10 * previewScale;
    for (let x = offsetX; x <= offsetX + 160 * previewScale; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + 144 * previewScale);
      ctx.stroke();
    }
    for (let y = offsetY; y <= offsetY + 144 * previewScale; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + 160 * previewScale, y);
      ctx.stroke();
    }
    
    // Draw coordinates
    coordinates.forEach(coord => {
      ctx.fillStyle = coord.color || (theme === 'dark' ? '#ffffff' : '#000000');
      const px = offsetX + coord.x * previewScale;
      const py = offsetY + coord.y * previewScale;
      
      // Draw as small squares for pixel art feel
      const size = Math.max(2, previewScale * 0.8);
      ctx.fillRect(px - size/2, py - size/2, size, size);
      
      // Add glow for emphasis
      if (coord.emphasis > 0.6) {
        ctx.shadowBlur = 10 * coord.emphasis;
        ctx.shadowColor = coord.color;
        ctx.fillRect(px - size/2, py - size/2, size, size);
        ctx.shadowBlur = 0;
      }
    });
    
  }, [coordinates, theme]);

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
          <UploadSection
            onImageUpload={handleImageUpload}
            analysis={imageAnalysis}
            onClear={handleClear}
          />
          
          {imageAnalysis && (
            <AnalysisResults analysis={imageAnalysis} />
          )}
          
          <FormulaEditor
            formula={formula}
            onUpdate={setFormula}
            onRegenerate={regenerateFromImage}
          />
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
            
            <StatusDisplay
              status={status}
              error={error}
              bytecode={error ? parseErrorForAI(error)?.bytecode : null}
            />
          </div>
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
