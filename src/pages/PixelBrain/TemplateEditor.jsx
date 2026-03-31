/**
 * TEMPLATE EDITOR — Aseprite-style Grid Editor for PixelBrain
 *
 * Allows manual editing of formula-derived templates.
 * Features:
 * - Grid overlay with adjustable cell size
 * - Anchor point editing
 * - Symmetry visualization
 * - Formula parameter sliders
 * - Onion skinning for animation
 * - Color palette management
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createTemplateGrid,
  clearCell,
  exportToAseprite,
  generateGridPreview,
  getCellAtPosition,
  floodFill,
  GRID_TYPES,
  setCell,
  roundTo,
  analyzeImageToFormula,
  formulaToBytecode,
  parseBytecodeToFormula,
  transcribeFullPixelData,
  evaluateFormulaWithColor,
  getRotationAtTime,
  FORMULA_TYPES,
  BytecodeError,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  MODULE_IDS,
  ERROR_CODES,
} from '../../lib/pixelbrain.adapter.js';

import './TemplateEditor.css';

export function TemplateEditor({
  initialImage,
  initialFormula,
  onFormulaChange,
  onExport,
}) {
  // Asset state
  const [hasAsset, setHasAsset] = useState(!!(initialImage || initialFormula));
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [terminalText, setTerminalText] = useState("CLICK_HERE_TO_UPLOAD_OPEN_SOURCE_ASSET");
  const [bytecodeInput, setBytecodeInput] = useState("");

  // Grid/Template state
  const [grid, setGrid] = useState(() => createTemplateGrid());
  const [selectedTool, setSelectedTool] = useState('pencil'); // pencil, eraser, bucket, move
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [zoom, setZoom] = useState(4);

  // Formula state
  const [formula, setFormula] = useState(initialFormula || null);
  const [formulaParams, setFormulaParams] = useState({});

  // Animation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame] = useState(0);
  const [onionSkinCount, setOnionSkinCount] = useState(1);

  // Canvas refs
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const fileInputRef = useRef(null);

  // -- Asset Ignition ----------------------------------------------
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setLoadProgress(0);
    setTerminalText(`INGESTING_${file.name.toUpperCase()}...`);
    
    // 1. Create Image and Canvas for analysis
    const img = new Image();
    const reader = new FileReader();
    
    const analysisPromise = new Promise((resolve, reject) => {
      reader.onload = (event) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const width = 160;
          const height = 144;
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          const pixelData = ctx.getImageData(0, 0, width, height).data;
          
          const colors = [];
          for (let i = 0; i < pixelData.length; i += 1024) { 
            const hex = `#${pixelData[i].toString(16).padStart(2, '0')}${pixelData[i+1].toString(16).padStart(2, '0')}${pixelData[i+2].toString(16).padStart(2, '0')}`;
            if (!colors.includes(hex)) colors.push(hex);
          }

          resolve({
            pixelData,
            dimensions: { width, height },
            colors: colors.slice(0, 8).map(c => ({ hex: c, percentage: 12.5 })),
            composition: { 
              complexity: 0.5, 
              edgeDensity: 0.2, 
              dominantAxis: 'horizontal',
              hasSymmetry: false,
              symmetryType: 'none',
              brightnessNormalized: 0.5,
              contrastNormalized: 0.5
            },
            semanticParams: {
              surface: { material: 'stone', reflectivity: 0.3, roughness: 0.5, texture: 'grained' },
              form: { scale: 1.0, symmetry: 'none', complexity: 0.5, dominantAxis: 'horizontal' },
              light: { angle: 45, hardness: 0.5, color: '#888888', intensity: 0.5 },
              color: { primaryHue: 0, saturation: 0.5, brightness: 0.5, paletteSize: 3 }
            }
          });
        };
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new BytecodeError(ERROR_CATEGORIES.VALUE, ERROR_SEVERITY.CRIT, MODULE_IDS.IMG_PIXEL, ERROR_CODES.INVALID_FORMAT, { file: file.name }));
      reader.readAsDataURL(file);
    });

    try {
      const analysis = await analysisPromise;
      
      const steps = ["SCANNING_MATRIX", "EXTRACTING_PHONEMES", "MAPPING_LATTICE", "STABILIZING_DNA"];
      for (let i = 0; i < steps.length; i++) {
        setTerminalText(steps[i]);
        setLoadProgress(((i + 1) / steps.length) * 100);
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
      }

      // ── Full-Fidelity Reconstruction Ignition ──
      const canvasSize = { width: 160, height: 144, gridSize: 1 };
      const fullLattice = transcribeFullPixelData(analysis.pixelData, analysis.dimensions, canvasSize);
      
      const newGrid = createTemplateGrid({
        ...canvasSize,
        cellSize: 8, // Grid snap for forging
      });
      
      const layer = newGrid.frames[0].layers[0];
      const cSize = newGrid.cellSize;

      // Seed the grid with every individual pixel from the lattice
      fullLattice.forEach(pt => {
        // Snap to grid for initial template seeding
        const gridX = Math.floor(pt.x / cSize) * cSize;
        const gridY = Math.floor(pt.y / cSize) * cSize;
        setCell(layer, gridX, gridY, pt.color, pt.emphasis);
      });

      // Generate the formula for the UI sliders
      const analyzedFormula = analyzeImageToFormula(analysis);
      setFormula(analyzedFormula);
      setFormulaParams(analyzedFormula.coordinateFormula?.parameters || analyzedFormula.parameters || {});

      setGrid(newGrid);
      setHasAsset(true);
      setIsProcessing(false);
    } catch (error) {
      console.error('Bytecode ingestion failed:', error);
      const err = error instanceof BytecodeError ? error : new BytecodeError(ERROR_CATEGORIES.STATE, ERROR_SEVERITY.FATAL, MODULE_IDS.TEMPLATE, ERROR_CODES.FORMULA_PARSE_FAIL, { originalError: error.message });
      setTerminalText(`ERR: ${err.moduleId}_${err.errorCodeHex}`);
      setIsProcessing(false);
    }
  }, []);

  const handleBytecodeSubmit = useCallback(async () => {
    const code = bytecodeInput.trim().toUpperCase();
    if (!code.startsWith('0xF')) return;

    setIsProcessing(true);
    setLoadProgress(0);
    setTerminalText("PARSING_BYTECODE_PROMPT...");

    try {
      const parsedFormula = parseBytecodeToFormula(code);
      
      const steps = ["DECRYPTING_SIGIL", "ALIGNING_LATTICE", "IGNITING_DNA"];
      for (let i = 0; i < steps.length; i++) {
        setTerminalText(steps[i]);
        setLoadProgress(((i + 1) / steps.length) * 100);
        await new Promise(r => setTimeout(r, 500));
      }

      setFormula(parsedFormula);
      const params = parsedFormula.coordinateFormula?.parameters || parsedFormula.parameters || {};
      setFormulaParams(params);
      
      const canvasSize = { 
        width: parsedFormula.template?.gridWidth || 160, 
        height: parsedFormula.template?.gridHeight || 144 
      };

      const newGrid = createTemplateGrid({
        ...canvasSize,
        cellSize: parsedFormula.template?.cellSize || 8,
      });

      // ── Procedural Ignition: Map Formula to Grid ──
      const generatedPoints = evaluateFormulaWithColor(parsedFormula, canvasSize, 0);
      const layer = newGrid.frames[0].layers[0];
      const cSize = newGrid.cellSize;

      generatedPoints.forEach(pt => {
        // Snap generated point to the nearest grid cell
        const gridX = Math.floor(pt.x / cSize) * cSize;
        const gridY = Math.floor(pt.y / cSize) * cSize;
        
        // Only set if within bounds
        if (gridX >= 0 && gridX < canvasSize.width && gridY >= 0 && gridY < canvasSize.height) {
          setCell(layer, gridX, gridY, pt.color, pt.emphasis || 1);
        }
      });

      setGrid(newGrid);
      setHasAsset(true);
      setIsProcessing(false);
    } catch (error) {
      console.error('Bytecode ignition failed:', error);
      const err = new BytecodeError(ERROR_CATEGORIES.FORMULA, ERROR_SEVERITY.CRIT, MODULE_IDS.IMG_FORMULA, ERROR_CODES.FORMULA_INVALID_SYNTAX, { input: code });
      setTerminalText(`ERR: ${err.moduleId}_${err.errorCodeHex}`);
      setIsProcessing(false);
    }
  }, [bytecodeInput]);

  // -- Drawing Logic -----------------------------------------------
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = grid.width * zoom;
    const height = grid.height * zoom;

    // Clear and fill background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Get current frame and layers
    const frame = grid.frames[currentFrame] || grid.frames[0];
    if (!frame) return;

    // Draw layers (back to front)
    frame.layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.globalAlpha = layer.opacity;
      
      layer.cells.forEach(cell => {
        ctx.fillStyle = cell.color;
        ctx.fillRect(cell.x * zoom, cell.y * zoom, grid.cellSize * zoom, grid.cellSize * zoom);
      });
    });
    ctx.globalAlpha = 1;
  }, [grid, currentFrame, zoom]);

  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    const lines = generateGridPreview(grid);
    
    lines.forEach(line => {
      ctx.beginPath();
      if (line.type === 'fib') {
        ctx.strokeStyle = 'rgba(201, 162, 39, 0.4)'; // Golden ratio line
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
      }
      ctx.moveTo(line.x1 * zoom, line.y1 * zoom);
      ctx.lineTo(line.x2 * zoom, line.y2 * zoom);
      ctx.stroke();
    });

    // Draw anchor points
    grid.anchorPoints.forEach(anchor => {
      if (!anchor.visible) return;
      ctx.fillStyle = anchor.locked ? '#ffaa00' : '#00ff88';
      ctx.beginPath();
      ctx.arc(anchor.x * zoom, anchor.y * zoom, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw symmetry axes
    ctx.strokeStyle = 'rgba(255, 0, 136, 0.4)';
    ctx.setLineDash([5, 5]);
    grid.symmetryAxes.forEach(axis => {
      ctx.beginPath();
      if (axis === 'vertical') {
        ctx.moveTo(grid.width * zoom / 2, 0);
        ctx.lineTo(grid.width * zoom / 2, grid.height * zoom);
      } else if (axis === 'horizontal') {
        ctx.moveTo(0, grid.height * zoom / 2);
        ctx.lineTo(grid.width * zoom, grid.height * zoom / 2);
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }, [grid, zoom]);

  // Initial and reactive render
  useEffect(() => {
    drawGrid();
    drawOverlay();
  }, [drawGrid, drawOverlay]);

  // Initialize from image or formula
  useEffect(() => {
    if (initialImage && !formula) {
      // Analyze image to generate formula
      const analyzedFormula = analyzeImageToFormula(initialImage);
      setFormula(analyzedFormula);
      setFormulaParams(analyzedFormula.coordinateFormula?.parameters || {});

      // Create grid from formula template
      const newGrid = createTemplateGrid({
        width: analyzedFormula.template?.gridWidth || 160,
        height: analyzedFormula.template?.gridHeight || 144,
        cellSize: analyzedFormula.template?.cellSize || 8,
      });
      setGrid(newGrid);
    } else if (initialFormula) {
      setFormula(initialFormula);
      const params = initialFormula.coordinateFormula?.parameters || initialFormula.parameters || {};
      setFormulaParams(params);

      if (initialFormula.template) {
        const newGrid = createTemplateGrid({
          width: initialFormula.template.gridWidth || 160,
          height: initialFormula.template.gridHeight || 144,
          cellSize: initialFormula.template.cellSize || 8,
        });
        setGrid(newGrid);
      }
    }
  }, [initialImage, initialFormula]);

  // Animation loop for gear-glide preview
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const animate = () => {
      const time = performance.now();
      const bpm = formula?.idleAnimation ? 90 : 90; // Use formula BPM or default
      const rotation = getRotationAtTime(time, bpm);

      // Update canvas rotation
      if (canvasRef.current) {
        canvasRef.current.style.transform = `rotate(${rotation}rad)`;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, formula]);

  // Handle canvas click (place/remove cells)
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX / zoom;
    const y = (e.clientY - rect.top) * scaleY / zoom;

    const cellPos = getCellAtPosition(grid, x, y);

    // Get current layer and frame
    const frame = grid.frames[currentFrame];
    if (!frame) return;
    const layer = frame.layers[0]; // For now, default to first layer
    if (!layer) return;

    if (selectedTool === 'pencil') {
      setCell(layer, cellPos.x, cellPos.y, selectedColor);
    } else if (selectedTool === 'eraser') {
      clearCell(layer, cellPos.x, cellPos.y);
    } else if (selectedTool === 'bucket') {
      floodFill(grid, layer, cellPos.x, cellPos.y, selectedColor);
    }

    // Trigger re-render
    setGrid({ ...grid });
  }, [grid, currentFrame, selectedTool, selectedColor, zoom]);

  // Handle parameter change
  const handleParamChange = useCallback((param, value) => {
    setFormulaParams(prev => ({
      ...prev,
      [param]: value,
    }));

    // Update formula
    if (formula) {
      const updatedFormula = {
        ...formula,
        coordinateFormula: {
          ...formula.coordinateFormula,
          parameters: {
            ...formula.coordinateFormula.parameters,
            [param]: value,
          },
        },
      };
      setFormula(updatedFormula);
      onFormulaChange?.(updatedFormula);
    }
  }, [formula, onFormulaChange]);

  // Toggle symmetry axis
  const handleToggleSymmetry = useCallback((axis) => {
    toggleSymmetryAxis(grid, axis);
    setGrid({ ...grid });
  }, [grid]);

  // Export formula
  const handleExport = useCallback(() => {
    const bytecode = formulaToBytecode(formula);
    const asepriteData = exportToAseprite(grid);

    onExport?.({
      formula,
      bytecode,
      asepriteData,
      grid,
    });
  }, [formula, grid, onExport]);

  // Render formula parameters UI
  const renderFormulaParams = () => {
    if (!formulaParams) return null;

    return (
      <div className="formula-params">
        <h4>Formula Parameters</h4>

        {Object.entries(formulaParams).map(([key, value]) => (
          <div key={key} className="param-slider">
            <label>{key}</label>
            <input
              type="range"
              min={0}
              max={key === 'a' || key === 'cx' || key === 'cy' ? 200 : 100}
              step={0.1}
              value={value || 0}
              onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
            />
            <span className="param-value">{roundTo(value, 2)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Render grid type selector
  const renderGridSelector = () => (
    <div className="grid-selector">
      <h4>Grid Type</h4>
      <div className="grid-type-buttons">
        {Object.values(GRID_TYPES).map(type => (
          <button
            key={type}
            className={grid.gridType === type ? 'active' : ''}
            onClick={() => setGrid({ ...grid, gridType: type })}
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );

  // Render symmetry toggles
  const renderSymmetryToggles = () => (
    <div className="symmetry-toggles">
      <h4>Symmetry</h4>
      <button
        className={grid.symmetryAxes.includes('vertical') ? 'active' : ''}
        onClick={() => handleToggleSymmetry('vertical')}
      >
        Vertical
      </button>
      <button
        className={grid.symmetryAxes.includes('horizontal') ? 'active' : ''}
        onClick={() => handleToggleSymmetry('horizontal')}
      >
        Horizontal
      </button>
      <button
        className={grid.symmetryAxes.includes('diagonal') ? 'active' : ''}
        onClick={() => handleToggleSymmetry('diagonal')}
      >
        Diagonal
      </button>
    </div>
  );

  // Render tool selector
  const renderTools = () => (
    <div className="tool-selector">
      <button
        className={selectedTool === 'pencil' ? 'active' : ''}
        onClick={() => setSelectedTool('pencil')}
      >
        ✏️ Pencil
      </button>
      <button
        className={selectedTool === 'eraser' ? 'active' : ''}
        onClick={() => setSelectedTool('eraser')}
      >
        🧹 Eraser
      </button>
      <button
        className={selectedTool === 'bucket' ? 'active' : ''}
        onClick={() => setSelectedTool('bucket')}
      >
        🪣 Fill
      </button>
      <button
        className={selectedTool === 'move' ? 'active' : ''}
        onClick={() => setSelectedTool('move')}
      >
        ✋ Move
      </button>
    </div>
  );

  const renderTerminal = () => (
    <div className="dos-terminal-container">
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileUpload}
        accept="image/*"
      />
      
      <div className="lcd-screen">
        <div className="crt-flicker"></div>
        <AnimatePresence mode="wait">
          {!isProcessing ? (
            <motion.div 
              key="prompt"
              className="dos-terminal-interface"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ x: '100%', transition: { duration: 0.5, ease: "easeInOut" } }}
            >
              <div className="dos-upload-zone" onClick={() => fileInputRef.current?.click()}>
                <span className="cursor">&gt;</span>
 {terminalText}
                <motion.span className="blinking-block" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
              </div>
              
              <div className="dos-bytecode-input">
                <span className="cursor">&gt;</span>
 OR_PASTE_BYTECODE:
                <div className="bytecode-input-group">
                  <input 
                    type="text"
                    className="bytecode-prompt-input"
                    value={bytecodeInput}
                    onChange={(e) => setBytecodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleBytecodeSubmit();
                      }
                    }}
                    placeholder="0xF..."
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button 
                    className="dos-submit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBytecodeSubmit();
                    }}
                    disabled={!bytecodeInput.trim().toUpperCase().startsWith('0xF')}
                  >
                    [IGNITE]
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="loading"
              className="dos-loading-matrix"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="status-line">{terminalText}</div>
              <div className="dos-progress-frame">
                <div className="dos-progress-fill" style={{ width: `${loadProgress}%` }}>
                  {[...Array(Math.floor(loadProgress / 5))].map((_, i) => (
                    <span key={i} className="progress-chunk">█</span>
                  ))}
                </div>
              </div>
              <div className="percentage-counter">{Math.floor(loadProgress)}% COMPLETE</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  if (!hasAsset || isProcessing) {
    return renderTerminal();
  }

  return (
    <div className="template-editor">
      {/* Left Panel: Canvas */}
      <div className="editor-canvas-panel">
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            width={grid.width * zoom}
            height={grid.height * zoom}
            onClick={handleCanvasClick}
            className="editor-canvas"
          />
          <canvas
            ref={overlayRef}
            width={grid.width * zoom}
            height={grid.height * zoom}
            className="editor-overlay"
          />
        </div>

        {/* Zoom controls */}
        <div className="zoom-controls">
          <button onClick={() => setZoom(Math.max(1, zoom - 1))}>-</button>
          <span>{zoom * 100}%</span>
          <button onClick={() => setZoom(Math.min(16, zoom + 1))}>+</button>
        </div>

        {/* Animation controls */}
        <div className="animation-controls">
          <button onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <label>
            Onion Skins:
            <input
              type="range"
              min={0}
              max={3}
              value={onionSkinCount}
              onChange={(e) => setOnionSkinCount(parseInt(e.target.value))}
            />
          </label>
        </div>
      </div>

      {/* Right Panel: Controls */}
      <div className="editor-controls-panel">
        {/* Tools */}
        {renderTools()}

        {/* Color picker */}
        <div className="color-picker">
          <h4>Color</h4>
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
          />
          <span>{selectedColor}</span>
        </div>

        {/* Grid selector */}
        {renderGridSelector()}

        {/* Symmetry toggles */}
        {renderSymmetryToggles()}

        {/* Formula parameters */}
        {renderFormulaParams()}

        {/* Export button */}
        <button className="export-btn" onClick={handleExport}>
          Export Bytecode
        </button>
      </div>
    </div>
  );
}

export default TemplateEditor;
