import { motion } from 'framer-motion';

export function DuplicatePreviewGrid({ duplicates, onDownload }) {
  if (!duplicates || duplicates.length === 0) return null;

  return (
    <div className="duplicate-preview-grid">
      <div className="section-label telemetry-text">Generated Echoes</div>
      <div className="duplicates-row">
        {duplicates.map((dup, index) => (
          <motion.div
            key={dup.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="duplicate-card"
          >
            <div className="duplicate-preview-box">
              <img src={dup.previewBase64} alt={`Echo ${index}`} />
            </div>
            <div className="duplicate-info">
              <span className="telemetry-text">{dup.texture}</span>
              {dup.school && <span className="school-tag">{dup.school}</span>}
            </div>
            <button 
              className="download-btn"
              onClick={() => onDownload(dup)}
            >
              DOWNLOAD
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
