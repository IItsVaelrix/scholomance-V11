/**
 * Toolbar Bytecode — PixelBrain-driven toolbar state
 * 
 * All toolbar tools flow through bytecode for deterministic, replayable state.
 * 
 * TOOLS:
 * - Truesight (on/off)
 * - Predictive (on/off)
 * - Analysis Mode (none/rhyme/analyze/astrology)
 * - Save State (dirty/clean/saving)
 * - Scheme Detection (active/inactive)
 */

export const TOOLBAR_TOOL = {
  TRUESIGHT: 'truesight',
  PREDICTIVE: 'predictive',
  ANALYSIS_MODE: 'analysis_mode',
  SAVE_STATE: 'save_state',
  SCHEME_DETECTION: 'scheme_detection',
};

export const ANALYSIS_MODE = {
  NONE: 'none',
  RHYME: 'rhyme',
  ANALYZE: 'analyze',
  ASTROLOGY: 'astrology',
} as const;

export const SAVE_STATE = {
  CLEAN: 'clean',
  DIRTY: 'dirty',
  SAVING: 'saving',
  SAVED: 'saved',
} as const;

export type AnalysisMode = typeof ANALYSIS_MODE[keyof typeof ANALYSIS_MODE];
export type SaveState = typeof SAVE_STATE[keyof typeof SAVE_STATE];

export interface ToolbarState {
  truesight: boolean;
  predictive: boolean;
  analysisMode: AnalysisMode;
  saveState: SaveState;
  schemeDetection: boolean;
  timestamp: number;
}

export interface ToolbarBytecode {
  version: string;
  state: ToolbarState;
  history: Array<{
    tool: string;
    action: string;
    timestamp: number;
  }>;
}

/**
 * Encode toolbar state as bytecode
 */
export function encodeToolbarBytecode(state: ToolbarState): string {
  return [
    'TOOLBAR_STATE',
    `TRUESIGHT ${state.truesight ? 'ON' : 'OFF'}`,
    `PREDICTIVE ${state.predictive ? 'ON' : 'OFF'}`,
    `ANALYSIS_MODE ${state.analysisMode.toUpperCase()}`,
    `SAVE_STATE ${state.saveState.toUpperCase()}`,
    `SCHEME_DETECTION ${state.schemeDetection ? 'ON' : 'OFF'}`,
    `TIMESTAMP ${state.timestamp}`,
  ].join('\n');
}

/**
 * Decode toolbar bytecode to state
 */
export function decodeToolbarBytecode(bytecode: string): Partial<ToolbarState> {
  const lines = bytecode.split('\n');
  const state: Partial<ToolbarState> = {};
  
  for (const line of lines) {
    const [key, value] = line.trim().split(/\s+/);
    
    switch (key) {
      case 'TRUESIGHT':
        state.truesight = value === 'ON';
        break;
      case 'PREDICTIVE':
        state.predictive = value === 'ON';
        break;
      case 'ANALYSIS_MODE':
        state.analysisMode = value.toLowerCase() as AnalysisMode;
        break;
      case 'SAVE_STATE':
        state.saveState = value.toLowerCase() as SaveState;
        break;
      case 'SCHEME_DETECTION':
        state.schemeDetection = value === 'ON';
        break;
      case 'TIMESTAMP':
        state.timestamp = parseInt(value, 10);
        break;
    }
  }
  
  return state;
}

/**
 * Create toolbar bytecode channel with reactive state
 */
export function createToolbarChannel(): {
  getState: () => ToolbarState;
  getBytecode: () => string;
  setTool: (tool: string, value: any) => void;
  subscribe: (callback: (state: ToolbarState) => void) => () => void;
} {
  let state: ToolbarState = {
    truesight: false,
    predictive: false,
    analysisMode: ANALYSIS_MODE.NONE,
    saveState: SAVE_STATE.CLEAN,
    schemeDetection: false,
    timestamp: Date.now(),
  };
  
  const subscribers = new Set<(state: ToolbarState) => void>();
  const history: Array<{ tool: string; action: string; timestamp: number }> = [];
  
  const notify = () => {
    state = { ...state, timestamp: Date.now() };
    subscribers.forEach(cb => cb(state));
  };
  
  return {
    getState: () => state,
    
    getBytecode: () => encodeToolbarBytecode(state),
    
    setTool: (tool: string, value: any) => {
      switch (tool) {
        case TOOLBAR_TOOL.TRUESIGHT:
          state.truesight = value;
          history.push({ tool, action: value ? 'ENABLED' : 'DISABLED', timestamp: Date.now() });
          break;
        case TOOLBAR_TOOL.PREDICTIVE:
          state.predictive = value;
          history.push({ tool, action: value ? 'ENABLED' : 'DISABLED', timestamp: Date.now() });
          break;
        case TOOLBAR_TOOL.ANALYSIS_MODE:
          state.analysisMode = value;
          history.push({ tool, action: `SET_${value.toUpperCase()}`, timestamp: Date.now() });
          break;
        case TOOLBAR_TOOL.SAVE_STATE:
          state.saveState = value;
          history.push({ tool, action: value.toUpperCase(), timestamp: Date.now() });
          break;
        case TOOLBAR_TOOL.SCHEME_DETECTION:
          state.schemeDetection = value;
          history.push({ tool, action: value ? 'ENABLED' : 'DISABLED', timestamp: Date.now() });
          break;
      }
      
      notify();
    },
    
    subscribe: (callback: (state: ToolbarState) => void) => {
      subscribers.add(callback);
      // Immediately call with current state
      callback(state);
      
      return () => subscribers.delete(callback);
    },
  };
}

/**
 * Global toolbar channel instance
 */
export const ToolbarChannel = createToolbarChannel();
