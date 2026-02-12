import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";

import { useTheme } from "../../hooks/useTheme.jsx";
import { useScrolls } from "../../hooks/useScrolls.jsx";
import { usePanelAnalysis } from "../../hooks/usePanelAnalysis.js";
import { useWordLookup } from "../../hooks/useWordLookup.jsx";
import { getVowelColorsForSchool } from "../../data/schoolPalettes.js";
import { SCHOOLS } from "../../data/schools.js";
import { normalizeVowelFamily } from "../../lib/vowelFamily.js";

import RhymeSchemePanel from "../../components/RhymeSchemePanel.jsx";
import RhymeDiagramPanel from "../../components/RhymeDiagramPanel.jsx";
import HeuristicScorePanel from "../../components/HeuristicScorePanel.jsx";
import VowelFamilyPanel from "../../components/VowelFamilyPanel.jsx";
import WordTooltip from "../../components/WordTooltip.jsx";

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
const VOWEL_FAMILY_TO_SCHOOL = Object.freeze({
  A: "SONIC",
  AA: "SONIC",
  AE: "SONIC",
  AH: "SONIC",
  AO: "VOID",
  AW: "VOID",
  OW: "VOID",
  UW: "VOID",
  AY: "ALCHEMY",
  EY: "ALCHEMY",
  OY: "ALCHEMY",
  EH: "WILL",
  ER: "WILL",
  UH: "WILL",
  IH: "PSYCHIC",
  IY: "PSYCHIC",
});
const TRUE_VALUES = new Set(["1", "true", "on", "yes"]);
const FALSE_VALUES = new Set(["0", "false", "off", "no"]);
const TOOLTIP_WIDTH = 390;
const TOOLTIP_HEIGHT = 510;
const TOOLTIP_MARGIN = 12;
const TOOLTIP_OFFSET_X = 14;
const TOOLTIP_OFFSET_Y = -8;

const ENABLE_SYNTAX_RHYME_LAYER = parseBooleanFlag(
  import.meta.env.VITE_ENABLE_SYNTAX_RHYME_LAYER,
  false
);

function parseBooleanFlag(rawValue, defaultValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return defaultValue;
  }
  const normalized = String(rawValue).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return defaultValue;
}

function clampTooltipPosition(position) {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const maxX = Math.max(TOOLTIP_MARGIN, viewportWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN);
  const maxY = Math.max(TOOLTIP_MARGIN, viewportHeight - TOOLTIP_HEIGHT - TOOLTIP_MARGIN);
  return {
    x: Math.min(Math.max(TOOLTIP_MARGIN, Number(position?.x) || TOOLTIP_MARGIN), maxX),
    y: Math.min(Math.max(TOOLTIP_MARGIN, Number(position?.y) || TOOLTIP_MARGIN), maxY),
  };
}

function getSchoolMetaFromVowelFamily(familyId) {
  const normalizedFamily = normalizeVowelFamily(familyId);
  const schoolId = VOWEL_FAMILY_TO_SCHOOL[normalizedFamily] || null;
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
  const { scrolls, saveScroll, deleteScroll, getScrollById } = useScrolls();
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
    scoreData,
    vowelSummary,
    isAnalyzing,
    analyzeDocument,
    activeConnections,
    highlightRhymeGroup,
    clearHighlight,
    literaryDevices,
    emotion,
  } = usePanelAnalysis();
  const {
    lookup,
    data: lookupData,
    isLoading: isLookupLoading,
    error: lookupError,
    reset: resetWordLookup,
  } = useWordLookup();

  const editorRef = useRef(null);
  const focusReturnRef = useRef(null);
  const [tooltipState, setTooltipState] = useState({
    visible: false,
    pinned: false,
    token: null,
    position: { x: TOOLTIP_MARGIN, y: TOOLTIP_MARGIN },
    localAnalysis: null,
  });
  const activeScroll = activeScrollId ? getScrollById(activeScrollId) : null;

  const lineCount = useMemo(() => {
    return (editorContent || activeScroll?.content || "").split("\n").length;
  }, [editorContent, activeScroll?.content]);

  const truesightContent = editorContent || activeScroll?.content;
  const activeVowelColors = useMemo(
    () => getVowelColorsForSchool(selectedSchool, theme),
    [selectedSchool, theme]
  );
  const analyzedWords = useMemo(() => {
    const map = new Map();
    const wordProfiles = Array.isArray(deepAnalysis?.wordAnalyses) ? deepAnalysis.wordAnalyses : [];
    for (const profile of wordProfiles) {
      const normalized = String(profile?.normalizedWord || "").toUpperCase();
      if (!normalized || map.has(normalized)) continue;
      map.set(normalized, {
        word: String(profile?.word || ""),
        normalizedWord: normalized,
        lineIndex: Number.isInteger(profile?.lineIndex) ? profile.lineIndex : -1,
        wordIndex: Number.isInteger(profile?.wordIndex) ? profile.wordIndex : -1,
        charStart: Number.isInteger(profile?.charStart) ? profile.charStart : -1,
        charEnd: Number.isInteger(profile?.charEnd) ? profile.charEnd : -1,
        vowelFamily: normalizeVowelFamily(profile?.vowelFamily) || null,
        syllableCount: Number(profile?.syllableCount) || 0,
        rhymeKey: profile?.rhymeKey || null,
      });
    }
    return map;
  }, [deepAnalysis]);
  const analyzedWordsByIdentity = useMemo(() => {
    const map = new Map();
    const wordProfiles = Array.isArray(deepAnalysis?.wordAnalyses) ? deepAnalysis.wordAnalyses : [];
    for (const profile of wordProfiles) {
      const lineIndex = Number(profile?.lineIndex);
      const wordIndex = Number(profile?.wordIndex);
      const charStart = Number(profile?.charStart);
      if (!Number.isInteger(lineIndex) || !Number.isInteger(wordIndex) || !Number.isInteger(charStart) || charStart < 0) {
        continue;
      }
      map.set(`${lineIndex}:${wordIndex}:${charStart}`, {
        word: String(profile?.word || ""),
        normalizedWord: String(profile?.normalizedWord || "").toUpperCase(),
        lineIndex,
        wordIndex,
        charStart,
        charEnd: Number.isInteger(profile?.charEnd) ? profile.charEnd : -1,
        vowelFamily: normalizeVowelFamily(profile?.vowelFamily) || null,
        syllableCount: Number(profile?.syllableCount) || 0,
        rhymeKey: profile?.rhymeKey || null,
      });
    }
    return map;
  }, [deepAnalysis]);
  const analyzedWordsByCharStart = useMemo(() => {
    const map = new Map();
    const wordProfiles = Array.isArray(deepAnalysis?.wordAnalyses) ? deepAnalysis.wordAnalyses : [];
    for (const profile of wordProfiles) {
      const charStart = Number(profile?.charStart);
      if (!Number.isInteger(charStart) || charStart < 0) continue;
      map.set(charStart, {
        word: String(profile?.word || ""),
        normalizedWord: String(profile?.normalizedWord || "").toUpperCase(),
        lineIndex: Number.isInteger(profile?.lineIndex) ? profile.lineIndex : -1,
        wordIndex: Number.isInteger(profile?.wordIndex) ? profile.wordIndex : -1,
        charStart,
        charEnd: Number.isInteger(profile?.charEnd) ? profile.charEnd : -1,
        vowelFamily: normalizeVowelFamily(profile?.vowelFamily) || null,
        syllableCount: Number(profile?.syllableCount) || 0,
        rhymeKey: profile?.rhymeKey || null,
      });
    }
    return map;
  }, [deepAnalysis]);

  const vowelFamilyAnalytics = useMemo(() => {
    if (!isTruesight || analysisMode !== ANALYSIS_MODES.VOWEL) {
      return { families: [], totalWords: 0, uniqueWords: 0 };
    }
    if (!vowelSummary || !Array.isArray(vowelSummary.families)) {
      return { families: [], totalWords: 0, uniqueWords: 0 };
    }
    const totalWords = Number(vowelSummary.totalWords) || 0;
    const fallbackColor = theme === "light" ? "#1a1a2e" : "#f8f9ff";
    const families = vowelSummary.families
      .map((family) => {
        const id = String(family?.id || "").toUpperCase();
        const count = Number(family?.count) || 0;
        if (!id || count <= 0) return null;
        const schoolMeta = getSchoolMetaFromVowelFamily(id);
        return {
          id,
          count,
          percentLabel: `${(totalWords > 0 ? (count / totalWords) * 100 : 0).toFixed(1)}%`,
          color: activeVowelColors[id] || fallbackColor,
          schoolName: schoolMeta.schoolName,
          schoolGlyph: schoolMeta.schoolGlyph,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count);
    return {
      families,
      totalWords,
      uniqueWords: Number(vowelSummary.uniqueWords) || 0,
    };
  }, [isTruesight, analysisMode, vowelSummary, theme, activeVowelColors]);

  useEffect(() => {
    if (truesightContent && (isTruesight || showScorePanel)) {
      analyzeDocument(truesightContent);
    }
  }, [isTruesight, showScorePanel, truesightContent, analyzeDocument]);

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

  const resolveTooltipPosition = useCallback((activation) => {
    const rect = activation?.anchorRect;
    const x = rect?.right
      ? rect.right + TOOLTIP_OFFSET_X
      : (Number.isFinite(activation?.clientX) ? activation.clientX + TOOLTIP_OFFSET_X : TOOLTIP_MARGIN);
    const y = rect?.top
      ? rect.top + TOOLTIP_OFFSET_Y
      : (Number.isFinite(activation?.clientY) ? activation.clientY + TOOLTIP_OFFSET_Y : TOOLTIP_MARGIN);
    return clampTooltipPosition({ x, y });
  }, []);

  const buildTooltipAnalysis = useCallback((activation) => {
    const normalizedWord = String(activation?.normalizedWord || "").toUpperCase();
    const localWordAnalysis = analyzedWordsByCharStart.get(activation?.charStart) || analyzedWords.get(normalizedWord) || null;
    const fallbackVowelFamily = normalizeVowelFamily(
      activation?.vowelFamily || localWordAnalysis?.vowelFamily
    );
    const schoolMeta = getSchoolMetaFromVowelFamily(fallbackVowelFamily);

    const allConnections = Array.isArray(deepAnalysis?.allConnections) ? deepAnalysis.allConnections : [];
    const tokenLinks = allConnections
      .filter((connection) => {
        const matchesA = connection?.wordA?.lineIndex === activation?.lineIndex &&
          connection?.wordA?.charStart === activation?.charStart;
        const matchesB = connection?.wordB?.lineIndex === activation?.lineIndex &&
          connection?.wordB?.charStart === activation?.charStart;
        return matchesA || matchesB;
      })
      .map((connection) => {
        const matchesA = connection?.wordA?.lineIndex === activation?.lineIndex &&
          connection?.wordA?.charStart === activation?.charStart;
        const opposite = matchesA ? connection?.wordB : connection?.wordA;
        return {
          type: connection?.type || "near",
          score: Number(connection?.score) || 0,
          groupLabel: connection?.groupLabel || null,
          linkedWord: opposite?.word || "",
          gate: ENABLE_SYNTAX_RHYME_LAYER ? (connection?.syntax?.gate || null) : null,
          reasons: ENABLE_SYNTAX_RHYME_LAYER && Array.isArray(connection?.syntax?.reasons)
            ? connection.syntax.reasons
            : [],
        };
      });

    const syntaxSummary = deepAnalysis?.syntaxSummary;
    const syntaxIdentity = `${activation?.lineIndex}:${activation?.wordIndex}:${activation?.charStart}`;
    const syntaxToken = ENABLE_SYNTAX_RHYME_LAYER
      ? (
        syntaxSummary?.tokenByIdentity?.get?.(syntaxIdentity) ||
        syntaxSummary?.tokenByCharStart?.get?.(activation?.charStart) ||
        null
      )
      : null;

    return {
      core: {
        vowelFamily: fallbackVowelFamily || null,
        schoolName: schoolMeta.schoolName,
        schoolGlyph: schoolMeta.schoolGlyph,
        skin: selectedSchool,
        syllableCount: Number(localWordAnalysis?.syllableCount) || null,
        rhymeKey: localWordAnalysis?.rhymeKey || null,
      },
      rhyme: {
        links: tokenLinks,
        gateReasons: Array.from(new Set(tokenLinks.flatMap((link) => link.reasons))).slice(0, 6),
      },
      syntax: syntaxToken
        ? {
          role: syntaxToken.role,
          lineRole: syntaxToken.lineRole,
          stressRole: syntaxToken.stressRole,
          rhymePolicy: syntaxToken.rhymePolicy,
          reasons: Array.isArray(syntaxToken.reasons) ? syntaxToken.reasons : [],
        }
        : null,
    };
  }, [analyzedWords, analyzedWordsByCharStart, deepAnalysis, selectedSchool]);

  const handleCloseTooltip = useCallback(() => {
    setTooltipState((prev) => ({
      ...prev,
      visible: false,
      pinned: false,
      token: null,
      localAnalysis: null,
    }));
    resetWordLookup();
    if (focusReturnRef.current && typeof focusReturnRef.current.focus === "function") {
      focusReturnRef.current.focus();
    }
    focusReturnRef.current = null;
  }, [resetWordLookup]);

  const handleTooltipDrag = useCallback((position) => {
    setTooltipState((prev) => ({
      ...prev,
      position: clampTooltipPosition(position),
    }));
  }, []);

  const handleWordActivate = useCallback((activation) => {
    if (!activation || !activation.normalizedWord || !isTruesight) {
      return;
    }

    if (activation.trigger === "leave") {
      setTooltipState((prev) => {
        if (prev.pinned) return prev;
        return {
          ...prev,
          visible: false,
          token: null,
          localAnalysis: null,
        };
      });
      return;
    }

    const position = resolveTooltipPosition(activation);
    const localAnalysis = buildTooltipAnalysis(activation);

    if (activation.trigger === "hover") {
      setTooltipState((prev) => {
        if (prev.pinned) return prev;
        return {
          ...prev,
          visible: true,
          pinned: false,
          token: activation,
          position,
          localAnalysis,
        };
      });
      return;
    }

    if (activation.trigger === "pin") {
      if (typeof document !== "undefined" && document.activeElement) {
        focusReturnRef.current = document.activeElement;
      }
      setTooltipState((prev) => ({
        ...prev,
        visible: true,
        pinned: true,
        token: activation,
        position,
        localAnalysis,
      }));
      resetWordLookup();
      lookup(activation.normalizedWord);
    }
  }, [buildTooltipAnalysis, isTruesight, lookup, resetWordLookup, resolveTooltipPosition]);

  useEffect(() => {
    if (!isTruesight) {
      setTooltipState((prev) => ({
        ...prev,
        visible: false,
        pinned: false,
        token: null,
        localAnalysis: null,
      }));
      resetWordLookup();
    }
  }, [isTruesight, resetWordLookup]);

  const tooltipWordData = useMemo(() => {
    if (!tooltipState.visible || !tooltipState.token) return null;

    const baseWordData = {
      word: tooltipState.token.word,
      vowelFamily: tooltipState.localAnalysis?.core?.vowelFamily || null,
      rhymeKey: tooltipState.localAnalysis?.core?.rhymeKey || null,
      syllableCount: tooltipState.localAnalysis?.core?.syllableCount || undefined,
    };

    if (!tooltipState.pinned || !lookupData) {
      return baseWordData;
    }

    const selectedWord = String(tooltipState.token.normalizedWord || "").toUpperCase();
    const lookupWord = String(lookupData.word || "").toUpperCase();
    if (lookupWord && lookupWord !== selectedWord) {
      return baseWordData;
    }

    return {
      ...baseWordData,
      ...lookupData,
      word: lookupData.word || baseWordData.word,
      vowelFamily: lookupData.vowelFamily || baseWordData.vowelFamily,
      rhymeKey: lookupData.rhymeKey || baseWordData.rhymeKey,
      syllableCount: lookupData.syllableCount || baseWordData.syllableCount,
    };
  }, [lookupData, tooltipState]);

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
                  disabled={false}
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
                    disabled={false}
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
                    disabled={false}
                    isTruesight={isTruesight}
                    onContentChange={setEditorContent}
                    analyzedWords={analyzedWords}
                    analyzedWordsByIdentity={analyzedWordsByIdentity}
                    analyzedWordsByCharStart={analyzedWordsByCharStart}
                    activeConnections={activeConnections}
                    lineSyllableCounts={deepAnalysis?.lineSyllableCounts || []}
                    highlightedLines={highlightedLines}
                    vowelColors={activeVowelColors}
                    theme={theme}
                    onWordActivate={handleWordActivate}
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

      {isTruesight && tooltipState.visible && tooltipState.token && (
        <WordTooltip
          wordData={tooltipWordData}
          analysis={tooltipState.localAnalysis}
          isLoading={tooltipState.pinned && isLookupLoading}
          error={tooltipState.pinned ? lookupError : null}
          x={tooltipState.position.x}
          y={tooltipState.position.y}
          onDrag={handleTooltipDrag}
          onClose={handleCloseTooltip}
        />
      )}
    </div>
  );
}
