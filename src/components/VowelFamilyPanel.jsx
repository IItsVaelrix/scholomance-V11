import { useMemo } from "react";
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import { VOWEL_FAMILY_TO_SCHOOL, SCHOOLS } from "../data/schools.js";
import { normalizeVowelFamily } from "../lib/phonology/vowelFamily.js";
import "./VowelFamilyPanel.css";

function getSchoolColor(familyId) {
  const normalized = normalizeVowelFamily(familyId);
  const schoolId = normalized ? VOWEL_FAMILY_TO_SCHOOL[normalized] : null;
  return SCHOOLS[schoolId]?.color || "#94a3b8";
}

function getSchoolName(familyId) {
  const normalized = normalizeVowelFamily(familyId);
  const schoolId = normalized ? VOWEL_FAMILY_TO_SCHOOL[normalized] : null;
  return SCHOOLS[schoolId]?.name || "Unbound";
}

export default function VowelFamilyPanel({ visible, families, totalWords, uniqueWords, isEmbedded }) {
  if (!visible) return null;

  const topFamilies = useMemo(
    () => (Array.isArray(families) ? families.slice(0, 8) : []),
    [families]
  );

  const isEmpty = topFamilies.length === 0 || totalWords === 0;

  return (
    <div className={`vowel-family-panel${isEmbedded ? " vowel-family-panel--embedded" : ""}`}>
      <div className="vfp-header">
        <span className="vfp-title">Phoneme Families</span>
        {!isEmpty && (
          <span className="vfp-meta">{uniqueWords} unique &middot; {totalWords} total</span>
        )}
      </div>

      {isEmpty ? (
        <div className="vfp-empty">
          <span className="vfp-empty-glyph">&#x25C8;</span>
          <p className="vfp-empty-primary">No vowel-family data yet.</p>
          <p className="vfp-empty-secondary">Add some verse to see phoneme breakdown.</p>
        </div>
      ) : (
        <div className="vfp-families">
          {topFamilies.map((family) => {
            const color = getSchoolColor(family.id);
            const schoolName = getSchoolName(family.id);
            const pct = Math.round((family.percent || 0) * 100);
            return (
              <div key={family.id} className="vfp-family-row">
                <div className="vfp-family-labels">
                  <span className="vfp-family-id" style={{ color }}>{family.id}</span>
                  <span className="vfp-family-school">{schoolName}</span>
                  <span className="vfp-family-count">{family.count}</span>
                </div>
                <div className="vfp-bar-track">
                  <motion.div
                    className="vfp-bar-fill"
                    style={{ "--bar-color": color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                  <span className="vfp-bar-pct">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

VowelFamilyPanel.propTypes = {
  visible: PropTypes.bool.isRequired,
  families: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
      percent: PropTypes.number.isRequired,
    })
  ).isRequired,
  totalWords: PropTypes.number.isRequired,
  uniqueWords: PropTypes.number.isRequired,
  isEmbedded: PropTypes.bool,
};

VowelFamilyPanel.defaultProps = {
  isEmbedded: false,
};
