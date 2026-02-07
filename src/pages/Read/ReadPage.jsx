import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { usePhonemeEngine } from "../../hooks/usePhonemeEngine.jsx";
import { useScrolls } from "../../hooks/useScrolls.jsx";
import { useProgression } from "../../hooks/useProgression.jsx";
import { useDeepRhymeAnalysis } from "../../hooks/useDeepRhymeAnalysis.jsx";
import { useWordLookup } from "../../hooks/useWordLookup.jsx";
import { useCODExPipeline } from "../../hooks/useCODExPipeline.jsx";
import { XP_SOURCES } from "../../data/progression_constants.js";
import { ReferenceEngine } from "../../lib/reference.engine.js";
import WordTooltip from "../../components/WordTooltip.jsx";
import RhymeSchemePanel from "../../components/RhymeSchemePanel.jsx";
import RhymeDiagramPanel from "../../components/RhymeDiagramPanel.jsx";
import ScrollEditor from "./ScrollEditor.jsx";
import ScrollList from "./ScrollList.jsx";
import TruesightControls, { ANALYSIS_MODES } from "./TruesightControls.jsx";
import AmbientOrb from "../../components/AmbientOrb.jsx";
import { SCHOOLS } from "../../data/schools.js";
import { SCHOOL_SKINS, getVowelColorsForSchool } from "../../data/schoolPalettes.js";
import { useTheme } from "../../hooks/useTheme.jsx";
import "./ReadPage.css";

export default function ReadPage() {
  const { theme } = useTheme();
  const { isReady, engine } = usePhonemeEngine();
  const { scrolls, saveScroll, deleteScroll, getScrollById } =
    useScrolls();
  const { addXP, progression } = useProgression();

  // CODEx pipeline integration (gradual migration)
  const { useCODExPipeline: codexEnabled } = useCODExPipeline();
  const {
    lookup: codexLookup,
    isLoading: isWordLoading,
    error: wordLookupError,
  } = useWordLookup();

  const [annotation, setAnnotation] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [analyzedWords, setAnalyzedWords] = useState(() => new Map());
  const [activeScrollId, setActiveScrollId] = useState(null);
  const [isEditable, setIsEditable] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [isTruesight, setIsTruesight] = useState(false);
  const [analysisMode, setAnalysisMode] = useState(ANALYSIS_MODES.VOWEL);
  const [editorContent, setEditorContent] = useState("");
  const [highlightedLines, setHighlightedLines] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('DEFAULT');

  // Schools available for color palette (default + 5 schools)
  const schoolList = useMemo(() => [
    { id: 'DEFAULT', name: 'Truesight', glyph: '🌈' },
    ...['SONIC', 'PSYCHIC', 'VOID', 'ALCHEMY', 'WILL'].map((id) => ({
      id,
      name: SCHOOLS[id].name,
      glyph: SCHOOLS[id].glyph,
    })),
  ], []);

  // Deep rhyme analysis hook
  const {
    analysis: deepAnalysis,
    schemeDetection,
    meterDetection,
    hasComplexScheme,
    isAnalyzing,
    analyzeDocument,
    activeConnections,
    highlightedGroup,
    highlightRhymeGroup,
    clearHighlight,
    literaryDevices,
    emotion,
  } = useDeepRhymeAnalysis();

  const editorRef = useRef(null);
  const groupDwellTimerRef = useRef(null);
  const activeScroll = activeScrollId ? getScrollById(activeScrollId) : null;

  // Memoize lineCount to avoid recomputing on every render
  const lineCount = useMemo(() => {
    return (editorContent || activeScroll?.content || '').split('\n').length;
  }, [editorContent, activeScroll?.content]);

  // Create announcement when annotation changes
  useEffect(() => {
    if (annotation) {
      setAnnouncement(
        `${annotation.word}: ${annotation.vowelFamily} vowel family, ` +
        `${annotation.phonemes.length} phonemes, ` +
        `rhyme key ${annotation.rhymeKey}`
      );
    } else {
      setAnnouncement("");
    }
  }, [annotation]);

  // Handle Truesight activation - vowel family analysis (Fix 2: use Map for O(1) updates)
  const truesightContent = editorContent || activeScroll?.content;
  useEffect(() => {
    if (isTruesight && truesightContent && engine && isReady) {
      const words = truesightContent.match(/[A-Za-z']+/g) || [];

      // Collect only NEW words that need analysis
      const newEntries = [];
      for (const word of words) {
        const clean = word.toUpperCase();
        if (clean && !analyzedWords.has(clean)) {
          const result = engine.analyzeWord(clean);
          if (result) {
            newEntries.push([clean, {
              word: clean,
              ...result,
              rhymeKey: result.rhymeKey ?? `${result.vowelFamily}-${result.coda ?? ""}`
            }]);
          }
        }
      }

      // Only update state if we have new words
      if (newEntries.length > 0) {
        setAnalyzedWords(prev => {
          const next = new Map(prev);
          for (const [key, value] of newEntries) {
            next.set(key, value);
          }
          return next;
        });
      }
    }
  }, [isTruesight, truesightContent, engine, isReady, analyzedWords]);

  // Trigger deep analysis when in rhyme/scheme modes
  useEffect(() => {
    if (isTruesight && analysisMode !== ANALYSIS_MODES.VOWEL && truesightContent) {
      analyzeDocument(truesightContent);
    }
  }, [isTruesight, analysisMode, truesightContent, analyzeDocument]);

  // Award XP for discovering rhyme schemes
  const schemeDiscoveryRef = useRef(new Set());
  useEffect(() => {
    if (schemeDetection && schemeDetection.id !== 'FREE_VERSE' && activeScrollId) {
      const discoveryKey = `scheme-${schemeDetection.id}-${activeScrollId}`;
      if (!schemeDiscoveryRef.current.has(discoveryKey)) {
        schemeDiscoveryRef.current.add(discoveryKey);
        const xpAmount = hasComplexScheme
          ? XP_SOURCES.COMPLEX_SCHEME_DETECTED || 200
          : XP_SOURCES.NEW_RHYME_SCHEME || 150;
        addXP(xpAmount, "scheme-discovery", discoveryKey);
      }
    }
  }, [schemeDetection, activeScrollId, hasComplexScheme, addXP]);

  const analyze = useCallback(
    async (word, event) => {
      const clean = String(word || "")
        .replace(/[^A-Za-z']/g, "")
        .toUpperCase();
      if (!clean) return;

      if (event) {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }

      const result = engine.analyzeWord(clean);
      if (result) {
        const rhymeKey =
          result.rhymeKey ?? `${result.vowelFamily}-${result.coda ?? ""}`;

        // Use CODEx pipeline if enabled, otherwise fall back to legacy ReferenceEngine
        let references;
        if (codexEnabled) {
          try {
            const lexicalEntry = await codexLookup(clean);
            if (lexicalEntry) {
              references = {
                definition: lexicalEntry.definition,
                definitions: lexicalEntry.definitions || [],
                synonyms: lexicalEntry.synonyms || [],
                antonyms: lexicalEntry.antonyms || [],
                rhymes: lexicalEntry.rhymes || [],
                lore: lexicalEntry.lore || null,
              };
            } else {
              // Fallback to legacy if CODEx returns nothing
              references = await ReferenceEngine.fetchAll(clean);
            }
          } catch (err) {
            console.warn('[ReadPage] CODEx lookup failed, falling back to legacy:', err);
            references = await ReferenceEngine.fetchAll(clean);
          }
        } else {
          references = await ReferenceEngine.fetchAll(clean);
        }

        const analysis = {
          word: clean,
          ...result,
          rhymeKey,
          ...references
        };

        setAnnotation(analysis);
        setAnalyzedWords(prev => new Map(prev).set(clean, analysis));
      }
    },
    [engine, codexEnabled, codexLookup]
  );

  const handleSaveScroll = useCallback(
    async (title, content) => {
      const isUpdate = Boolean(isEditing && activeScrollId);
      const savedScroll = await saveScroll({
        id: isUpdate ? activeScrollId : undefined,
        title,
        content,
      });

      if (!savedScroll) return;

      setActiveScrollId(savedScroll.id);
      setIsEditing(false);
      setIsEditable(false);

      if (isUpdate) {
        addXP(
          XP_SOURCES.SCROLL_COMPLETED,
          "scroll-submission",
          `scroll-submitted-${savedScroll.id}`
        );
      } else {
        addXP(
          XP_SOURCES.SCROLL_CREATED,
          "scroll-creation",
          `scroll-created-${savedScroll.id}`
        );
        addXP(
          XP_SOURCES.SCROLL_COMPLETED,
          "scroll-submission",
          `scroll-submitted-${savedScroll.id}`
        );
      }
    },
    [isEditing, activeScrollId, saveScroll, addXP]
  );

  const handleSelectScroll = useCallback((id) => {
    setActiveScrollId(id);
    setIsEditing(false);
    setIsEditable(false);
    setAnnotation(null);
    setAnalyzedWords(new Map());
    setIsTruesight(false);
  }, []);

  const handleNewScroll = useCallback(() => {
    setActiveScrollId(null);
    setIsEditing(false);
    setIsEditable(true);
    setAnnotation(null);
    setAnalyzedWords(new Map());
    setIsTruesight(false);
  }, []);

  const handleEditScroll = useCallback(() => {
    setIsEditing(true);
    setIsEditable(true);
  }, []);

  const handleDeleteScroll = useCallback(
    (id) => {
      deleteScroll(id);
      if (activeScrollId === id) {
        setActiveScrollId(null);
        setIsEditable(true);
        setIsEditing(false);
      }
    },
    [deleteScroll, activeScrollId]
  );

  const handleCancelEdit = useCallback(() => {
    if (activeScrollId) {
      setIsEditing(false);
      setIsEditable(false);
    }
  }, [activeScrollId]);

  const handleTooltipDrag = useCallback((newPos) => {
    setTooltipPosition(newPos);
  }, []);

  const handleToolbarSubmit = useCallback(() => {
    editorRef.current?.save?.();
  }, []);

  return (
    <section className="readPage page-theme--read">
      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      <div className="container" inert={annotation ? "" : undefined}>
        <header className="grimoire-header">
          <div className="kicker">The Arcane Codex</div>
          <h1 className="grimoire-title">Scribe &amp; Analyze</h1>
          <p className="grimoire-subtitle">
            Inscribe thy verses upon sacred scrolls. Each word becomes a portal —
            click to unveil its vowel-family, phonemes, and rhyme key.
          </p>
        </header>

        <div className="codex-layout">
          {/* Left Panel: Scroll List or Rhyme Diagram */}
          <aside className="codex-sidebar">
            {isTruesight && analysisMode === ANALYSIS_MODES.RHYME ? (
              <RhymeDiagramPanel
                connections={activeConnections}
                lineCount={lineCount}
                visible={true}
                onConnectionHover={setHighlightedLines}
                onConnectionLeave={() => setHighlightedLines([])}
                highlightedLines={highlightedLines}
              />
            ) : (
              <ScrollList
                scrolls={scrolls}
                activeScrollId={activeScrollId}
                onSelect={handleSelectScroll}
                onDelete={handleDeleteScroll}
                onNewScroll={handleNewScroll}
              />
            )}
          </aside>

          {/* Right Panel: Workspace with Toolbar + Document */}
          <main className="codex-main">
            <div className="codex-workspace">
              {/* Extensible Toolbar */}
              <div className="document-toolbar">
                <div className="toolbar-group toolbar-group--modes">
                  <TruesightControls
                    isTruesight={isTruesight}
                    onToggle={() => setIsTruesight(!isTruesight)}
                    analysisMode={analysisMode}
                    onModeChange={setAnalysisMode}
                    isAnalyzing={isAnalyzing}
                    disabled={!isReady}
                  />
                  {isTruesight && (
                    <select
                      className="school-dropdown"
                      value={selectedSchool}
                      onChange={(e) => setSelectedSchool(e.target.value)}
                      aria-label="Select school color skin"
                    >
                      {schoolList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.glyph} {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {!isEditable && activeScrollId && (
                    <button
                      type="button"
                      className="toolbar-btn"
                      onClick={handleEditScroll}
                      title="Edit this scroll"
                    >
                      <span aria-hidden="true">&#x270E;</span>
                      Edit
                    </button>
                  )}
                </div>

                <div className="toolbar-group toolbar-group--center">
                  <span className="toolbar-badge">
                    {isEditable ? (isEditing ? 'Editing' : 'Drafting') : 'Reading'}
                  </span>
                </div>

                <div className="toolbar-group toolbar-group--actions">
                  <div className="toolbar-ambient-control" aria-label="Ambient playback">
                    <AmbientOrb
                      unlockedSchools={progression.unlockedSchools}
                      variant="toolbar"
                      interactionMode="play-pause"
                    />
                  </div>
                  {isEditable && (
                    <>
                      <button
                        type="button"
                        className="toolbar-btn toolbar-btn--submit"
                        onClick={handleToolbarSubmit}
                        disabled={!isReady}
                        title={isEditing ? "Update scroll" : "Submit scroll"}
                      >
                        {isEditing ? "Update Scroll" : "Submit Scroll"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Floating Document Page */}
              <AnimatePresence mode="popLayout">
                {activeScrollId || isEditable ? (
                  <div className="document-container">
                    <div className="document-page document-page--dark">
                      <ScrollEditor
                        ref={editorRef}
                        key={activeScrollId || "new"}
                        initialTitle={activeScroll?.title || ""}
                        initialContent={activeScroll?.content || ""}
                        onSave={handleSaveScroll}
                        onCancel={isEditing ? handleCancelEdit : undefined}
                        isEditing={isEditing}
                        isEditable={isEditable}
                        disabled={!isReady}
                        isTruesight={isTruesight}
                        analysisMode={analysisMode}
                        onContentChange={setEditorContent}
                        analyzedWords={analyzedWords}
                        onWordClick={analyze}
                        deepAnalysis={deepAnalysis}
                        activeConnections={activeConnections}
                        highlightedLines={highlightedLines}
                        vowelColors={getVowelColorsForSchool(selectedSchool, theme)}
                        theme={theme}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="scroll-placeholder animate-scaleIn">
                    <div className="placeholder-sigil">&#x1F4DC;</div>
                    <h3>Select or Create a Scroll</h3>
                    <p>Choose a scroll from the list or start a new inscription.</p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleNewScroll}
                    >
                      Begin New Scroll
                    </button>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {annotation && (
          <WordTooltip
            wordData={annotation}
            isLoading={isWordLoading}
            error={wordLookupError}
            x={tooltipPosition.x}
            y={tooltipPosition.y}
            onDrag={handleTooltipDrag}
            onClose={() => setAnnotation(null)}
          />
        )}
      </AnimatePresence>

      {/* Rhyme Scheme Panel - visible in scheme mode */}
      <AnimatePresence>
        <RhymeSchemePanel
          scheme={schemeDetection}
          meter={meterDetection}
          statistics={deepAnalysis?.statistics}
          literaryDevices={literaryDevices}
          emotion={emotion}
          onGroupHover={(label) => {
            highlightRhymeGroup(label);
            // Clear any pending dwell timer from a previous group
            if (groupDwellTimerRef.current) clearTimeout(groupDwellTimerRef.current);
            // After 2.5s dwell, trigger the full dissolve + collapse
            groupDwellTimerRef.current = setTimeout(() => {
              const lines = schemeDetection?.groups?.get(label);
              if (lines) setHighlightedLines(lines);
            }, 2500);
          }}
          onGroupLeave={() => {
            if (groupDwellTimerRef.current) clearTimeout(groupDwellTimerRef.current);
            clearHighlight();
            setHighlightedLines([]);
          }}
          visible={isTruesight && analysisMode === ANALYSIS_MODES.SCHEME}
        />
      </AnimatePresence>

    </section>
  );
}
