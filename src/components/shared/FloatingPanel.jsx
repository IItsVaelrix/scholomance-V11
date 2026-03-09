import { useState, useEffect, useRef, useId } from 'react';
import { ResizableBox } from 'react-resizable';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import { Storage } from '../../lib/platform/storage';
import './FloatingPanel.css';

const MOBILE_BREAKPOINT = 640;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

/**
 * A floating, draggable, and resizable panel on desktop.
 * On mobile (<=640px), renders as a bottom sheet instead.
 */
export default function FloatingPanel({
  id,
  title,
  children,
  onClose,
  minWidth = 200,
  minHeight = 150,
  maxWidth = Infinity,
  maxHeight = Infinity,
  defaultWidth = 320,
  defaultHeight = 400,
  defaultX = 100,
  defaultY = 100,
  zIndex = 100,
  className = '',
  role = 'dialog',
  modal = false,
  ariaLabel,
}) {
  const isMobile = useIsMobile();
  const titleId = useId();

  if (isMobile) {
    return (
      <MobileBottomSheet
        id={id}
        title={title}
        titleId={titleId}
        onClose={onClose}
        className={className}
        role={role}
        modal={modal}
        ariaLabel={ariaLabel}
      >
        {children}
      </MobileBottomSheet>
    );
  }

  return (
    <DesktopPanel
      id={id}
      title={title}
      titleId={titleId}
      onClose={onClose}
      minWidth={minWidth}
      minHeight={minHeight}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      defaultWidth={defaultWidth}
      defaultHeight={defaultHeight}
      defaultX={defaultX}
      defaultY={defaultY}
      zIndex={zIndex}
      className={className}
      role={role}
      modal={modal}
      ariaLabel={ariaLabel}
    >
      {children}
    </DesktopPanel>
  );
}

/* ========== MOBILE BOTTOM SHEET ========== */
function MobileBottomSheet({ title, titleId, onClose, className, role, modal, ariaLabel, children }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && onClose) {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <>
      <motion.div
        className="mobile-bottom-sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className={`mobile-bottom-sheet ${className}`}
        role={role}
        aria-modal={modal ? 'true' : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        onKeyDown={handleKeyDown}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="mobile-bottom-sheet-handle" />
        <div className="mobile-bottom-sheet-header">
          <h3 id={titleId} className="mobile-bottom-sheet-title">{title}</h3>
          {onClose && (
            <button
              type="button"
              className="mobile-bottom-sheet-close"
              onClick={onClose}
              aria-label="Close panel"
            >
              &#x2715;
            </button>
          )}
        </div>
        <div className="mobile-bottom-sheet-body">
          <div style={{ padding: 'var(--space-3)' }}>
            {children}
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ========== DESKTOP DRAGGABLE PANEL ========== */
function DesktopPanel({
  id, title, titleId, children, onClose,
  minWidth, minHeight, maxWidth, maxHeight,
  defaultWidth, defaultHeight, defaultX, defaultY,
  zIndex, className, role, modal, ariaLabel,
}) {
  const [size, setSize] = useState(() => {
    const saved = Storage.getItem(`panel-size-${id}`);
    return saved ? JSON.parse(saved) : { width: defaultWidth, height: defaultHeight };
  });

  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef(null);
  const dragData = useRef({
    startX: 0, startY: 0,
    initialX: 0, initialY: 0,
    currentX: 0, currentY: 0,
  });

  const applyPosition = (x, y) => {
    if (panelRef.current) {
      panelRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  };

  useEffect(() => {
    const saved = Storage.getItem(`panel-pos-${id}`);
    const pos = saved ? JSON.parse(saved) : { x: defaultX, y: defaultY };
    dragData.current.currentX = pos.x;
    dragData.current.currentY = pos.y;
    applyPosition(pos.x, pos.y);
  }, [id, defaultX, defaultY]);

  useEffect(() => {
    Storage.setItem(`panel-size-${id}`, JSON.stringify(size));
  }, [id, size]);

  const handlePointerDown = (e) => {
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
      if (moveEvent.cancelable) moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - dragData.current.startX;
      const deltaY = moveEvent.clientY - dragData.current.startY;
      const nextX = dragData.current.initialX + deltaX;
      const nextY = dragData.current.initialY + deltaY;
      dragData.current.currentX = nextX;
      dragData.current.currentY = nextY;
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
      Storage.setItem(`panel-pos-${id}`, JSON.stringify({
        x: dragData.current.currentX,
        y: dragData.current.currentY,
      }));
    };

    header.addEventListener('pointermove', handlePointerMove);
    header.addEventListener('pointerup', handlePointerUp);
    header.addEventListener('pointercancel', handlePointerUp);
  };

  const onResize = (event, { size: newSize }) => {
    if (Math.abs(size.width - newSize.width) > 1 || Math.abs(size.height - newSize.height) > 1) {
      setSize({ width: newSize.width, height: newSize.height });
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && onClose) {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      ref={panelRef}
      className={`floating-panel ${className} ${isDragging ? 'is-dragging' : ''}`}
      role={role}
      aria-modal={modal ? 'true' : undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        zIndex,
        width: size.width,
        height: size.height,
        left: 0,
        top: 0,
        touchAction: 'none',
      }}
    >
      <ResizableBox
        width={size.width}
        height={size.height}
        minConstraints={[minWidth, minHeight]}
        maxConstraints={[maxWidth, maxHeight]}
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
              <h3 id={titleId} className="panel-title">{title}</h3>
            </div>
            {onClose && (
              <button
                type="button"
                className="panel-close-btn"
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
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
  maxWidth: PropTypes.number,
  maxHeight: PropTypes.number,
  defaultWidth: PropTypes.number,
  defaultHeight: PropTypes.number,
  defaultX: PropTypes.number,
  defaultY: PropTypes.number,
  zIndex: PropTypes.number,
  className: PropTypes.string,
  role: PropTypes.string,
  modal: PropTypes.bool,
  ariaLabel: PropTypes.string,
};
