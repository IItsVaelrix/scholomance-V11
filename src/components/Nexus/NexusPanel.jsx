import React, { useState, useMemo } from 'react';
import { useProgression } from '../../hooks/useProgression';
import { SYNERGIES, WORD_SYNERGY_MAP, MASTERY_LEVELS } from '../../../codex/core/nexus.registry';
import './NexusPanel.css';

export const NexusPanel = () => {
  const { nexus } = useProgression();
  const [selectedWord, setSelectedWord] = useState(null);

  const discoveredWords = useMemo(() => {
    return Object.values(nexus.discoveredWords).sort((a, b) => b.level - a.level);
  }, [nexus.discoveredWords]);

  const renderWordMastery = (mastery) => {
    const nextLevel = MASTERY_LEVELS[mastery.level] || MASTERY_LEVELS[MASTERY_LEVELS.length - 1];
    const progress = (mastery.exp / nextLevel.expRequired) * 100;
    
    return (
      <div 
        key={mastery.word} 
        className={`nexus-word-card tier-${mastery.level}`}
        onClick={() => setSelectedWord(mastery)}
      >
        <div className="word-text">{mastery.word}</div>
        <div className="word-level">Lvl {mastery.level}</div>
        <div className="mastery-progress-bar">
          <div className="progress-fill" style={{ width: `${Math.min(100, progress)}%` }}></div>
        </div>
      </div>
    );
  };

  const renderSelectedDetail = () => {
    if (!selectedWord) return <div className="nexus-empty-state">Select a word to view its resonance</div>;

    const synergies = WORD_SYNERGY_MAP[selectedWord.word] || [];

    return (
      <div className="nexus-detail-view">
        <h2>{selectedWord.word}</h2>
        <div className="detail-stats">
          <p>Mastery: {MASTERY_LEVELS[selectedWord.level - 1].name} (Level {selectedWord.level})</p>
          <p>Uses: {selectedWord.stats.count}</p>
          <p>Schools: {selectedWord.stats.schools.join(', ')}</p>
        </div>

        <div className="synergy-section">
          <h3>Synergies</h3>
          {synergies.length === 0 ? (
            <p className="no-synergies">No synergies discovered for this word yet.</p>
          ) : (
            synergies.map(id => {
              const synergy = SYNERGIES[id];
              const isUnlocked = selectedWord.level >= 3; // Placeholder logic
              return (
                <div key={id} className={`synergy-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
                  <h4>{synergy.name} {isUnlocked ? '✨' : '🔒'}</h4>
                  <p>{synergy.description}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="nexus-container">
      <div className="nexus-sidebar">
        <h3>Nexus Database</h3>
        <div className="word-grid">
          {discoveredWords.map(renderWordMastery)}
        </div>
      </div>
      <div className="nexus-main">
        {renderSelectedDetail()}
      </div>
    </div>
  );
};

export default NexusPanel;
