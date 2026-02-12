import { useState, useEffect, useRef } from 'react';
import { ResizableBox } from 'react-resizable';
import PropTypes from 'prop-types';
import { Storage } from '../../lib/storage';
import './FloatingPanel.css';

/**
 * A high-performance floating, draggable, and resizable panel.
 * Uses direct DOM manipulation and Pointer Capture for zero-latency 'sticky' dragging.
 * Persists its position and size to localStorage.
 */
export default function FloatingPanel({
  id,
  title,
  children,
  onClose,
  minWidth = 200,
  minHeight = 150,
  defaultWidth = 320,
  defaultHeight = 400,
  defaultX = 100,
  defaultY = 100,
  zIndex = 100,
  className = '',
}) {
  const [size, setSize] = useState(() => {
    const saved = Storage.getItem(`panel-size-${id}`);
    return saved ? JSON.parse(saved) : { width: defaultWidth, height: defaultHeight };
  });

  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef(null);
  const dragData = useRef({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    currentX: 0,
    currentY: 0,
  });

  const applyPosition = (x, y) => {
    if (panelRef.current) {
      panelRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  };

  // Initialize position from storage or defaults
  useEffect(() => {
    const saved = Storage.getItem(`panel-pos-${id}`);
    const pos = saved ? JSON.parse(saved) : { x: defaultX, y: defaultY };
    dragData.current.currentX = pos.x;
    dragData.current.currentY = pos.y;

    applyPosition(pos.x, pos.y);
  }, [id, defaultX, defaultY]);

  // Save size on change
  useEffect(() => {
    Storage.setItem(`panel-size-${id}`, JSON.stringify(size));
  }, [id, size]);

  const handlePointerDown = (e) => {
    // Only drag on left click or touch
    if (e.button !== 0 && e.button !== undefined) return;
    
    const header = e.currentTarget;
    header.setPointerCapture(e.pointerId);
    
    setIsDragging(true);
    document.body.classList.add('is-dragging-panel');

    dragData.current.startX = e.clientX;
    dragData.current.startY = e.clientY;
    dragData.current.initialX = dragData.current.currentX;
    dragData.current.initialY = dragData.current.currentY;

    const handlePointerMove = (moveEvent) => {
      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }
      const deltaX = moveEvent.clientX - dragData.current.startX;
      const deltaY = moveEvent.clientY - dragData.current.startY;

      const nextX = dragData.current.initialX + deltaX;
      const nextY = dragData.current.initialY + deltaY;
      dragData.current.currentX = nextX;
      dragData.current.currentY = nextY;

      // Keep the panel fully synchronized with the pointer at event frequency.
      applyPosition(nextX, nextY);
    };

    const handlePointerUp = (upEvent) => {
      if (header.hasPointerCapture?.(upEvent.pointerId)) {
        header.releasePointerCapture(upEvent.pointerId);
      }
      header.removeEventListener('pointermove', handlePointerMove);
      header.removeEventListener('pointerup', handlePointerUp);
      header.removeEventListener('pointercancel', handlePointerUp);
      
      setIsDragging(false);
      document.body.classList.remove('is-dragging-panel');

      applyPosition(dragData.current.currentX, dragData.current.currentY);

      // Final persistence
      Storage.setItem(`panel-pos-${id}`, JSON.stringify({
        x: dragData.current.currentX,
        y: dragData.current.currentY
      }));
    };

    header.addEventListener('pointermove', handlePointerMove);
    header.addEventListener('pointerup', handlePointerUp);
    header.addEventListener('pointercancel', handlePointerUp);
  };

  const onResize = (event, { size: newSize }) => {
    setSize({ width: newSize.width, height: newSize.height });
  };

  return (
    <div
      ref={panelRef}
      className={`floating-panel ${className} ${isDragging ? 'is-dragging' : ''}`}
      style={{
        position: 'fixed',
        zIndex,
        width: size.width,
        height: size.height,
        left: 0,
        top: 0,
        touchAction: 'none', // Critical for pointer events on mobile
      }}
    >
      <ResizableBox
        width={size.width}
        height={size.height}
        minConstraints={[minWidth, minHeight]}
        onResize={onResize}
        resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 'n', 's']}
      >
        <div className="panel-container" style={{ width: '100%', height: '100%' }}>
          <div 
            className="panel-header"
            onPointerDown={handlePointerDown}
          >
            <div className="panel-drag-handle">
              <span className="drag-dots">:::</span>
              <h3 className="panel-title">{title}</h3>
            </div>
            {onClose && (
              <button
                type="button"
                className="panel-close-btn"
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()} // Don't drag when closing
                aria-label="Close panel"
              >
                &#x2715;
              </button>
            )}
          </div>
          <div className={`panel-content ${isDragging ? 'pointer-events-none' : ''}`}>
            {children}
          </div>
        </div>
      </ResizableBox>
    </div>
  );
}

FloatingPanel.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  onClose: PropTypes.func,
  minWidth: PropTypes.number,
  minHeight: PropTypes.number,
  defaultWidth: PropTypes.number,
  defaultHeight: PropTypes.number,
  defaultX: PropTypes.number,
  defaultY: PropTypes.number,
  zIndex: PropTypes.number,
  className: PropTypes.string,
};
