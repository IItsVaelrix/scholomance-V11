/**
 * PIXELBRAIN RENDERING ENGINE
 * 
 * Provides robust canvas rendering with integrated Bytecode Error System.
 * Ensures deterministic drawing operations and context safety.
 */

import { 
  BytecodeError, 
  ERROR_CATEGORIES, 
  ERROR_SEVERITY, 
  MODULE_IDS, 
  ERROR_CODES 
} from '../../codex/core/pixelbrain/bytecode-error.js';

/**
 * Validate canvas and get context
 * @param {HTMLCanvasElement} canvas 
 * @returns {CanvasRenderingContext2D}
 */
export function getSafeContext(canvas) {
  if (!canvas) {
    throw new BytecodeError(
      ERROR_CATEGORIES.CANVAS,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.IMG_PIXEL,
      ERROR_CODES.CANVAS_NOT_FOUND,
      { reason: 'Canvas reference is null' }
    );
  }

  if (canvas.width === 0 || canvas.height === 0) {
    throw new BytecodeError(
      ERROR_CATEGORIES.CANVAS,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.IMG_PIXEL,
      ERROR_CODES.CANVAS_SIZE_ZERO,
      { width: canvas.width, height: canvas.height }
    );
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new BytecodeError(
      ERROR_CATEGORIES.RENDER,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.IMG_PIXEL,
      ERROR_CODES.RENDER_CONTEXT_LOST,
      { reason: 'Failed to acquire 2D context' }
    );
  }

  return ctx;
}

/**
 * Render lattice coordinates to canvas
 * @param {HTMLCanvasElement} canvas 
 * @param {Object} options 
 */
export function renderLattice(canvas, { coordinates, theme = 'dark', scale = 1 }) {
  try {
    const ctx = getSafeContext(canvas);
    const { width, height } = canvas;

    // Clear background
    ctx.fillStyle = theme === 'dark' ? '#0a0a12' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (!coordinates || coordinates.length === 0) return;

    // Calculate scaling and centering
    const sourceW = 160;
    const sourceH = 144;
    const previewScale = Math.min(width / sourceW, height / sourceH) * 0.8 * scale;
    const offsetX = (width - sourceW * previewScale) / 2;
    const offsetY = (height - sourceH * previewScale) / 2;

    // Draw grid
    ctx.strokeStyle = theme === 'dark' ? '#1a1a2e' : '#e0e0e0';
    ctx.lineWidth = 1;
    const gridStep = 10 * previewScale;
    
    for (let x = offsetX; x <= offsetX + sourceW * previewScale; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + sourceH * previewScale);
      ctx.stroke();
    }
    
    for (let y = offsetY; y <= offsetY + sourceH * previewScale; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + sourceW * previewScale, y);
      ctx.stroke();
    }

    // Draw coordinates
    coordinates.forEach(coord => {
      ctx.fillStyle = coord.color || (theme === 'dark' ? '#ffffff' : '#000000');
      const px = offsetX + coord.x * previewScale;
      const py = offsetY + coord.y * previewScale;
      
      const size = (coord.emphasis || 0.5) * 4 * previewScale;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    });

  } catch (error) {
    if (error instanceof BytecodeError) throw error;
    
    throw new BytecodeError(
      ERROR_CATEGORIES.RENDER,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.IMG_PIXEL,
      ERROR_CODES.RENDER_FAILED,
      { originalError: error.message }
    );
  }
}
