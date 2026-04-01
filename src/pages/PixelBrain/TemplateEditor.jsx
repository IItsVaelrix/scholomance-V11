/**
 * TEMPLATE EDITOR — Lattice-based Pixel Editor for PixelBrain
 *
 * Mathematical bytecode-driven lattice grid.
 * Clickable, paintable, exportable to Aseprite.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  analyzeImageToFormula,
  formulaToBytecode,
} from '../../lib/pixelbrain.adapter.js';

import {
  generateLatticeGrid,
  renderLattice,
  paintCell,
  clearCell as clearLatticeCell,
  exportLatticeToAseprite,
  resolveLatticeClick,
} from '../../lib/pixelbrain.adapter.js';

import './TemplateEditor.css';

export function TemplateEditor({
  initialImage,
  initialFormula,
  onFormulaChange,
  onExport,
}) {
  // Lattice state
  const [lattice, setLattice] = useState(null);
  const [selectedTool, setSelectedTool] = useState('pencil');
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [zoom, setZoom] = useState(4);

  // Formula state
  const [formula, setFormula] = useState(initialFormula || null);
  const [formulaParams, setFormulaParams] = useState({});

  // Debug state
  const [debugClick, setDebugClick] = useState(null);

  // Canvas ref
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Initialize lattice from image AND formula
  useEffect(() => {
    if (lattice || !initialImage || !initialFormula) return;

    // Generate lattice from pixel data
    const newLattice = generateLatticeGrid(initialImage);
    
    // ALSO populate from formula coordinates (the canonical bytecode source)
    if (initialFormula.coordinates && initialFormula.coordinates.length > 0) {
      initialFormula.coordinates.forEach(coord => {
        // Formula coordinates are in pixel space - convert to cell space
        const cellCol = Math.floor((coord.snappedX || coord.x) / newLattice.cellSize);
        const cellRow = Math.floor((coord.snappedY || coord.y) / newLattice.cellSize);
        
        // Paint cell with formula color
        paintCell(newLattice, cellCol, cellRow, coord.color || '#ffffff');
      });
    }
    
    setLattice(newLattice);

    const analyzedFormula = analyzeImageToFormula(initialImage);
    setFormula(analyzedFormula);
    setFormulaParams(analyzedFormula.coordinateFormula?.parameters || analyzedFormula.parameters || {});
  }, [initialImage, initialFormula, lattice]);

  // Render lattice
  const drawLattice = useCallback(() => {
    if (!canvasRef.current || !lattice) return;
    renderLattice(canvasRef.current, lattice, zoom);
  }, [lattice, zoom]);

  useEffect(() => {
    drawLattice();
  }, [drawLattice, lattice, zoom]);

  // Handle canvas click - proper coordinate normalization
  const handleCanvasClick = useCallback((e) => {
    if (!lattice || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const { col, row, hit, innerX, innerY } = resolveLatticeClick(
      e.clientX,
      e.clientY,
      rect,
      lattice,
      zoom,
      0, // offsetX - sprite is not centered in larger canvas
      0  // offsetY
    );

    // Debug logging
    setDebugClick({ clientX: e.clientX, clientY: e.clientY, col, row, hit, innerX, innerY });
    console.log('[Lattice Click]', { col, row, hit, innerX, innerY });

    if (!hit) return;

    if (selectedTool === 'pencil') {
      paintCell(lattice, col, row, selectedColor);
    } else if (selectedTool === 'eraser') {
      clearLatticeCell(lattice, col, row);
    }
    setLattice({ ...lattice });
  }, [lattice, zoom, selectedTool, selectedColor]);

  // Handle parameter change
  const handleParamChange = useCallback((param, value) => {
    setFormulaParams(prev => ({ ...prev, [param]: value }));

    if (formula) {
      const updatedFormula = {
        ...formula,
        coordinateFormula: {
          ...formula.coordinateFormula,
          parameters: { ...formula.coordinateFormula.parameters, [param]: value },
        },
      };
      setFormula(updatedFormula);
      onFormulaChange?.(updatedFormula);
    }
  }, [formula, onFormulaChange]);

  // Export lattice
  const handleExport = useCallback(() => {
    if (!lattice) return;

    const bytecode = formulaToBytecode(formula);
    const asepriteData = exportLatticeToAseprite(lattice);

    onExport?.({ formula, bytecode, asepriteData, lattice });
  }, [formula, lattice, onExport]);

  // Render formula parameters
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
            <span className="param-value">{Math.round(value * 100) / 100}</span>
          </div>
        ))}
      </div>
    );
  };

  // Render tools
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
    </div>
  );

  if (!lattice) {
    return (
      <div className="template-editor">
        <div className="editor-empty">
          <p>Upload an image to generate lattice grid</p>
        </div>
      </div>
    );
  }

  return (
    <div className="template-editor">
      {/* Canvas Panel */}
      <div className="editor-canvas-panel">
        <div
          ref={containerRef}
          onPointerDown={handleCanvasClick}
          style={{
            position: 'relative',
            cursor: 'pointer',
            width: 'fit-content',
            height: 'fit-content',
          }}
        >
          <canvas
            ref={canvasRef}
            className="editor-canvas"
          />
          
          {/* Debug overlay - shows clicked cell */}
          {debugClick && debugClick.hit && lattice && (
            <div
              style={{
                position: 'absolute',
                left: debugClick.col * lattice.cellSize * zoom,
                top: debugClick.row * lattice.cellSize * zoom,
                width: lattice.cellSize * zoom,
                height: lattice.cellSize * zoom,
                outline: '2px solid lime',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        {/* Zoom controls */}
        <div className="zoom-controls">
          <button onClick={() => setZoom(Math.max(1, zoom - 1))}>-</button>
          <span>{zoom * 100}%</span>
          <button onClick={() => setZoom(Math.min(16, zoom + 1))}>+</button>
        </div>
      </div>

      {/* Controls Panel */}
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
