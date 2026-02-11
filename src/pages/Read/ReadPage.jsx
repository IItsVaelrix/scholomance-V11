import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";

import { useTheme } from "../../hooks/useTheme.jsx";
import { usePhonemeEngine } from "../../hooks/usePhonemeEngine.jsx";
import { useScrolls } from "../../hooks/useScrolls.jsx";
import { useDeepRhymeAnalysis } from "../../hooks/useDeepRhymeAnalysis.jsx";
import { useScoring } from "../../hooks/useScoring.js";
import { getVowelColorsForSchool } from "../../data/schoolPalettes.js";
import { SCHOOLS } from "../../data/schools.js";

import RhymeSchemePanel from "../../components/RhymeSchemePanel.jsx";
import RhymeDiagramPanel from "../../components/RhymeDiagramPanel.jsx";
import HeuristicScorePanel from "../../components/HeuristicScorePanel.jsx";
import VowelFamilyPanel from "../../components/VowelFamilyPanel.jsx";

import ScrollEditor from "./ScrollEditor.jsx";
import ScrollList from "./ScrollList.jsx";
import TruesightControls, { ANALYSIS_MODES } from "./TruesightControls.jsx";
import FloatingPanel from "../../components/shared/FloatingPanel.jsx";
import "./IDE.css";

const SCHOOL_GLYPHS = {
  DEFAULT: "\uD83C\uDF08",
  SONIC: "\u266A",
  PSYCHIC: "\u25EC",
  VOID: "\u2205",
  ALCHEMY: "\u2697",
  WILL: "\u26A1",
};

function getSchoolMetaFromVowelFamily(engine, familyId) {
  const schoolId = engine?.getSchoolFromVowelFamily?.(familyId);
  if (!schoolId) {
    return { schoolName: "Unbound", schoolGlyph: "\u2736" };
  }
  return {
    schoolName: SCHOOLS[schoolId]?.name || schoolId,
    schoolGlyph: SCHOOL_GLYPHS[schoolId] || "\u2736",
  };
}

export default function ReadPage() {
  const { theme } = useTheme();
  const { isReady, engine } = usePhonemeEngine();
  const { scrolls, saveScroll, deleteScroll, getScrollById } = useScrolls();
  const [analyzedWords, setAnalyzedWords] = useState(() => new Map());
  const [activeScrollId, setActiveScrollId] = useState(null);
  const [isEditable, setIsEditable] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTruesight, setIsTruesight] = useState(false);
  const [analysisMode, setAnalysisMode] = useState(ANALYSIS_MODES.VOWEL);
  const [editorContent, setEditorContent] = useState("");
  const [highlightedLines, setHighlightedLines] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState("DEFAULT");
  const [showScorePanel, setShowScorePanel] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 960;
  });

  const schoolList = useMemo(
    () => [
      { id: "DEFAULT", name: "Truesight", glyph: SCHOOL_GLYPHS.DEFAULT },
      ...["SONIC", "PSYCHIC", "VOID", "ALCHEMY", "WILL"].map((id) => ({
        id,
        name: SCHOOLS[id].name,
        glyph: SCHOOL_GLYPHS[id] || "\u2736",
      })),
    ],
    []
  );

  const {
    analysis: deepAnalysis,
    schemeDetection,
    meterDetection,
    isAnalyzing,
    analyzeDocument,
    activeConnections,
    highlightRhymeGroup,
    clearHighlight,
    literaryDevices,
    emotion,
  } = useDeepRhymeAnalysis();

  const editorRef = useRef(null);
  const activeScroll = activeScrollId ? getScrollById(activeScrollId) : null;

  const lineCount = useMemo(() => {
    return (editorContent || activeScroll?.content || "").split("\n").length;
  }, [editorContent, activeScroll?.content]);

  const truesightContent = editorContent || activeScroll?.content;
  const { scoreData } = useScoring(truesightContent);
  const activeVowelColors = useMemo(
    () => getVowelColorsForSchool(selectedSchool, theme),
    [selectedSchool, theme]
  );

  const vowelFamilyAnalytics = useMemo(() => {
    if (!isTruesight || analysisMode !== ANALYSIS_MODES.VOWEL) {
      return { families: [], totalWords: 0, uniqueWords: 0 };
    }
    const words = truesightContent?.match(/[A-Za-z']+/g) || [];
    if (!engine || words.length === 0) {
      return { families: [], totalWords: 0, uniqueWords: 0 };
    }
    const counts = new Map();
    const uniqueWords = new Set();
    for (const word of words) {
      const clean = String(word).replace(/[^A-Za-z']/g, "").toUpperCase();
      if (!clean) continue;
      uniqueWords.add(clean);
      const analysis = analyzedWords.get(clean) || engine.analyzeWord(clean);
      const familyId = analysis?.vowelFamily ? String(analysis.vowelFamily).toUpperCase() : null;
      if (familyId) {
        counts.set(familyId, (counts.get(familyId) || 0) + 1);
      }
    }
    const totalWords = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
    const fallbackColor = theme === "light" ? "#1a1a2e" : "#f8f9ff";
    const families = Array.from(counts.entries())
      .map(([id, count]) => {
        const schoolMeta = getSchoolMetaFromVowelFamily(engine, id);
        return {
          id,
          count,
          percentLabel: `${(totalWords > 0 ? (count / totalWords) * 100 : 0).toFixed(1)}%`,
          color: activeVowelColors[id] || fallbackColor,
          schoolName: schoolMeta.schoolName,
          schoolGlyph: schoolMeta.schoolGlyph,
        };
      })
      .sort((a, b) => b.count - a.count);
    return { families, totalWords, uniqueWords: uniqueWords.size };
  }, [isTruesight, analysisMode, truesightContent, engine, analyzedWords, theme, activeVowelColors]);

  useEffect(() => {
    if (isTruesight && truesightContent && engine && isReady) {
      const newEntries = [];
      const words = truesightContent.match(/[A-Za-z']+/g) || [];
      for (const word of words) {
        const clean = word.toUpperCase();
        if (clean && !analyzedWords.has(clean)) {
          const result = engine.analyzeWord(clean);
          if (result) newEntries.push([clean, { word: clean, ...result }]);
        }
      }
      if (newEntries.length > 0) {
        setAnalyzedWords((prev) => new Map([...prev, ...newEntries]));
      }
    }
  }, [isTruesight, truesightContent, engine, isReady, analyzedWords]);

  useEffect(() => {
    if (
      isTruesight &&
      truesightContent &&
      (analysisMode === ANALYSIS_MODES.RHYME || analysisMode === ANALYSIS_MODES.SCHEME)
    ) {
      analyzeDocument(truesightContent);
    }
  }, [isTruesight, analysisMode, truesightContent, analyzeDocument]);

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowViewport(window.innerWidth <= 960);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSaveScroll = useCallback(
    async (title, content) => {
      const isUpdate = Boolean(isEditing && activeScrollId);
      const savedScroll = await saveScroll({ id: isUpdate ? activeScrollId : undefined, title, content });
      if (!savedScroll) return;
      setActiveScrollId(savedScroll.id);
      setIsEditing(false);
      setIsEditable(false);
    },
    [isEditing, activeScrollId, saveScroll]
  );

  const handleSelectScroll = useCallback((id) => {
    setActiveScrollId(id);
    setIsEditing(false);
    setIsEditable(false);
    setHighlightedLines([]);
  }, []);

  const handleNewScroll = useCallback(() => {
    setActiveScrollId(null);
    setIsEditing(false);
    setIsEditable(true);
    setHighlightedLines([]);
  }, []);

  const handleEditScroll = useCallback(() => {
    setIsEditing(true);
    setIsEditable(true);
    setHighlightedLines([]);
  }, []);

  const handleCancelEdit = useCallback(() => {
    if (activeScrollId) {
      setIsEditing(false);
      setIsEditable(false);
    }
  }, [activeScrollId]);

  const handleToggleTruesight = useCallback(() => {
    setIsTruesight((prev) => !prev);
    setHighlightedLines([]);
  }, []);

  const handleModeChange = useCallback(
    (nextMode) => {
      setAnalysisMode((prev) => (prev === nextMode ? ANALYSIS_MODES.NONE : nextMode));
      if (!isTruesight) setIsTruesight(true);
      setHighlightedLines([]);
    },
    [isTruesight]
  );

  const handleToolbarSave = useCallback(() => {
    editorRef.current?.save?.();
  }, []);

  return (
    <div className="ide-layout-wrapper">
      <main className="ide-main-content">
        <PanelGroup direction={isNarrowViewport ? "vertical" : "horizontal"}>
          <Panel
            defaultSize={isNarrowViewport ? "28%" : "20%"}
            minSize={isNarrowViewport ? "20%" : "15%"}
            className="ide-sidebar"
          >
            {isTruesight && analysisMode === ANALYSIS_MODES.RHYME ? (
              <RhymeDiagramPanel
                connections={activeConnections}
                lineCount={lineCount}
                visible={true}
                onConnectionHover={setHighlightedLines}
                onConnectionLeave={() => setHighlightedLines([])}
              />
            ) : (
              <ScrollList
                scrolls={scrolls}
                activeScrollId={activeScrollId}
                onSelect={handleSelectScroll}
                onDelete={deleteScroll}
                onNewScroll={handleNewScroll}
              />
            )}
          </Panel>
          <PanelResizeHandle
            style={
              isNarrowViewport
                ? { height: "2px", background: "var(--border-color)" }
                : { width: "2px", background: "var(--border-color)" }
            }
          />
          <Panel minSize={isNarrowViewport ? "40%" : "30%"}>
            <div className="codex-workspace">
              <div className="document-toolbar">
                <TruesightControls
                  isTruesight={isTruesight}
                  onToggle={handleToggleTruesight}
                  analysisMode={analysisMode}
                  onModeChange={handleModeChange}
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
                <button
                  type="button"
                  className={`toolbar-btn ${showScorePanel ? 'toolbar-btn--active' : ''}`}
                  onClick={() => setShowScorePanel(!showScorePanel)}
                  title="Toggle CODEx Score Panel"
                >
                  <span aria-hidden="true">&#x1F4CA;</span> Score
                </button>
                {isEditable && (
                  <button
                    type="button"
                    className="toolbar-btn toolbar-btn--save"
                    onClick={handleToolbarSave}
                    disabled={!isReady}
                    title="Save current scroll (Ctrl+S)"
                  >
                    Save
                  </button>
                )}
                {!isEditable && activeScrollId && (
                  <button type="button" className="toolbar-btn" onClick={handleEditScroll}>
                    Edit
                  </button>
                )}
              </div>

              <div className="document-container">
                {activeScrollId || isEditable ? (
                  <ScrollEditor
                    ref={editorRef}
                    key={activeScrollId || "new"}
                    initialTitle={activeScroll?.title || ""}
                    initialContent={activeScroll?.content || ""}
                    onSave={handleSaveScroll}
                    onCancel={isEditing ? handleCancelEdit : undefined}
                    isEditable={isEditable}
                    disabled={!isReady}
                    isTruesight={isTruesight}
                    onContentChange={setEditorContent}
                    analyzedWords={analyzedWords}
                    activeConnections={activeConnections}
                    highlightedLines={highlightedLines}
                    vowelColors={activeVowelColors}
                    theme={theme}
                  />
                ) : (
                  <div className="scroll-placeholder">
                    <button type="button" className="btn btn-primary" onClick={handleNewScroll}>
                      Begin New Scroll
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </main>
      
      {isTruesight && analysisMode === ANALYSIS_MODES.VOWEL && (
        <FloatingPanel
          id="vowel-panel"
          title="Vowel Analysis"
          onClose={() => handleModeChange(ANALYSIS_MODES.NONE)}
          defaultX={window.innerWidth - 380}
          defaultY={120}
        >
          <VowelFamilyPanel
            families={vowelFamilyAnalytics.families}
            totalWords={vowelFamilyAnalytics.totalWords}
            uniqueWords={vowelFamilyAnalytics.uniqueWords}
            isEmbedded={true}
          />
        </FloatingPanel>
      )}

      {isTruesight && analysisMode === ANALYSIS_MODES.SCHEME && (
        <FloatingPanel
          id="scheme-panel"
          title="Rhyme Scheme"
          onClose={() => handleModeChange(ANALYSIS_MODES.NONE)}
          defaultX={window.innerWidth - 380}
          defaultY={120}
        >
          <RhymeSchemePanel
            scheme={schemeDetection}
            meter={meterDetection}
            statistics={deepAnalysis?.statistics}
            literaryDevices={literaryDevices}
            emotion={emotion}
            onGroupHover={highlightRhymeGroup}
            onGroupLeave={clearHighlight}
            isEmbedded={true}
          />
        </FloatingPanel>
      )}

      {showScorePanel && scoreData && (
        <FloatingPanel
          id="score-panel"
          title="CODEx Metrics"
          onClose={() => setShowScorePanel(false)}
          defaultX={window.innerWidth - 340}
          defaultY={80}
        >
          <HeuristicScorePanel
            scoreData={scoreData}
            visible={true}
            isEmbedded={true}
          />
        </FloatingPanel>
      )}
    </div>
  );
}
