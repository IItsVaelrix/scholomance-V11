/**
 * Analysis Worker Stub
 * This is a placeholder for the actual analysis worker.
 * The worker is used for background phoneme analysis.
 */

// Minimal worker implementation for build compatibility
self.onmessage = function(event) {
  const { type, data } = event.data;
  
  switch (type) {
    case 'analyze':
      // Stub response
      self.postMessage({
        type: 'analysis-result',
        data: {
          lines: [],
          allWords: [],
          allConnections: []
        }
      });
      break;
    
    default:
      self.postMessage({
        type: 'error',
        message: 'Unknown message type: ' + type
      });
  }
};
