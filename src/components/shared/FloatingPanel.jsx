import { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import PropTypes from 'prop-types';
import { Storage } from '../../lib/storage';
import './FloatingPanel.css';

/**
 * A generic floating, draggable, and resizable panel for the IDE.
 * Persists its position and size to localStorage based on the provided id.
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
  const [position, setPosition] = useState(() => {
    const saved = Storage.getItem(`panel-pos-${id}`);
    return saved ? JSON.parse(saved) : { x: defaultX, y: defaultY };
  });

  const [size, setSize] = useState(() => {
    const saved = Storage.getItem(`panel-size-${id}`);
    return saved ? JSON.parse(saved) : { width: defaultWidth, height: defaultHeight };
  });

  const [isDragging, setIsDragging] = useState(false);
  const nodeRef = useRef(null);

  // Save position and size on change
  useEffect(() => {
    Storage.setItem(`panel-pos-${id}`, JSON.stringify(position));
  }, [id, position]);

  useEffect(() => {
    Storage.setItem(`panel-size-${id}`, JSON.stringify(size));
  }, [id, size]);

  const handleDragStart = (e) => {
    setIsDragging(true);
    document.body.classList.add('is-dragging-panel');
    
    // Lock the pointer to the handle so fast movement doesn't escape
    if (e.target.setPointerCapture) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (err) {
        // Fallback for non-pointer events if any
      }
    }
  };

  const handleDragStop = (e, data) => {
    setIsDragging(false);
    document.body.classList.remove('is-dragging-panel');
    setPosition({ x: data.x, y: data.y });
    
    if (e.target.releasePointerCapture) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Fallback
      }
    }
  };

  const onResize = (event, { size: newSize }) => {
    setSize({ width: newSize.width, height: newSize.height });
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".panel-header"
      defaultPosition={position}
      onStart={handleDragStart}
      onStop={handleDragStop}
      enableUserSelectHack={true}
    >
      <div
        ref={nodeRef}
        className={`floating-panel ${className} ${isDragging ? 'is-dragging' : ''}`}
        style={{
          position: 'fixed',
          zIndex,
          width: size.width,
          height: size.height,
          left: 0,
          top: 0,
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
            <div className="panel-header">
              <div className="panel-drag-handle">
                <span className="drag-dots">:::</span>
                <h3 className="panel-title">{title}</h3>
              </div>
              {onClose && (
                <button
                  type="button"
                  className="panel-close-btn"
                  onClick={onClose}
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
    </Draggable>
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
