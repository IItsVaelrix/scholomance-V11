/**
 * Viewport Bytecode Channel
 * 
 * Centralizes viewport state as bytecode-driven reactive values.
 * All viewport-dependent rendering flows through this single source of truth.
 * 
 * ARCHITECTURE:
 * 1. ResizeObserver watches root container
 * 2. Viewport state encoded as bytecode
 * 3. Dimension Formula Compiler consumes bytecode
 * 4. PixelBrain renders with viewport-aware coordinates
 */

export interface ViewportState {
  width: number;
  height: number;
  deviceClass: 'desktop' | 'tablet' | 'mobile-ios' | 'mobile-android';
  orientation: 'portrait' | 'landscape' | 'square';
  pixelRatio: number;
}

export interface ViewportBytecode {
  timestamp: number;
  state: ViewportState;
  bindings: Map<string, (viewport: ViewportState) => number>;
}

/**
 * Detect device class from viewport width
 */
export function detectDeviceClass(width: number): ViewportState['deviceClass'] {
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  if (width >= 375) return 'mobile-ios';
  return 'mobile-android';
}

/**
 * Detect orientation from dimensions
 */
export function detectOrientation(width: number, height: number): ViewportState['orientation'] {
  if (width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

/**
 * Encode viewport state as bytecode
 */
export function encodeViewportBytecode(viewport: ViewportState): string {
  return [
    'VIEWPORT',
    `WIDTH ${viewport.width}`,
    `HEIGHT ${viewport.height}`,
    `DEVICE ${viewport.deviceClass}`,
    `ORIENTATION ${viewport.orientation}`,
    `PIXEL_RATIO ${viewport.pixelRatio}`,
    `TIMESTAMP ${Date.now()}`,
  ].join('\n');
}

/**
 * Create viewport bytecode channel with reactive bindings
 */
export function createViewportChannel(): {
  getState: () => ViewportState;
  getBytecode: () => string;
  bind: (id: string, callback: (viewport: ViewportState) => void) => () => void;
  observe: (element: HTMLElement) => () => void;
} {
  let state: ViewportState = {
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
    deviceClass: 'desktop',
    orientation: 'landscape',
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  };
  
  const bindings = new Map<string, (viewport: ViewportState) => void>();
  
  const updateState = (width: number, height: number) => {
    // Round dimensions to prevent sub-pixel noise loops
    const w = Math.round(width);
    const h = Math.round(height);
    const pr = window.devicePixelRatio || 1;

    // Redundancy check: STOP if state hasn't actually changed
    if (state.width === w && state.height === h && state.pixelRatio === pr) {
      return;
    }

    const newState: ViewportState = {
      width: w,
      height: h,
      deviceClass: detectDeviceClass(w),
      orientation: detectOrientation(w, h),
      pixelRatio: pr,
    };
    
    state = newState;
    
    // Notify all bindings
    bindings.forEach(callback => callback(state));
  };
  
  let currentObserver: ResizeObserver | null = null;

  return {
    getState: () => state,
    
    getBytecode: () => encodeViewportBytecode(state),
    
    bind: (id: string, callback: (viewport: ViewportState) => void) => {
      bindings.set(id, callback);
      // Immediately call with current state
      callback(state);
      
      // Return unsubscribe
      return () => bindings.delete(id);
    },
    
    observe: (element: HTMLElement) => {
      // Cleanup previous observer to ensure Single Source of Truth
      if (currentObserver) {
        currentObserver.disconnect();
      }

      if (typeof ResizeObserver === 'undefined') {
        // Fallback to window resize
        const onResize = () => updateState(window.innerWidth, window.innerHeight);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      }
      
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          updateState(width, height);
        }
      });
      
      observer.observe(element);
      currentObserver = observer;
      
      return () => {
        observer.disconnect();
        if (currentObserver === observer) currentObserver = null;
      };
    },
  };
}

/**
 * Viewport-aware dimension compiler integration
 * 
 * Usage:
 * const viewport = createViewportChannel();
 * const unsubscribe = viewport.bind('my-component', (vp) => {
 *   // React to viewport changes
 *   const width = vp.deviceClass === 'mobile' ? '100%' : '50%';
 * });
 */
export const ViewportChannel = createViewportChannel();
