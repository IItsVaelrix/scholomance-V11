import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PropTypes from "prop-types";
import { patternColor } from "../../lib/patternColor.js";
import ChroniclePanel from "./ChroniclePanel.jsx";
import "./AnalysisPanel.css";
import "../../components/InfoBeamPanel.css";

const HIDDEN_STATE_LABELS = {
  terminal_anchor: "Terminal",
  stress_anchor: "Stressed",
  function_gate: "Function",
  lexical_chain: "Lexical",
  line_launch: "Launch",
  flow: "Flow",
};

const HIDDEN_STATE_COLORS = {
  terminal_anchor: "#c9a840",
  stress_anchor: "#a78bfa",
  function_gate: "#94a3b8",
  lexical_chain: "#67e8f9",
  line_launch: "#60a5fa",
  flow: "#475569",
};

const HEURISTIC_LABELS = {
  phoneme_density: "Phonemic Resonance",
  alliteration_density: "Consonant Allure",
  rhyme_quality: "Tonal Symmetry",
  scroll_power: "Kinetic Energy",
  meter_regularity: "Temporal Cadence",
  literary_device_richness: "Rhetorical Flourish",
  vocabulary_richness: "Lexical Depth",
  phonetic_hacking: "Spectral Subversion",
  emotional_resonance: "Affective Impact",
};

function formatHeuristicLabel(heuristicId) {
  if (!heuristicId) return "Insight";
  if (HEURISTIC_LABELS[heuristicId]) return HEURISTIC_LABELS[heuristicId];
  return String(heuristicId)
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatPercentFromUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0%";
  if (numeric <= 0) return "0%";
  if (numeric >= 1) return "100%";
  return `${Math.round(numeric * 100)}%`;
}

function formatNumber(value, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return digits > 0 ? (0).toFixed(digits) : "0";
  }
  return numeric.toFixed(digits);
}

function buildCodexCommentary({
  traces = [],
  literaryDevices = [],
  genreProfile = null,
  emotion = "Neutral",
  statistics = null,
}) {
  if (!Array.isArray(traces) || traces.length === 0) return "";

  const lead = traces[0];
  const supporting = traces.slice(1, 3);
  const profileBits = [];

  if (genreProfile?.genre) {
    profileBits.push(`genre leans ${String(genreProfile.genre).toLowerCase()}`);
  }
  if (emotion && emotion !== "Neutral") {
    profileBits.push(`tone reads ${String(emotion).toLowerCase()}`);
  }

  const inTextExamples = literaryDevices
    .flatMap((device) => (Array.isArray(device?.examples) ? device.examples : []))
    .filter((example) => typeof example === "string" && example.trim().length > 0)
    .slice(0, 2);

  const rhymeSummary = statistics
    ? {
      perfect: Number(statistics.perfectCount) || 0,
      near: Number(statistics.nearCount) || 0,
      slant: Number(statistics.slantCount) || 0,
      internal: Number(statistics.internalCount) || 0,
    }
    : null;

  const commentary = [
    `The strongest craft signal is ${formatHeuristicLabel(lead.heuristic)} (${formatPercentFromUnit(lead.rawScore)} signal, ${formatNumber(lead.contribution, 1)} CODEx points).`,
  ];

  const leadNarrative = lead.commentary || lead.explanation;
  if (leadNarrative) {
    commentary.push(String(leadNarrative).trim());
  }

  if (supporting.length > 0) {
    commentary.push(
      `Secondary drivers are ${supporting
        .map((trace) => `${formatHeuristicLabel(trace.heuristic)} (${formatPercentFromUnit(trace.rawScore)})`)
        .join(" and ")}.`
    );
  }

  if (profileBits.length > 0) {
    commentary.push(`Song profile: ${profileBits.join("; ")}.`);
  }

  if (rhymeSummary && (rhymeSummary.perfect + rhymeSummary.near + rhymeSummary.slant + rhymeSummary.internal > 0)) {
    commentary.push(
      `Rhyme footprint: ${rhymeSummary.perfect} perfect, ${rhymeSummary.near} near, ${rhymeSummary.slant} slant, ${rhymeSummary.internal} internal links.`
    );
  }

  if (inTextExamples.length > 0) {
    commentary.push(`Text evidence: ${inTextExamples.map((example) => `"${example}"`).join(" | ")}.`);
  }

  return commentary.join(" ");
}

function PatternChip({ letter }) {
  const color = patternColor(letter);
  return (
    <span className="analyze-pattern-chip" style={{ "--chip-color": color }}>
      {letter}
    </span>
  );
}

PatternChip.propTypes = { letter: PropTypes.string.isRequired };

function StanzaCard({ stanza }) {
  const stateCounts = stanza.hiddenStateCounts || {};
  const total = Object.values(stateCounts).reduce((a, b) => a + b, 0) || 1;
  const sorted = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0]?.[0] || "flow";

  return (
    <div className="analyze-stanza-card">
      <div className="analyze-stanza-header">
        <span className="analyze-stanza-index">Stanza {stanza.stanzaIndex + 1}</span>
        <span
          className="analyze-stanza-dominant"
          style={{ "--state-color": HIDDEN_STATE_COLORS[dominant] || "#475569" }}
        >
          {HIDDEN_STATE_LABELS[dominant] || dominant}
        </span>
        <span className="analyze-stanza-tokens">{stanza.tokenCount}t</span>
      </div>
      <div className="analyze-state-bar">
        {sorted.map(([state, count]) => (
          <div
            key={state}
            className="analyze-state-segment"
            style={{
              width: `${(count / total) * 100}%`,
              "--state-color": HIDDEN_STATE_COLORS[state] || "#475569",
            }}
            title={`${HIDDEN_STATE_LABELS[state] || state}: ${count}`}
          />
        ))}
      </div>
    </div>
  );
}

StanzaCard.propTypes = {
  stanza: PropTypes.shape({
    stanzaIndex: PropTypes.number,
    tokenCount: PropTypes.number,
    hiddenStateCounts: PropTypes.object,
  }).isRequired,
};

export default function AnalysisPanel({
  scheme = null,
  meter = null,
  statistics = null,
  literaryDevices = [],
  emotion = "Neutral",
  genreProfile = null,
  hhmSummary = null,
  scoreData = null,
  rhymeAstrology = null,
  narrativeAMP = null,
  oracle = null,
  onGroupHover = null,
  onGroupLeave = null,
  infoBeamEnabled = false,
  onInfoBeamToggle = null,
  onGroupClick = null,
  activeInfoBeamFamily = null,
  surfaceMode = "full",
  currentLineText = "",
}) {
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  const groupEntries = scheme?.groups ? Array.from(scheme.groups.entries()) : [];
  const patternLetters = scheme?.pattern ? [...scheme.pattern] : [];
  const isAstrologySurface = surfaceMode === "astrology";
  const hasRhymeAstrology = Boolean(rhymeAstrology?.enabled);
  const rhymeAstrologyAnchors = Array.isArray(rhymeAstrology?.inspector?.anchors)
    ? rhymeAstrology.inspector.anchors
    : [];
  const rhymeAstrologyClusters = Array.isArray(rhymeAstrology?.inspector?.clusters)
    ? rhymeAstrology.inspector.clusters
    : [];
  const heuristicTraces = Array.isArray(scoreData?.traces)
    ? [...scoreData.traces]
      .filter((trace) => trace && typeof trace === "object")
      .map((trace) => ({
        ...trace,
        rawScore: Number(trace.rawScore) || 0,
        weight: Number(trace.weight) || 0,
        contribution: Number(trace.contribution) || 0,
        diagnostics: Array.isArray(trace.diagnostics) ? trace.diagnostics : [],
      }))
      .sort((a, b) => b.contribution - a.contribution)
    : [];
  const hasLiteraryCraft = literaryDevices.length > 0 || heuristicTraces.length > 0;
  const resolvedNarrativeAMP = narrativeAMP && typeof narrativeAMP === "object"
    ? narrativeAMP
    : oracle && typeof oracle === "object"
      ? {
        narrator: String(oracle.persona || ""),
        mood: String(oracle.mood || "OBSERVANT"),
        summary: String(oracle.summary || ""),
        beats: Array.isArray(oracle.insights)
          ? oracle.insights.map((insight) => ({
            id: String(insight?.id || insight?.message || ""),
            tone: String(insight?.category || "TECHNICAL"),
            title: String(insight?.category || "Signal"),
            message: String(insight?.message || ""),
            evidence: Array.isArray(insight?.evidence) ? insight.evidence : [],
            signal: Number.isFinite(Number(insight?.scoreImpact)) ? Number(insight.scoreImpact) : null,
          }))
          : [],
        revisions: Array.isArray(oracle.suggestions) ? oracle.suggestions : [],
      }
      : null;
  const narrativeBeats = Array.isArray(resolvedNarrativeAMP?.beats) ? resolvedNarrativeAMP.beats : [];
  const narrativeRevisions = Array.isArray(resolvedNarrativeAMP?.revisions) ? resolvedNarrativeAMP.revisions : [];
  const hasNarrativeAMP = Boolean(
    resolvedNarrativeAMP?.summary || narrativeBeats.length > 0 || narrativeRevisions.length > 0
  );
  const codexCommentary = hasLiteraryCraft
    ? buildCodexCommentary({
      traces: heuristicTraces,
      literaryDevices,
      genreProfile,
      emotion,
      statistics,
    })
    : "";
  const hasContent = isAstrologySurface
    ? hasRhymeAstrology
    : scheme || meter || statistics || hhmSummary?.enabled || hasLiteraryCraft || hasRhymeAstrology || hasNarrativeAMP;

  return (
    <div className={`analyze-panel${isAstrologySurface ? " analyze-panel--astrology" : ""}`}>
      {/* Score badge */}
      {!isAstrologySurface && scoreData && (
        <div className="analyze-score-badge">
          <motion.span
            className="analyze-score-value"
            key={scoreData.totalScore}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {scoreData.totalScore}
          </motion.span>
          <span className="analyze-score-label">CODEx Resonance</span>
        </div>
      )}

      {/* Phonemic Oracle — Prioritized Detailed RAG Feedback */}
      {!isAstrologySurface && hasNarrativeAMP && (
        <section className="analyze-section analyze-narrative-amp-section">
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x25C9;</span> Narrative AMP
          </h4>
          <div className={`analyze-narrative-amp-shell analyze-narrative-amp-shell--${String(resolvedNarrativeAMP?.mood || "OBSERVANT").toLowerCase()}`}>
            <div className="analyze-narrative-amp-header">
              <span className="analyze-narrative-amp-persona">{resolvedNarrativeAMP?.narrator || "VerseIR Relay"}</span>
              <span className="analyze-narrative-amp-mood">{resolvedNarrativeAMP?.mood || "OBSERVANT"}</span>
            </div>
            {resolvedNarrativeAMP?.summary && (
              <p className="analyze-narrative-amp-summary">{resolvedNarrativeAMP.summary}</p>
            )}
            {narrativeBeats.length > 0 && (
              <div className="analyze-narrative-amp-column">
                <div className="analyze-craft-subtitle">VerseIR Relay Notes</div>
                <div className="analyze-narrative-amp-list">
                  {narrativeBeats.map((beat) => (
                    <article key={beat.id || beat.message} className="analyze-narrative-amp-card">
                      <div className="analyze-narrative-amp-card-header">
                        <span className="analyze-narrative-amp-category">{beat.tone || "TECHNICAL"}</span>
                        {Number.isFinite(Number(beat.signal)) && (
                          <span className="analyze-narrative-amp-impact">{formatPercentFromUnit(Math.abs(Number(beat.signal) || 0))} impact</span>
                        )}
                      </div>
                      <p className="analyze-narrative-amp-message">{beat.message}</p>
                      {Array.isArray(beat.evidence) && beat.evidence.length > 0 && (
                        <div className="analyze-narrative-amp-evidence">
                          {beat.evidence.map((entry) => (
                            <span key={entry} className="analyze-narrative-amp-evidence-chip">{entry}</span>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}
            {narrativeRevisions.length > 0 && (
              <div className="analyze-narrative-amp-column">
                <div className="analyze-craft-subtitle">Revision Paths</div>
                <div className="analyze-narrative-amp-list">
                  {narrativeRevisions.map((suggestion) => (
                    <article key={`${suggestion.original}-${suggestion.suggested}`} className="analyze-narrative-amp-card analyze-narrative-amp-card--suggestion">
                      <div className="analyze-narrative-amp-swap">
                        <span>{suggestion.original}</span>
                        <span className="analyze-narrative-amp-arrow">&rarr;</span>
                        <span>{suggestion.suggested}</span>
                      </div>
                      <p className="analyze-narrative-amp-message">{suggestion.reason}</p>
                      <span className="analyze-narrative-amp-gain">Gain +{formatPercentFromUnit(Math.min(1, Number(suggestion.resonanceGain) || 0))}</span>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Scroll Profile */}
      {!isAstrologySurface && (genreProfile || emotion !== "Neutral") && (
        <section className="analyze-section">
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x25C8;</span> Scroll Profile
          </h4>
          <div className="analyze-profile-row">
            {genreProfile && (
              <div className="analyze-profile-item">
                <span className="analyze-profile-label">Genre</span>
                <span className="analyze-profile-value">{genreProfile.genre}</span>
                {genreProfile.confidence != null && (
                  <div className="analyze-confidence-bar">
                    <motion.div
                      className="analyze-confidence-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(genreProfile.confidence * 100)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                )}
              </div>
            )}
            {emotion !== "Neutral" && (
              <div className="analyze-profile-item">
                <span className="analyze-profile-label">Tone</span>
                <span className="analyze-profile-value analyze-tone-value">{emotion}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Poetic Form */}
      {!isAstrologySurface && (scheme || (meter && meter.meterName !== "Free Verse")) && (
        <section className="analyze-section">
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x25C9;</span> Poetic Form
          </h4>
          {scheme && (
            <div className="analyze-scheme-block">
              <div className="analyze-scheme-name">{scheme.name || "Unknown Form"}</div>
              {patternLetters.length > 0 && (
                <div className="analyze-pattern-row">
                  {patternLetters.map((letter, i) => (
                    <PatternChip key={i} letter={letter} />
                  ))}
                </div>
              )}
              {scheme.confidence != null && scheme.confidence < 1 && (
                <div className="analyze-confidence-bar analyze-confidence-bar--sm">
                  <motion.div
                    className="analyze-confidence-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(scheme.confidence * 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              )}
              {scheme.lore && (
                <p className="analyze-scheme-lore">{scheme.lore}</p>
              )}
            </div>
          )}
          {meter && meter.meterName !== "Free Verse" && (
            <div className="analyze-meter-block">
              <span className="analyze-meter-name">{meter.meterName}</span>
              {meter.footName && (
                <span className="analyze-meter-detail">{meter.footName}</span>
              )}
              <span className="analyze-meter-consistency">
                {Math.round(meter.consistency * 100)}% consistent
              </span>
            </div>
          )}
        </section>
      )}

      {/* Rhyme Profile */}
      {!isAstrologySurface && statistics && (
        <section className="analyze-section">
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x25C7;</span> Rhyme Profile
          </h4>
          <div className="analyze-stats-grid">
            {[
              { label: "Perfect", value: statistics.perfectCount },
              { label: "Near", value: statistics.nearCount },
              { label: "Slant", value: statistics.slantCount },
              { label: "Internal", value: statistics.internalCount },
              { label: "Multi-syl", value: statistics.multiSyllableCount },
              { label: "Syllables", value: statistics.totalSyllables },
            ].map(({ label, value }) => (
              <div key={label} className="analyze-stat-cell">
                <span className="analyze-stat-value">{value ?? "—"}</span>
                <span className="analyze-stat-label">{label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rhyme Astrology */}
      {hasRhymeAstrology && (
        <section className={`analyze-section${isAstrologySurface ? " analyze-section--astrology-focus" : ""}`}>
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x2736;</span> Rhyme Astrology
          </h4>
          {isAstrologySurface && (
            <div className="analyze-astro-intro">
              <span className="analyze-astro-kicker">Constellation Lattice</span>
              <p>
                The active scroll is charted by shared vowel gravities, stress echoes, and repeated syllable windows.
              </p>
            </div>
          )}
          {rhymeAstrology?.features && (
            <div className="analyze-astro-features-bars">
              {[
                { label: "Affinity", key: "rhymeAffinityScore", color: "#67e8f9" },
                { label: "Density", key: "constellationDensity", color: "#c084fc" },
                { label: "Recurrence", key: "internalRecurrenceScore", color: "#f0d060" },
                { label: "Novelty", key: "phoneticNoveltyScore", color: "#4ade80" },
              ].map(({ label, key, color }) => {
                const pct = Math.round((Number(rhymeAstrology.features[key]) || 0) * 100);
                return (
                  <div key={label} className="analyze-astro-bar-row">
                    <div className="analyze-astro-bar-labels">
                      <span className="analyze-astro-bar-label">{label}</span>
                      <span className="analyze-astro-bar-value" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="analyze-astro-bar-track">
                      <motion.div
                        className="analyze-astro-bar-fill"
                        style={{ "--astro-bar-color": color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.55, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {rhymeAstrologyClusters.length > 0 && (
            <div className="analyze-astro-clusters">
              {rhymeAstrologyClusters.map((cluster) => {
                const cohesion = Number(cluster.cohesionScore) || 0;
                const density = Number(cluster.densityScore) || 0;
                const vowelFamilies = Array.isArray(cluster.dominantVowelFamily)
                  ? cluster.dominantVowelFamily.slice(0, 3)
                  : [];
                return (
                  <div key={cluster.id || cluster.label} className="analyze-astro-cluster">
                    <div className="analyze-astro-cluster-header">
                      <span className="analyze-astro-cluster-label">{cluster.label || cluster.id}</span>
                      <div className="analyze-astro-cluster-scores">
                        <span className="analyze-astro-cluster-score" title="Cohesion">
                          &#x25C9; {cohesion.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="analyze-astro-cluster-meta">
                      {cluster.anchorWord && <span className="analyze-astro-cluster-anchor">{cluster.anchorWord}</span>}
                      {cluster.sign && (
                        <span className="analyze-astro-cluster-sign">{cluster.sign}</span>
                      )}
                      <span className="analyze-astro-cluster-members">
                        {Number(cluster.membersCount) || 0} stars
                      </span>
                    </div>
                    {vowelFamilies.length > 0 && (
                      <div className="analyze-astro-cluster-families">
                        {vowelFamilies.map((f) => (
                          <span key={f} className="analyze-astro-family-tag">{f}</span>
                        ))}
                      </div>
                    )}
                    <div className="analyze-astro-cluster-bar-track">
                      <motion.div
                        className="analyze-astro-cluster-bar-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(density * 100)}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {rhymeAstrologyAnchors.length > 0 && (
            <div className="analyze-astro-anchor-strip">
              {rhymeAstrologyAnchors.slice(0, 8).map((anchor) => (
                <span
                  key={`${anchor.lineIndex}:${anchor.charStart}:${anchor.word}`}
                  className="analyze-astro-anchor"
                  title={anchor.sign ? `Sign: ${anchor.sign}` : undefined}
                >
                  {anchor.word}
                  {anchor.sign && (
                    <span className="analyze-astro-anchor-sign">{anchor.sign.split("-")[0]}</span>
                  )}
                </span>
              ))}
            </div>
          )}

          <div className="analyze-astro-diagnostics">
            <span>{Number(rhymeAstrology?.diagnostics?.anchorCount) || 0} anchors</span>
            <span className="analyze-dot">&#183;</span>
            <span>{Number(rhymeAstrology?.diagnostics?.cacheHitCount) || 0} hits</span>
            <span className="analyze-dot">&#183;</span>
            <span>{(Number(rhymeAstrology?.diagnostics?.averageQueryTimeMs) || 0).toFixed(1)}ms</span>
          </div>
        </section>
      )}

      {/* Verse Structure — HHM stanza data */}
      {!isAstrologySurface && hhmSummary?.enabled && hhmSummary.stanzas?.length > 0 && (
        <section className="analyze-section">
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x25EB;</span> Verse Structure
          </h4>
          <div className="analyze-hhm-meta">
            <span>{hhmSummary.stanzaCount} stanza{hhmSummary.stanzaCount !== 1 ? "s" : ""}</span>
            <span className="analyze-dot">·</span>
            <span>{hhmSummary.tokenCount} tokens</span>
            <span className="analyze-dot">·</span>
            <span>{hhmSummary.stanzaSizeBars}-bar groups</span>
          </div>
          <div className="analyze-stanzas">
            {hhmSummary.stanzas.map((stanza) => (
              <StanzaCard key={stanza.stanzaIndex} stanza={stanza} />
            ))}
          </div>
          <div className="analyze-state-legend">
            {Object.entries(HIDDEN_STATE_LABELS).map(([key, label]) => (
              <span
                key={key}
                className="analyze-legend-item"
                style={{ "--state-color": HIDDEN_STATE_COLORS[key] }}
              >
                <span className="analyze-legend-dot" />
                {label}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Literary Craft */}
      {!isAstrologySurface && hasLiteraryCraft && (
        <section className="analyze-section">
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x25B3;</span> Literary Craft
          </h4>

          {literaryDevices.length > 0 && (
            <div className="analyze-devices">
              {literaryDevices.map((device) => (
                <div key={device.id} className="analyze-device">
                  <div className="analyze-device-header">
                    <span className="analyze-device-name">{device.name}</span>
                    <span className="analyze-device-count">{device.count}&times;</span>
                  </div>
                  {device.definition && (
                    <p className="analyze-device-def">{device.definition}</p>
                  )}
                  {device.examples?.length > 0 && (
                    <div className="analyze-device-examples">
                      {device.examples.slice(0, 2).map((ex, i) => (
                        <span key={i} className="analyze-device-example">&ldquo;{ex}&rdquo;</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {heuristicTraces.length > 0 && (
            <div className="analyze-craft-ledger">
              <div className="analyze-craft-subtitle">Heuristic Audit</div>
              <div className="analyze-heuristic-list">
                {heuristicTraces.map((trace) => {
                  const topDiagnostic = trace.diagnostics.find((diagnostic) => diagnostic?.message);
                  const meterPercent = Math.max(0, Math.min(100, Math.round(trace.rawScore * 100)));
                  return (
                    <article key={trace.heuristic} className="analyze-heuristic-item">
                      <div className="analyze-heuristic-header">
                        <span className="analyze-heuristic-name">{formatHeuristicLabel(trace.heuristic)}</span>
                        <span className="analyze-heuristic-contribution">{formatNumber(trace.contribution, 1)}</span>
                      </div>
                      <div className="analyze-heuristic-track" aria-hidden="true">
                        <motion.div
                          className="analyze-heuristic-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${meterPercent}%` }}
                          transition={{ duration: 0.45, ease: "easeOut" }}
                        />
                      </div>
                      <div className="analyze-heuristic-meta">
                        <span>Signal {formatPercentFromUnit(trace.rawScore)}</span>
                        <span>Weight {formatNumber(trace.weight, 2)}</span>
                      </div>
                      <div className="analyze-narrative-deliberation">
                        <p className="analyze-heuristic-explanation">{trace.commentary || trace.explanation || "No technical justification provided."}</p>
                        {trace.examples?.length > 0 && (
                          <div className="analyze-narrative-citations">
                            {trace.examples.slice(0, 2).map((cite, ci) => (
                              <div key={ci} className="analyze-narrative-citation">
                                <span className="analyze-cite-glyph">◈</span>
                                <span className="analyze-cite-text">&ldquo;{cite}&rdquo;</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {topDiagnostic?.message && (
                        <p className="analyze-heuristic-note">Note: {topDiagnostic.message}</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {codexCommentary && (
            <div className="analyze-codex-commentary">
              <span className="analyze-codex-kicker">CODEx Commentary</span>
              <p>{codexCommentary}</p>
            </div>
          )}
        </section>
      )}

      {/* Literary Chronicles — Historical echoes */}
      {!isAstrologySurface && (
        <ChroniclePanel currentLineText={currentLineText} />
      )}

      {/* Rhyme Groups */}
      {!isAstrologySurface && groupEntries.length > 0 && (
        <section className="analyze-section">
          <div className="analyze-section-toggle-row">
            <button
              type="button"
              className="analyze-section-toggle"
              onClick={() => setGroupsExpanded(!groupsExpanded)}
              aria-expanded={groupsExpanded}
            >
              <h4 className="analyze-section-title">
                <span className="analyze-glyph">&#x25CE;</span> Rhyme Groups
              </h4>
              <span className="analyze-toggle-icon">{groupsExpanded ? "−" : "+"}</span>
              {!groupsExpanded && (
                <span className="analyze-badge">{groupEntries.length}</span>
              )}
            </button>
            <button
              type="button"
              className={`infobeam-toggle${infoBeamEnabled ? " active" : ""}`}
              onClick={(e) => { e.stopPropagation(); onInfoBeamToggle?.(); }}
              title="InfoBeam — click a group to view rhyme order"
              aria-pressed={infoBeamEnabled}
            >
              ◈
            </button>
          </div>
          <AnimatePresence>
            {groupsExpanded && (
              <motion.div
                className="analyze-groups"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                {groupEntries.map(([label, lineIndices]) => {
                  const color = patternColor(label);
                  const isBeamActive = activeInfoBeamFamily === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`analyze-group-btn${infoBeamEnabled ? " analyze-group-btn--beam" : ""}`}
                      style={{ "--chip-color": color }}
                      data-beam-active={isBeamActive ? "true" : undefined}
                      onMouseEnter={() => onGroupHover?.(label)}
                      onMouseLeave={onGroupLeave}
                      onFocus={() => onGroupHover?.(label)}
                      onBlur={onGroupLeave}
                      onClick={infoBeamEnabled ? () => onGroupClick?.(label) : undefined}
                    >
                      <span className="analyze-group-label">{label}</span>
                      <span className="analyze-group-lines">
                        {lineIndices.length === 1
                          ? `Line ${lineIndices[0] + 1}`
                          : `Lines ${lineIndices.map((l) => l + 1).join(", ")}`}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Empty state */}
      {!hasContent && (
        <div className="analyze-empty">
          <span className="analyze-empty-glyph">&#x2736;</span>
          <p>{isAstrologySurface ? "Write a scroll to chart its rhyme constellations." : "Write a scroll to reveal its structure."}</p>
        </div>
      )}
    </div>
  );
}

AnalysisPanel.propTypes = {
  scheme: PropTypes.shape({
    name: PropTypes.string,
    pattern: PropTypes.string,
    lore: PropTypes.string,
    confidence: PropTypes.number,
    groups: PropTypes.instanceOf(Map),
  }),
  meter: PropTypes.shape({
    footName: PropTypes.string,
    meterName: PropTypes.string,
    consistency: PropTypes.number,
    feetPerLine: PropTypes.number,
  }),
  statistics: PropTypes.shape({
    perfectCount: PropTypes.number,
    nearCount: PropTypes.number,
    slantCount: PropTypes.number,
    internalCount: PropTypes.number,
    multiSyllableCount: PropTypes.number,
    totalSyllables: PropTypes.number,
  }),
  literaryDevices: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      definition: PropTypes.string,
      count: PropTypes.number,
      examples: PropTypes.arrayOf(PropTypes.string),
    })
  ),
  emotion: PropTypes.string,
  genreProfile: PropTypes.shape({
    genre: PropTypes.string,
    confidence: PropTypes.number,
  }),
  hhmSummary: PropTypes.object,
  scoreData: PropTypes.object,
  rhymeAstrology: PropTypes.shape({
    enabled: PropTypes.bool,
    features: PropTypes.shape({
      rhymeAffinityScore: PropTypes.number,
      constellationDensity: PropTypes.number,
      internalRecurrenceScore: PropTypes.number,
      phoneticNoveltyScore: PropTypes.number,
    }),
    inspector: PropTypes.shape({
      anchors: PropTypes.arrayOf(PropTypes.object),
      clusters: PropTypes.arrayOf(PropTypes.object),
    }),
    diagnostics: PropTypes.shape({
      anchorCount: PropTypes.number,
      cacheHitCount: PropTypes.number,
      averageQueryTimeMs: PropTypes.number,
    }),
  }),
  narrativeAMP: PropTypes.shape({
    version: PropTypes.string,
    engine: PropTypes.string,
    narrator: PropTypes.string,
    mood: PropTypes.string,
    summary: PropTypes.string,
    beats: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string,
      tone: PropTypes.string,
      title: PropTypes.string,
      message: PropTypes.string,
      evidence: PropTypes.arrayOf(PropTypes.string),
      signal: PropTypes.number,
    })),
    revisions: PropTypes.arrayOf(PropTypes.shape({
      original: PropTypes.string,
      suggested: PropTypes.string,
      reason: PropTypes.string,
      resonanceGain: PropTypes.number,
    })),
  }),
  oracle: PropTypes.shape({
    version: PropTypes.string,
    persona: PropTypes.string,
    mood: PropTypes.string,
    summary: PropTypes.string,
    insights: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string,
      category: PropTypes.string,
      message: PropTypes.string,
      evidence: PropTypes.arrayOf(PropTypes.string),
      scoreImpact: PropTypes.number,
    })),
    suggestions: PropTypes.arrayOf(PropTypes.shape({
      original: PropTypes.string,
      suggested: PropTypes.string,
      reason: PropTypes.string,
      resonanceGain: PropTypes.number,
    })),
  }),
  onGroupHover: PropTypes.func,
  onGroupLeave: PropTypes.func,
  infoBeamEnabled: PropTypes.bool,
  onInfoBeamToggle: PropTypes.func,
  onGroupClick: PropTypes.func,
  activeInfoBeamFamily: PropTypes.string,
  surfaceMode: PropTypes.oneOf(["full", "astrology"]),
  currentLineText: PropTypes.string,
};
