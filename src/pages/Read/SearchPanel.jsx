import { useState, useMemo } from 'react';
import './IDE.css';

export default function SearchPanel({ content, onJumpToLine }) {
  const [query, setQuery] = useState('');
  
  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    
    const lines = content.split('\n');
    const searchResults = [];
    
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        searchResults.push({
          line: index + 1,
          text: line.trim()
        });
      }
    });
    
    return searchResults;
  }, [content, query]);

  return (
    <div className="search-panel">
      <div className="search-input-wrapper">
        <input 
          type="text" 
          placeholder="Search in scroll..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')}>✕</button>
        )}
      </div>
      
      <div className="search-results">
        {results.length > 0 ? (
          results.map((result, i) => (
            <button 
              key={i} 
              className="search-result-item"
              onClick={() => onJumpToLine?.(result.line)}
            >
              <span className="result-line-num">{result.line}</span>
              <span className="result-text">{result.text}</span>
            </button>
          ))
        ) : query.length >= 2 ? (
          <div className="search-no-results">No matches found.</div>
        ) : (
          <div className="search-hint">Type at least 2 characters to search.</div>
        )}
      </div>
    </div>
  );
}
