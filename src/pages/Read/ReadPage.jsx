import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";

import { useTheme } from "../../hooks/useTheme.jsx";
import { useScrolls } from "../../hooks/useScrolls.jsx";
import { useProgression } from "../../hooks/useProgression.jsx";
import { usePanelAnalysis } from "../../hooks/usePanelAnalysis.js";
import { useWordLookup } from "../../hooks/useWordLookup.jsx";
import { usePredictor } from "../../hooks/usePredictor.js";
import { getVowelColorsForSchool } from "../../data/schoolPalettes.js";
import { SCHOOLS } from "../../data/schools.js";
import { normalizeVowelFamily } from "../../lib/vowelFamily.js";
import { buildColorMap } from "../../lib/colorCodex.js";

import RhymeSchemePanel from "../../components/RhymeSchemePanel.jsx";
import RhymeDiagramPanel from "../../components/RhymeDiagramPanel.jsx";
import HeuristicScorePanel from "../../components/HeuristicScorePanel.jsx";
import VowelFamilyPanel from "../../components/VowelFamilyPanel.jsx";
import WordTooltip from "../../components/WordTooltip.jsx";

import ScrollEditor from "./ScrollEditor.jsx";
import ScrollList from "./ScrollList.jsx";
import TruesightControls, { ANALYSIS_MODES } from "./TruesightControls.jsx";
import { TopBar, StatusBar } from "./IDEChrome.jsx";
import ToolsSidebar from "./ToolsSidebar.jsx";
import SearchPanel from "./SearchPanel.jsx";
import Minimap from "./Minimap.jsx";
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
  U: "VOID",
  AO: "VOID",
  AW: "VOID",
  OW: "VOID",
  AY: "ALCHEMY",
  EY: "ALCHEMY",
  OY: "ALCHEMY",
  EH: "WILL",
  ER: "WILL",
  UR: "WILL",
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
  const { addXP, progression } = useProgression();
  const [activeScrollId, setActiveScrollId] = useState(null);
  const [isEditable, setIsEditable] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTruesight, setIsTruesight] = useState(false);
  const [isPredictive, setIsPredictive] = useState(false);
  const [analysisMode, setAnalysisMode] = useState(ANALYSIS_MODES.VOWEL);
  const [editorContent, setEditorContent] = useState("");
  const [highlightedLines, setHighlightedLines] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState("DEFAULT");
  const [showScorePanel, setShowScorePanel] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 960;
  });
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [sidebarTab, setSidebarTab] = useState("FILES"); // FILES, SEARCH, TOOLS
  const [showMinimap, setShowMinimap] = useState(false);
  const [minimapScrollTop, setMinimapScrollTop] = useState(0);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const schoolList = useMemo(
    () => [
      { id: "DEFAULT", name: "Truesight", glyph: String(SCHOOL_GLYPHS.DEFAULT || "") },
      ...["SONIC", "PSYCHIC", "VOID", "ALCHEMY", "WILL"].map((id) => {
        const school = SCHOOLS[id];
        return {
          id: String(id),
          name: String(school?.name || id),
          glyph: String(SCHOOL_GLYPHS[id] || school?.glyph || "\u2736"),
        };
      }),
    ],
    []
  );

  const {
    analysis: deepAnalysis,
    schemeDetection,
    meterDetection,
    genreProfile,
    scoreData,
    vowelSummary,
    isAnalyzing,
    analyzeDocument,
    activeConnections,
    highlightRhymeGroup,
    clearHighlight,
    literaryDevices,
    emotion,
    error: analysisError,
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
  const activeScrollContent = String(activeScroll?.content || "");
  const truesightContent = isEditable ? editorContent : activeScrollContent;

  const lineCount = useMemo(() => {
    return truesightContent.split("\n").length;
  }, [truesightContent]);

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

  const colorMap = useMemo(() => {
    if (!deepAnalysis?.wordAnalyses || !deepAnalysis?.allConnections) return null;
    return buildColorMap(
      deepAnalysis.wordAnalyses,
      deepAnalysis.allConnections,
      activeVowelColors,
      { theme }
    );
  }, [deepAnalysis, activeVowelColors, theme]);

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

  const overlayConnections = useMemo(() => {
    if (!isTruesight) {
      return [];
    }
    return Array.isArray(activeConnections) ? activeConnections : [];
  }, [isTruesight, activeConnections]);

  useEffect(() => {
    if (truesightContent && (isTruesight || showScorePanel)) {
      // Only re-analyze if content has actually changed from what we last analyzed
      analyzeDocument(truesightContent);
    } else if (!isTruesight && !showScorePanel) {
      // If nothing needs analysis, we could potentially clear it or just let it stay
      // but let's not call analyzeDocument unnecessarily.
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
      setSaveStatus("Saving...");
      const isUpdate = Boolean(isEditing && activeScrollId);
      const savedScroll = await saveScroll({ id: isUpdate ? activeScrollId : undefined, title, content });
      if (!savedScroll) {
        setSaveStatus("Error");
        addToast("Failed to save scroll", "error");
        return;
      }
      
      // Award XP only for new scrolls
      if (!isUpdate) {
        // Use the total score from the scoring engine for exponential scaling
        const totalPower = scoreData?.totalScore || 0;
        
        // XP curve: (Power ^ 1.6)
        // If power is 100, XP is 1584. If power is 50, XP is 527.
        // We add a small base to ensure even very simple scrolls give something.
        const baseXP = 25;
        const powerXP = Math.round(Math.pow(totalPower, 1.6));
        const xpAwarded = baseXP + powerXP;
        
        const source = totalPower > 70 ? "legendary_submission" : 
                      totalPower > 40 ? "expert_submission" : "basic_submission";

        addXP(xpAwarded, source, savedScroll.id);
        addToast(`Scroll Saved! +${xpAwarded} XP`, "success");
      } else {
        addToast("Scroll Updated!", "success");
      }

      setSaveStatus("Saved");
      setActiveScrollId(savedScroll.id);
      setEditorContent(String(savedScroll.content || content || ""));
      setIsEditing(false);
      setIsEditable(false);
    },
    [isEditing, activeScrollId, saveScroll, addXP, addToast, deepAnalysis, schemeDetection, selectedSchool, scoreData]
  );

  const handleSelectScroll = useCallback((id) => {
    const selected = getScrollById(id);
    setActiveScrollId(id);
    setEditorContent(String(selected?.content || ""));
    setIsEditing(false);
    setIsEditable(false);
    setHighlightedLines([]);
    setSaveStatus("Saved");
  }, [getScrollById]);

  const handleNewScroll = useCallback(() => {
    setActiveScrollId(null);
    setEditorContent("");
    setIsEditing(false);
    setIsEditable(true);
    setHighlightedLines([]);
    setSaveStatus("Unsaved");
  }, []);

  const handleEditScroll = useCallback(() => {
    setEditorContent(activeScrollContent);
    setIsEditing(true);
    setIsEditable(true);
    setHighlightedLines([]);
  }, [activeScrollContent]);

  const handleCancelEdit = useCallback(() => {
    if (activeScrollId) {
      setEditorContent(activeScrollContent);
      setIsEditing(false);
      setIsEditable(false);
    }
  }, [activeScrollId, activeScrollContent]);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSidebarTab('SEARCH');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        // Toggle sidebar visibility could go here, but for now let's switch tabs
        setSidebarTab(prev => prev === 'FILES' ? 'TOOLS' : 'FILES');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      // Block reopening if already pinned for this specific word instance
      if (tooltipState.pinned &&
        tooltipState.token?.charStart === activation.charStart &&
        tooltipState.token?.lineIndex === activation.lineIndex) {
        return;
      }

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
  }, [buildTooltipAnalysis, isTruesight, lookup, resetWordLookup, resolveTooltipPosition, tooltipState.pinned, tooltipState.token?.charStart, tooltipState.token?.lineIndex]);

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

  const totalSyllables = useMemo(() => {
    const counts = deepAnalysis?.lineSyllableCounts;
    if (!Array.isArray(counts)) return 0;
    return counts.reduce((a, b) => a + (Number(b) || 0), 0);
  }, [deepAnalysis]);

  const { predict, getCompletions, checkSpelling, getSpellingSuggestions, isReady: predictorReady } = usePredictor();
  const [misspellings, setMisspellings] = useState([]);

  // Document-wide spellcheck (debounced via editorContent)
  useEffect(() => {
    if (!isPredictive || !predictorReady || !editorContent) {
      setMisspellings([]);
      return;
    }
    const allWords = editorContent.match(/\b(\w+)\b/g) || [];
    const uniqueWords = [...new Set(allWords)];
    const errors = uniqueWords
      .filter(w => w.length > 2 && !checkSpelling(w))
      .map(w => {
        const index = allWords.indexOf(w);
        const prevWord = index > 0 ? allWords[index - 1] : null;
        return { word: w, suggestions: getSpellingSuggestions(w, prevWord, 3) };
      });
    setMisspellings(errors);
  }, [editorContent, isPredictive, predictorReady, checkSpelling, getSpellingSuggestions]);

  return (
    <div className="ide-layout-wrapper">
      <TopBar 
        title={activeScroll?.title || (isEditable ? "New Scroll" : "Scholomance IDE")} 
        onOpenSearch={() => setSidebarTab('SEARCH')}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
        isEditable={isEditable}
        activeScrollId={activeScrollId}
        onEdit={handleEditScroll}
        progression={progression}
      />
      <main className="ide-main-content">
        <PanelGroup direction={isNarrowViewport ? "vertical" : "horizontal"}>
          <Panel
            defaultSize={isNarrowViewport ? "28%" : "20%"}
            minSize={isNarrowViewport ? "20%" : "15%"}
            className="ide-sidebar"
          >
            <div className="sidebar-tabs">
              <button 
                className={`sidebar-tab ${sidebarTab === 'FILES' ? 'active' : ''}`}
                onClick={() => setSidebarTab('FILES')}
                title="Files"
              >
                📁
              </button>
              <button 
                className={`sidebar-tab ${sidebarTab === 'SEARCH' ? 'active' : ''}`}
                onClick={() => setSidebarTab('SEARCH')}
                title="Search"
              >
                🔍
              </button>
              <button 
                className={`sidebar-tab ${sidebarTab === 'TOOLS' ? 'active' : ''}`}
                onClick={() => setSidebarTab('TOOLS')}
                title="Tools"
              >
                🛠️
              </button>
            </div>
            <div className="sidebar-content">
              {sidebarTab === 'FILES' && (
                <ScrollList
                  scrolls={scrolls}
                  activeScrollId={activeScrollId}
                  onSelect={handleSelectScroll}
                  onDelete={deleteScroll}
                  onNewScroll={handleNewScroll}
                />
              )}
              {sidebarTab === 'SEARCH' && (
                <SearchPanel 
                  content={editorContent} 
                  onJumpToLine={(line) => {
                    editorRef.current?.jumpToLine?.(line);
                  }}
                />
              )}
              {sidebarTab === 'TOOLS' && (
                <div className="sidebar-tools">
                  <ToolsSidebar 
                    isTruesight={isTruesight}
                    onToggleTruesight={handleToggleTruesight}
                    isPredictive={isPredictive}
                    onTogglePredictive={() => setIsPredictive(prev => !prev)}
                    analysisMode={analysisMode}
                    onModeChange={handleModeChange}
                    isAnalyzing={isAnalyzing}
                    showScorePanel={showScorePanel}
                    onToggleScorePanel={() => setShowScorePanel(!showScorePanel)}
                    selectedSchool={selectedSchool}
                    onSchoolChange={setSelectedSchool}
                    schoolList={schoolList}
                  />
                  {analysisMode === ANALYSIS_MODES.RHYME && (
                    <div className="sidebar-sub-panel">
                      <RhymeDiagramPanel
                        connections={overlayConnections}
                        lineCount={lineCount}
                        visible={true}
                        onConnectionHover={setHighlightedLines}
                        onConnectionLeave={() => setHighlightedLines([])}
                        onConnectionClick={(lines) => {
                          if (lines && lines.length > 0) {
                            editorRef.current?.jumpToLine?.(lines[0] + 1);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
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
                    isPredictive={isPredictive}
                    predict={predict}
                    getCompletions={getCompletions}
                    checkSpelling={checkSpelling}
                    getSpellingSuggestions={getSpellingSuggestions}
                    predictorReady={predictorReady}
                    onContentChange={(content) => {
                      setEditorContent(content);
                      setSaveStatus("Unsaved");
                    }}
                    analyzedWords={analyzedWords}
                    analyzedWordsByIdentity={analyzedWordsByIdentity}
                    analyzedWordsByCharStart={analyzedWordsByCharStart}
                    activeConnections={overlayConnections}
                    lineSyllableCounts={deepAnalysis?.lineSyllableCounts || []}
                    highlightedLines={highlightedLines}
                    vowelColors={activeVowelColors}
                    colorMap={colorMap}
                    syntaxLayer={deepAnalysis?.syntaxLayer}
                    analysisMode={analysisMode}
                    theme={theme}
                    onWordActivate={handleWordActivate}
                    onCursorChange={setCursorPos}
                    onScrollChange={setMinimapScrollTop}
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

      <StatusBar
        line={cursorPos.line}
        col={cursorPos.col}
        language="Scroll Language"
        syllableCount={totalSyllables}
        analysisError={analysisError}
      />
      
      {showMinimap && (
        <FloatingPanel
          id="minimap-panel"
          title="Minimap"
          onClose={() => setShowMinimap(false)}
          defaultX={window.innerWidth - 180}
          defaultY={window.innerHeight - 350}
          defaultWidth={150}
          defaultHeight={300}
          minWidth={80}
          minHeight={100}
          zIndex={200}
          className="minimap-floating-panel"
        >
          <Minimap 
            content={editorContent}
            scrollTop={minimapScrollTop}
            viewportHeight={editorRef.current?.clientHeight || 0}
            totalHeight={editorRef.current?.scrollHeight || 1}
            onScrollTo={(y) => {
              if (editorRef.current?.scrollTo) {
                editorRef.current.scrollTo(y);
              }
            }}
          />
        </FloatingPanel>
      )}

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
            genreProfile={genreProfile}
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

      {isPredictive && misspellings.length > 0 && (
        <FloatingPanel
          id="spellcheck-panel"
          title="Spellcheck"
          onClose={() => setIsPredictive(false)}
          defaultX={window.innerWidth - 300}
          defaultY={window.innerHeight - 300}
          className="spellcheck-panel"
        >
          <div className="misspellings-list">
            {misspellings.map((err, i) => (
              <div key={i} className="misspelling-item">
                <span className="error-word">{err.word}</span>
                <div className="error-suggestions">
                  {err.suggestions.map((s, j) => (
                    <button
                      key={j}
                      className="btn-tiny"
                      onClick={() => {
                        const newContent = editorContent.replace(new RegExp(`\\b${err.word}\\b`, 'g'), s);
                        editorRef.current?.replaceContent?.(newContent);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FloatingPanel>
      )}

      <div className="toast-container">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className={`toast-item toast-item--${toast.type}`}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
