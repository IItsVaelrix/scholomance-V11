import { useState, useMemo } from 'react';
import { useProgression } from '../../hooks/useProgression';
import './NexusPanel.css';

const formatSynergyLabel = (synergyId) =>
  String(synergyId || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export const NexusPanel = () => {
  const { nexus } = useProgression();
  const [selectedWord, setSelectedWord] = useState(null);

  const discoveredWords = useMemo(() => {
    return Object.values(nexus.discoveredWords).sort((a, b) => b.level - a.level);
  }, [nexus.discoveredWords]);

  const renderWordMastery = (mastery) => {
    return (
      <button
        key={mastery.word}
        type="button"
        className={`nexus-word-card tier-${mastery.level}`}
        onClick={() => setSelectedWord(mastery)}
        aria-pressed={selectedWord?.word === mastery.word}
        aria-label={`Inspect ${mastery.word} resonance`}
      >
        <div className="word-text">{mastery.word}</div>
        <div className="word-level">Lvl {mastery.level}</div>
        <div className="word-level">{mastery.exp} resonance</div>
      </button>
    );
  };

  const renderSelectedDetail = () => {
    if (!selectedWord) return <div className="nexus-empty-state">Select a word to view its resonance</div>;

    const unlockedSynergies = Array.isArray(selectedWord.unlockedSynergies)
      ? selectedWord.unlockedSynergies
      : [];

    return (
      <div className="nexus-detail-view">
        <h2>{selectedWord.word}</h2>
        <div className="detail-stats">
          <p>Mastery Level: {selectedWord.level}</p>
          <p>Resonance: {selectedWord.exp}</p>
          <p>Uses: {selectedWord.stats.count}</p>
          <p>Schools: {selectedWord.stats.schools.join(', ')}</p>
        </div>

        <div className="synergy-section">
          <h3>Unlocked Resonances</h3>
          {unlockedSynergies.length === 0 ? (
            <p className="no-synergies">No resonance links awakened for this word yet.</p>
          ) : (
            unlockedSynergies.map((synergyId) => (
              <div key={synergyId} className="synergy-card unlocked">
                <h4>{formatSynergyLabel(synergyId)}</h4>
                <p>Unlocked through nexus progression.</p>
              </div>
            ))
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
