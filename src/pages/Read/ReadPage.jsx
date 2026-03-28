import {
  FolderIcon,
  SearchIcon,
  ToolsIcon,
  BookIcon,
  SettingsIcon
} from "../../components/Icons.jsx";
import { useUserSettings } from "../../hooks/useUserSettings.js";
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
import { SCHOOLS, VOWEL_FAMILY_TO_SCHOOL } from "../../data/schools.js";
import { normalizeVowelFamily } from "../../lib/phonology/vowelFamily.js";
import { buildColorMap } from "../../lib/colorCodex.js";
import { parseBooleanEnvFlag } from "../../hooks/useCODExPipeline.jsx";
import { patternColor } from "../../lib/patternColor.js";
import { getCachedWord, setCachedWord, pruneOldCaches } from "../../lib/platform/wordCache.js";
import { useAuroraLevel, cycleAuroraLevel } from "../../hooks/useAtmosphere.js";

import AnalysisPanel from "./AnalysisPanel.jsx";
import InfoBeamPanel from "../../components/InfoBeamPanel.jsx";
import RhymeDiagramPanel from "../../components/RhymeDiagramPanel.jsx";
import HeuristicScorePanel from "../../components/HeuristicScorePanel.jsx";
import WordTooltip from "../../components/WordTooltip.jsx";
import VowelFamilyPanel from "../../components/VowelFamilyPanel.jsx";

import ScrollEditor from "./ScrollEditor.jsx";
import ScrollList from "./ScrollList.jsx";
import { ANALYSIS_MODES } from "./TruesightControls.jsx";
import { TopBar, StatusBar } from "./IDEChrome.jsx";
import ToolsSidebar from "./ToolsSidebar.jsx";
import SearchPanel from "./SearchPanel.jsx";
import Minimap from "./Minimap.jsx";
import FloatingPanel from "../../components/shared/FloatingPanel.jsx";
import "./IDE.css";

const SCHOOL_GLYPHS = {
  DEFAULT:    "\uD83C\uDF08",
  SONIC:      "\u266A",
  PSYCHIC:    "\u25EC",
  VOID:       "\u2205",
  ALCHEMY:    "\u2697",
  WILL:       "\u26A1",
  DIVINATION: "\u25C9",
  NECROMANCY: "\u263D",
  ABJURATION: "\u2B21",
};
const TOOLTIP_WIDTH = 390;
const TOOLTIP_HEIGHT = 510;
const TOOLTIP_MARGIN = 12;
const TOOLTIP_OFFSET_X = 14;
const TOOLTIP_OFFSET_Y = -8;

const ENABLE_SYNTAX_RHYME_LAYER = parseBooleanEnvFlag(
  import.meta.env.VITE_ENABLE_SYNTAX_RHYME_LAYER,
  false
);

function clampTooltipPosition(position) {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const minX = Math.min(TOOLTIP_MARGIN, viewportWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN);
  const minY = Math.min(TOOLTIP_MARGIN, viewportHeight - TOOLTIP_HEIGHT - TOOLTIP_MARGIN);
  const maxX = Math.max(TOOLTIP_MARGIN, viewportWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN);
  const maxY = Math.max(TOOLTIP_MARGIN, viewportHeight - TOOLTIP_HEIGHT - TOOLTIP_MARGIN);
  const rawX = Number(position?.x);
  const rawY = Number(position?.y);
  const safeX = Number.isFinite(rawX) ? rawX : TOOLTIP_MARGIN;
  const safeY = Number.isFinite(rawY) ? rawY : TOOLTIP_MARGIN;
  return {
    x: Math.min(Math.max(minX, safeX), maxX),
    y: Math.min(Math.max(minY, safeY), maxY),
  };
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyMatchCase(sourceWord, replacement) {
  const source = String(sourceWord || "");
  const nextWord = String(replacement || "");
  if (!source || !nextWord) return nextWord;

  if (source === source.toUpperCase()) {
    return nextWord.toUpperCase();
  }

  const first = source.charAt(0);
  const rest = source.slice(1);
  if (first === first.toUpperCase() && rest === rest.toLowerCase()) {
    return `${nextWord.charAt(0).toUpperCase()}${nextWord.slice(1)}`;
  }

  return nextWord;
}


export default function ReadPage() {
  const { theme } = useTheme();
  const { settings, updateSettings } = useUserSettings();
  const auroraLevel = useAuroraLevel();
  const { scrolls, saveScroll, deleteScroll, getScrollById } = useScrolls();
  const { addXP, progression } = useProgression();
  const [activeScrollId, setActiveScrollId] = useState(null);
  const [isEditable, setIsEditable] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Use settings for initial state if available
  const [isTruesight, setIsTruesight] = useState(settings?.truesightEnabled ?? false);
  const [isPredictive, setIsPredictive] = useState(settings?.predictiveEnabled ?? false);
  const [analysisMode, setAnalysisMode] = useState(settings?.analysisMode ?? ANALYSIS_MODES.NONE);

  const handleToggleTruesight = useCallback(() => {
    setIsTruesight(prev => {
      const next = !prev;
      updateSettings({ truesightEnabled: next });
      return next;
    });
  }, [updateSettings]);

  const handleTogglePredictive = useCallback(() => {
    setIsPredictive(prev => {
      const next = !prev;
      updateSettings({ predictiveEnabled: next });
      return next;
    });
  }, [updateSettings]);

  const handleModeChange = useCallback((mode) => {
    setAnalysisMode(mode);
    updateSettings({ analysisMode: mode });
  }, [updateSettings]);

  const handleLayoutChange = useCallback((sizes) => {
    updateSettings({ ideLayout: sizes });
  }, [updateSettings]);
  const [editorContent, setEditorContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [highlightedLines, setHighlightedLines] = useState([]);
  const [pinnedLines, setPinnedLines] = useState(null);
  const effectiveHighlightedLines = pinnedLines ?? highlightedLines;
  const [selectedSchool, setSelectedSchool] = useState("DEFAULT");
  const [showScorePanel, setShowScorePanel] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 960;
  });
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 640;
  });
  const [mobileActiveTab, setMobileActiveTab] = useState("EDITOR"); // EDITOR, FILES, TOOLS, SCORE
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [, setSaveStatus] = useState("Saved");
  const [sidebarTab, setSidebarTab] = useState("FILES"); // FILES, SEARCH, TOOLS
  const [showMinimap, setShowMinimap] = useState(false);
  const [minimapScrollTop, setMinimapScrollTop] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [infoBeamEnabled, setInfoBeamEnabled] = useState(false);
  const [infoBeamFamily, setInfoBeamFamily] = useState(null);
  const [isEditorIdle, setIsEditorIdle] = useState(true);

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
      ...["SONIC", "PSYCHIC", "VOID", "ALCHEMY", "WILL", "DIVINATION", "NECROMANCY", "ABJURATION"].map((id) => {
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
    rhymeAstrology,
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

  // Session history: words explicitly pinned via Truesight (not suggestion navigations)
  const [sessionWords, setSessionWords] = useState([]);
  const [sessionIndex, setSessionIndex] = useState(-1);
  // lookupOverride: inject cached word data without going through the hook
  const [lookupOverride, setLookupOverride] = useState(null);

  const editorRef = useRef(null);
  const focusReturnRef = useRef(null);
  const tooltipCloseGuardRef = useRef({
    expiresAt: 0,
    lineIndex: null,
    charStart: null,
  });
  const autosaveInFlightRef = useRef(false);
  const queuedAutosaveRef = useRef(null);
  const autosaveScrollIdRef = useRef(null);
  const autosaveContextRef = useRef(0);
  const lastAutosaveFingerprintRef = useRef("");
  const autosaveInputsRef = useRef({
    isEditable: false,
    isTruesight: false,
    editorContent: "",
    editorTitle: "",
    activeScrollTitle: "",
    activeScrollId: null,
  });
  const [tooltipState, setTooltipState] = useState({
    visible: false,
    pinned: false,
    token: null,
    position: { x: TOOLTIP_MARGIN, y: TOOLTIP_MARGIN },
    localAnalysis: null,
  });

  // Prune stale day-cache keys on mount
  useEffect(() => { pruneOldCaches(); }, []);
  const activeScroll = activeScrollId ? getScrollById(activeScrollId) : null;
  const activeScrollContent = String(activeScroll?.content || "");
  const truesightContent = isEditable ? editorContent : activeScrollContent;

  useEffect(() => {
    autosaveScrollIdRef.current = activeScrollId || null;
  }, [activeScrollId]);

  useEffect(() => {
    autosaveInputsRef.current = {
      isEditable,
      isTruesight,
      editorContent,
      editorTitle,
      activeScrollTitle: String(activeScroll?.title || ""),
      activeScrollId,
    };
  }, [isEditable, isTruesight, editorContent, editorTitle, activeScroll?.title, activeScrollId]);

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
        stressPattern: String(profile?.stressPattern || ""),
        role: String(profile?.role || ""),
        lineRole: String(profile?.lineRole || ""),
        stressRole: String(profile?.stressRole || ""),
        rhymePolicy: String(profile?.rhymePolicy || ""),
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
        stressPattern: String(profile?.stressPattern || ""),
        role: String(profile?.role || ""),
        lineRole: String(profile?.lineRole || ""),
        stressRole: String(profile?.stressRole || ""),
        rhymePolicy: String(profile?.rhymePolicy || ""),
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
        stressPattern: String(profile?.stressPattern || ""),
        role: String(profile?.role || ""),
        lineRole: String(profile?.lineRole || ""),
        stressRole: String(profile?.stressRole || ""),
        rhymePolicy: String(profile?.rhymePolicy || ""),
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
      {
        theme,
        analysisMode,
        syntaxLayer: deepAnalysis?.syntaxSummary || null,
      }
    );
  }, [deepAnalysis, activeVowelColors, theme, analysisMode]);

  const [committedColors, setCommittedColors] = useState({
    analyzedWords: new Map(),
    analyzedWordsByIdentity: new Map(),
    analyzedWordsByCharStart: new Map(),
    colorMap: null,
  });
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const pendingCommitRef = useRef(null);

  useEffect(() => {
    if (!deepAnalysis?.wordAnalyses?.length) return;
    const next = { analyzedWords, analyzedWordsByIdentity, analyzedWordsByCharStart, colorMap };
    if (isTypingRef.current) {
      pendingCommitRef.current = next;
    } else {
      setCommittedColors(next);
      pendingCommitRef.current = null;
    }
  }, [deepAnalysis, analyzedWords, analyzedWordsByIdentity, analyzedWordsByCharStart, colorMap]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const overlayConnections = useMemo(() => {
    if (!isTruesight) {
      return [];
    }
    return Array.isArray(activeConnections) ? activeConnections : [];
  }, [isTruesight, activeConnections]);

  const handleInfoBeamClick = useCallback((label) => {
    setInfoBeamFamily(label);
  }, []);

  const infoBeamConnections = useMemo(() => {
    if (!infoBeamEnabled || !infoBeamFamily) return [];
    const all = Array.isArray(deepAnalysis?.allConnections)
      ? deepAnalysis.allConnections
      : [];
    return all.filter((c) => c.groupLabel === infoBeamFamily);
  }, [infoBeamEnabled, infoBeamFamily, deepAnalysis]);

  const scrollLines = useMemo(
    () => truesightContent.split("\n"),
    [truesightContent]
  );

  // Ambient analysis: always run on content change.
  // usePanelAnalysis internally debounces at 2.5s, so no extra debounce needed here.
  useEffect(() => {
    if (!truesightContent) return;
    analyzeDocument(truesightContent);
  }, [truesightContent, analyzeDocument]);

  const bumpAutosaveContext = useCallback(() => {
    autosaveContextRef.current += 1;
    queuedAutosaveRef.current = null;
    autosaveScrollIdRef.current = null;
    lastAutosaveFingerprintRef.current = "";
  }, []);

  const runTruesightAutosave = useCallback(async (draft) => {
    if (!draft || draft.context !== autosaveContextRef.current) return;

    const normalizedDraft = {
      context: draft.context,
      id: draft.id || autosaveScrollIdRef.current || undefined,
      title: String(draft.title || "").trim() || "Untitled Scroll",
      content: String(draft.content || ""),
    };
    const draftFingerprint = `${normalizedDraft.id || "new"}|${normalizedDraft.title}|${normalizedDraft.content}`;
    if (draftFingerprint === lastAutosaveFingerprintRef.current) {
      return;
    }

    if (autosaveInFlightRef.current) {
      queuedAutosaveRef.current = normalizedDraft;
      return;
    }

    autosaveInFlightRef.current = true;
    try {
      const savedScroll = await saveScroll(normalizedDraft);
      if (!savedScroll) return;
      if (normalizedDraft.context !== autosaveContextRef.current) return;

      const savedId = String(savedScroll.id || normalizedDraft.id || "");
      const savedTitle = String(savedScroll.title || normalizedDraft.title || "");
      const savedContent = String(savedScroll.content || normalizedDraft.content || "");
      lastAutosaveFingerprintRef.current = `${savedId || "new"}|${savedTitle}|${savedContent}`;

      if (savedId) {
        autosaveScrollIdRef.current = savedId;
        setActiveScrollId((prev) => prev || savedId);
      }
      if (!normalizedDraft.id && savedId) {
        setIsEditing(true);
      }
      setEditorTitle(savedTitle);
      setSaveStatus("Saved");
    } catch (error) {
      console.error("Truesight autosave failed:", error);
    } finally {
      autosaveInFlightRef.current = false;
      const queuedDraft = queuedAutosaveRef.current;
      queuedAutosaveRef.current = null;
      if (queuedDraft) {
        void runTruesightAutosave({
          ...queuedDraft,
          id: queuedDraft.id || autosaveScrollIdRef.current || undefined,
        });
      }
    }
  }, [saveScroll]);

  useEffect(() => {
    if (!deepAnalysis) return;

    const snapshot = autosaveInputsRef.current;
    if (!snapshot.isEditable || !snapshot.isTruesight) {
      return;
    }

    const content = String(snapshot.editorContent || "");
    if (!content.trim()) {
      return;
    }

    const title = String(snapshot.editorTitle || snapshot.activeScrollTitle || "").trim() || "Untitled Scroll";
    void runTruesightAutosave({
      context: autosaveContextRef.current,
      id: snapshot.activeScrollId || autosaveScrollIdRef.current || undefined,
      title,
      content,
    });
  }, [deepAnalysis, runTruesightAutosave]);

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowViewport(window.innerWidth <= 960);
      setIsMobileViewport(window.innerWidth <= 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSaveScroll = useCallback(
    async (title, content) => {
      bumpAutosaveContext();
      setSaveStatus("Saving...");
      const isUpdate = Boolean(isEditing && activeScrollId);
      const savedScroll = await saveScroll({ id: isUpdate ? activeScrollId : undefined, title, content });
      if (!savedScroll) {
        setSaveStatus("Error");
        addToast("Failed to save scroll", "error");
        return;
      }
      
      // Award XP for every save, including updates.
      // Keep the same power-scaled formula so rewards remain consistent.
      const totalPower = scoreData?.totalScore || 0;
      const baseXP = 25;
      const powerXP = Math.round(Math.pow(totalPower, 1.6));
      const xpAwarded = baseXP + powerXP;
      const source = totalPower > 70 ? "legendary_submission"
        : totalPower > 40 ? "expert_submission"
          : "basic_submission";
      const actionLabel = isUpdate ? "Scroll Updated" : "Scroll Saved";

      addXP(xpAwarded, source);
      addToast(`${actionLabel}! +${xpAwarded} XP`, "success");

      setSaveStatus("Saved");
      setActiveScrollId(savedScroll.id);
      setEditorContent(String(savedScroll.content || content || ""));
      setEditorTitle(String(savedScroll.title || title || ""));
      autosaveScrollIdRef.current = savedScroll.id || null;
      lastAutosaveFingerprintRef.current = `${savedScroll.id || "new"}|${String(savedScroll.title || title || "")}|${String(savedScroll.content || content || "")}`;
      setIsEditing(false);
      setIsEditable(false);
    },
    [isEditing, activeScrollId, saveScroll, addXP, addToast, scoreData, bumpAutosaveContext]
  );

  const handleSelectScroll = useCallback((id) => {
    bumpAutosaveContext();
    const selected = getScrollById(id);
    setActiveScrollId(id);
    setEditorTitle(String(selected?.title || ""));
    setEditorContent(String(selected?.content || ""));
    setIsEditing(false);
    setIsEditable(false);
    setHighlightedLines([]);
    setSaveStatus("Saved");
  }, [getScrollById, bumpAutosaveContext]);

  const handleNewScroll = useCallback(() => {
    bumpAutosaveContext();
    setActiveScrollId(null);
    setEditorTitle("");
    setEditorContent("");
    setIsEditing(false);
    setIsEditable(true);
    setHighlightedLines([]);
    setSaveStatus("Unsaved");
  }, [bumpAutosaveContext]);

  const handleEditScroll = useCallback(() => {
    bumpAutosaveContext();
    setEditorTitle(String(activeScroll?.title || ""));
    setEditorContent(activeScrollContent);
    setIsEditing(true);
    setIsEditable(true);
    setHighlightedLines([]);
    setSaveStatus("Unsaved");
  }, [activeScroll?.title, activeScrollContent, bumpAutosaveContext]);

  const handleEditScrollById = useCallback((id) => {
    bumpAutosaveContext();
    const scroll = getScrollById(id);
    if (!scroll) return;
    setActiveScrollId(id);
    setEditorTitle(String(scroll.title || ""));
    setEditorContent(String(scroll.content || ""));
    setIsEditing(true);
    setIsEditable(true);
    setHighlightedLines([]);
    setSaveStatus("Unsaved");
  }, [getScrollById, bumpAutosaveContext]);

  const handleCancelEdit = useCallback(() => {
    bumpAutosaveContext();
    if (activeScrollId) {
      setEditorTitle(String(activeScroll?.title || ""));
      setEditorContent(activeScrollContent);
      setIsEditing(false);
      setIsEditable(false);
      setSaveStatus("Saved");
    }
  }, [activeScrollId, activeScroll?.title, activeScrollContent, bumpAutosaveContext]);

  const handleToggleTruesight = useCallback(() => {
    setIsTruesight((prev) => !prev);
    setHighlightedLines([]);
  }, []);

  const handleModeChange = useCallback(
    (nextMode) => {
      setAnalysisMode((prev) => (prev === nextMode ? ANALYSIS_MODES.NONE : nextMode));
      setHighlightedLines([]);
    },
    []
  );

  const handleEditorContentChange = useCallback((content) => {
    isTypingRef.current = true;
    setIsEditorIdle(false);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      setIsEditorIdle(true);
      if (pendingCommitRef.current) {
        setCommittedColors(pendingCommitRef.current);
        pendingCommitRef.current = null;
      }
    }, 400);
    setEditorContent(content);
    setSaveStatus("Unsaved");
  }, []);

  const handleEditorTitleChange = useCallback((title) => {
    setEditorTitle(String(title || ""));
    if (isEditable) {
      setSaveStatus("Unsaved");
    }
  }, [isEditable]);

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

  function getSchoolMetaFromVowelFamily(familyId) {
    const schoolId = VOWEL_FAMILY_TO_SCHOOL[familyId] || null;
    if (!schoolId) return { schoolName: "Unbound", schoolGlyph: "\u2736" };
    return {
      schoolName: SCHOOLS[schoolId]?.name || schoolId,
      schoolGlyph: SCHOOL_GLYPHS[schoolId] || "\u2736",
    };
  }

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

    const astrologyAnchors = Array.isArray(rhymeAstrology?.inspector?.anchors)
      ? rhymeAstrology.inspector.anchors
      : [];
    const astrologyClusters = Array.isArray(rhymeAstrology?.inspector?.clusters)
      ? rhymeAstrology.inspector.clusters
      : [];
    const anchorMatch = astrologyAnchors.find((anchor) => {
      const matchesLine = Number(anchor?.lineIndex) === Number(activation?.lineIndex);
      const matchesCharStart = Number(anchor?.charStart) === Number(activation?.charStart);
      return matchesLine && matchesCharStart;
    }) || astrologyAnchors.find((anchor) => {
      const normalizedAnchor = String(anchor?.normalizedWord || "").toUpperCase();
      return normalizedAnchor && normalizedAnchor === normalizedWord;
    }) || null;
    const anchorSign = String(anchorMatch?.sign || "").trim();
    const anchorClusters = anchorSign
      ? astrologyClusters.filter((cluster) => String(cluster?.sign || "").trim() === anchorSign).slice(0, 3)
      : [];

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
      rhymeAstrology: {
        enabled: Boolean(rhymeAstrology?.enabled),
        sign: anchorSign || null,
        topMatches: Array.isArray(anchorMatch?.topMatches) ? anchorMatch.topMatches.slice(0, 5) : [],
        clusters: anchorClusters,
        diagnostics: anchorMatch?.diagnostics || null,
        features: rhymeAstrology?.features || null,
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
  }, [analyzedWords, analyzedWordsByCharStart, deepAnalysis, rhymeAstrology, selectedSchool]);

  const handleCloseTooltip = useCallback((options = {}) => {
    const shouldRestoreFocus = options?.restoreFocus !== false;
    const token = tooltipState.token;
    tooltipCloseGuardRef.current = {
      expiresAt: Date.now() + 300,
      lineIndex: Number.isInteger(token?.lineIndex) ? token.lineIndex : null,
      charStart: Number.isInteger(token?.charStart) ? token.charStart : null,
    };
    setTooltipState((prev) => ({
      ...prev,
      visible: false,
      pinned: false,
      token: null,
      localAnalysis: null,
    }));
    resetWordLookup();
    if (shouldRestoreFocus && focusReturnRef.current && typeof focusReturnRef.current.focus === "function") {
      focusReturnRef.current.focus();
    }
    focusReturnRef.current = null;
  }, [resetWordLookup, tooltipState.token]);

  const handleTooltipDrag = useCallback((position) => {
    setTooltipState((prev) => ({
      ...prev,
      position: clampTooltipPosition(position),
    }));
  }, []);

  const handleWordActivate = useCallback((activation) => {
    if (!activation || !activation.normalizedWord) {
      return;
    }

    const closeGuard = tooltipCloseGuardRef.current;
    if (Date.now() < closeGuard.expiresAt) {
      const sameToken = closeGuard.lineIndex === activation.lineIndex &&
        closeGuard.charStart === activation.charStart;
      if (sameToken && activation.trigger !== "leave") {
        return;
      }
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
        // Keep card's current position if already pinned — let it morph in place
        position: (prev.pinned && prev.visible) ? prev.position : position,
        localAnalysis,
      }));

      // Session history — navigate to existing entry or append new one
      const existingIdx = sessionWords.findIndex(e => e.word === activation.normalizedWord);
      if (existingIdx >= 0) {
        setSessionIndex(existingIdx);
      } else {
        const newIdx = sessionWords.length;
        setSessionWords(prev => [...prev, { word: activation.normalizedWord, localAnalysis }]);
        setSessionIndex(newIdx);
      }

      // Cache check before live lookup
      const cached = getCachedWord(activation.normalizedWord);
      if (cached) {
        setLookupOverride(cached);
        resetWordLookup();
      } else {
        setLookupOverride(null);
        resetWordLookup();
        lookup(activation.normalizedWord);
      }
    }
  }, [buildTooltipAnalysis, lookup, resetWordLookup, resolveTooltipPosition, sessionWords, tooltipState.pinned, tooltipState.token?.charStart, tooltipState.token?.lineIndex]);

  // Note: tooltip state is no longer cleared when Truesight turns OFF.
  // Definitions are ambient — the tooltip persists regardless of Truesight mode.

  const tooltipWordData = useMemo(() => {
    if (!tooltipState.token) return null;

    const baseWordData = {
      word: tooltipState.token.word,
      vowelFamily: tooltipState.localAnalysis?.core?.vowelFamily || null,
      rhymeKey: tooltipState.localAnalysis?.core?.rhymeKey || null,
      syllableCount: tooltipState.localAnalysis?.core?.syllableCount || undefined,
    };

    const effectiveLookupData = lookupOverride ?? lookupData;

    if (!tooltipState.pinned || !effectiveLookupData) {
      return baseWordData;
    }

    const selectedWord = String(tooltipState.token.normalizedWord || "").toUpperCase();
    const lookupWord = String(effectiveLookupData.word || "").toUpperCase();
    if (lookupWord && lookupWord !== selectedWord) {
      return baseWordData;
    }

    return {
      ...baseWordData,
      ...effectiveLookupData,
      word: effectiveLookupData.word || baseWordData.word,
      vowelFamily: effectiveLookupData.vowelFamily || baseWordData.vowelFamily,
      rhymeKey: effectiveLookupData.rhymeKey || baseWordData.rhymeKey,
      syllableCount: effectiveLookupData.syllableCount || baseWordData.syllableCount,
    };
  }, [lookupData, lookupOverride, tooltipState]);

  const totalSyllables = useMemo(() => {
    const counts = deepAnalysis?.lineSyllableCounts;
    if (!Array.isArray(counts)) return 0;
    return counts.reduce((a, b) => a + (Number(b) || 0), 0);
  }, [deepAnalysis]);

  // Save resolved lookup to day-cache
  useEffect(() => {
    if (!lookupData || !tooltipState.pinned || !tooltipState.token?.normalizedWord) return;
    const tokenWord = String(tooltipState.token.normalizedWord).toLowerCase();
    const dataWord = String(lookupData.word || "").toLowerCase();
    if (!dataWord || dataWord === tokenWord) {
      setCachedWord(tooltipState.token.normalizedWord, lookupData);
    }
  }, [lookupData, tooltipState.pinned, tooltipState.token?.normalizedWord]);

  // Handle clicking a suggestion rune inside the card
  const handleSuggestionClick = useCallback((word) => {
    const normalized = String(word || "").toLowerCase().trim();
    if (!normalized) return;

    // Reset live lookup state first
    resetWordLookup();
    setLookupOverride(null);

    // Update token word (keep card pinned in place, clear local analysis)
    setTooltipState(prev => ({
      ...prev,
      token: prev.token ? { ...prev.token, word: normalized, normalizedWord: normalized } : prev.token,
      localAnalysis: null,
    }));

    // Cache hit or live fetch
    const cached = getCachedWord(normalized);
    if (cached) {
      setLookupOverride(cached);
    } else {
      lookup(normalized);
    }
  }, [lookup, resetWordLookup]);

  // Handle session footer navigation (◂ ▸)
  const handleSessionNavigate = useCallback((index) => {
    if (index < 0 || index >= sessionWords.length) return;
    const entry = sessionWords[index];
    setSessionIndex(index);

    setTooltipState(prev => ({
      ...prev,
      token: prev.token
        ? { ...prev.token, word: entry.word, normalizedWord: entry.word }
        : prev.token,
      localAnalysis: entry.localAnalysis,
    }));

    resetWordLookup();
    setLookupOverride(null);

    const cached = getCachedWord(entry.word);
    if (cached) {
      setLookupOverride(cached);
    } else {
      lookup(entry.word);
    }
  }, [sessionWords, lookup, resetWordLookup]);

  const { predict, getCompletions, checkSpelling, getSpellingSuggestions, isReady: predictorReady } = usePredictor();
  const [misspellings, setMisspellings] = useState([]);
  const applySpellcheckCorrection = useCallback((misspelledWord, suggestion) => {
    const sourceWord = String(misspelledWord || "").trim();
    const replacement = String(suggestion || "").trim();
    if (!sourceWord || !replacement || !editorContent) return;

    const wordPattern = new RegExp(`\\b${escapeRegExp(sourceWord)}\\b`, "gi");
    const newContent = editorContent.replace(
      wordPattern,
      (matchedWord) => applyMatchCase(matchedWord, replacement)
    );
    if (newContent === editorContent) return;
    editorRef.current?.replaceContent?.(newContent);
  }, [editorContent]);

  // Document-wide spellcheck (debounced via editorContent)
  useEffect(() => {
    if (!isPredictive || !predictorReady || !editorContent) {
      setMisspellings([]);
      return;
    }

    let cancelled = false;

    const runSpellcheck = async () => {
      const allWords = editorContent.match(/[a-zA-Z']+/g) || [];
      const uniqueWords = [...new Set(allWords.map((word) => String(word || '').toLowerCase()))];
      const candidateWords = uniqueWords.filter((word) => word.length > 2);
      const prevContextByWord = new Map();

      for (let i = 0; i < allWords.length; i++) {
        const normalizedWord = String(allWords[i] || '').toLowerCase();
        if (!normalizedWord || prevContextByWord.has(normalizedWord)) continue;
        const previous = i > 0 ? String(allWords[i - 1] || '').toLowerCase() : null;
        prevContextByWord.set(normalizedWord, previous || null);
      }

      const checked = await Promise.all(candidateWords.map(async (word) => {
        const isValid = await checkSpelling(word);
        if (isValid) return null;

        const prevWord = prevContextByWord.get(word) || null;
        const suggestions = await getSpellingSuggestions(word, prevWord, 5);

        return {
          word,
          suggestions: Array.isArray(suggestions) ? suggestions : [],
        };
      }));

      if (cancelled) return;
      setMisspellings(checked.filter(Boolean));
    };

    void runSpellcheck();

    return () => {
      cancelled = true;
    };
  }, [editorContent, isPredictive, predictorReady, checkSpelling, getSpellingSuggestions]);

  /* ── Shared content blocks used in both mobile and desktop ── */
  const editorBlock = (
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
            plsPhoneticFeatures={scoreData?.plsPhoneticFeatures || rhymeAstrology?.features || null}
            onContentChange={handleEditorContentChange}
            onTitleChange={handleEditorTitleChange}
            analyzedWords={committedColors.analyzedWords}
            analyzedWordsByIdentity={committedColors.analyzedWordsByIdentity}
            analyzedWordsByCharStart={committedColors.analyzedWordsByCharStart}
            activeConnections={overlayConnections}
            lineSyllableCounts={deepAnalysis?.lineSyllableCounts || []}
            highlightedLines={effectiveHighlightedLines}
            pinnedLines={pinnedLines}
            vowelColors={activeVowelColors}
            colorMap={committedColors.colorMap}
            syntaxLayer={deepAnalysis?.syntaxSummary}
            analysisMode={analysisMode}
            theme={theme}
            onWordActivate={handleWordActivate}
            onCursorChange={setCursorPos}
            onScrollChange={setMinimapScrollTop}
            isEditorIdle={isEditorIdle}
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
  );

  const filesBlock = (
    <ScrollList
      scrolls={scrolls}
      activeScrollId={activeScrollId}
      onSelect={(id) => { handleSelectScroll(id); if (isMobileViewport) setMobileActiveTab("EDITOR"); }}
      onDelete={deleteScroll}
      onNewScroll={() => { handleNewScroll(); if (isMobileViewport) setMobileActiveTab("EDITOR"); }}
      onEdit={(id) => { handleEditScrollById(id); if (isMobileViewport) setMobileActiveTab("EDITOR"); }}
    />
  );

  const toolsBlock = (
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
            onPairSelect={(lines) => {
              setPinnedLines(lines);
              if (!lines) setHighlightedLines([]);
              if (lines) editorRef.current?.scrollToTopSmooth?.();
            }}
            onConnectionClick={() => {
              editorRef.current?.scrollToTopSmooth?.();
            }}
            highlightedLines={effectiveHighlightedLines}
          />
        </div>
      )}
      {isTruesight && (
        <div className="sidebar-sub-panel">
          <VowelFamilyPanel
            visible={true}
            families={vowelSummary?.families ?? []}
            totalWords={vowelSummary?.totalWords ?? 0}
            uniqueWords={vowelSummary?.uniqueWords ?? 0}
            isEmbedded={true}
          />
        </div>
      )}
    </div>
  );

  const scoreBlock = scoreData ? (
    <HeuristicScorePanel
      scoreData={scoreData}
      genreProfile={genreProfile}
      visible={true}
      isEmbedded={true}
    />
  ) : (
    <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--read-text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>
      Write or select a scroll to see metrics
    </div>
  );

  /* ── Mobile bottom tab bar icons (inline SVG) ── */
  const MobileTabBar = () => (
    <div className="mobile-tab-bar">
      <button type="button" className={`mobile-tab-bar-btn${mobileActiveTab === "EDITOR" ? " active" : ""}`} onClick={() => setMobileActiveTab("EDITOR")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span className="mobile-tab-bar-label">Edit</span>
      </button>
      <button type="button" className={`mobile-tab-bar-btn${mobileActiveTab === "FILES" ? " active" : ""}`} onClick={() => setMobileActiveTab("FILES")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span className="mobile-tab-bar-label">Files</span>
      </button>
      <button type="button" className={`mobile-tab-bar-btn${mobileActiveTab === "TOOLS" ? " active" : ""}`} onClick={() => setMobileActiveTab("TOOLS")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        <span className="mobile-tab-bar-label">Tools</span>
      </button>
      <button type="button" className={`mobile-tab-bar-btn${mobileActiveTab === "SCORE" ? " active" : ""}`} onClick={() => setMobileActiveTab("SCORE")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
        <span className="mobile-tab-bar-label">Score</span>
      </button>
    </div>
  );

  /* ── MOBILE RENDER ── */
  if (isMobileViewport) {
    return (
      <div className="ide-layout-wrapper ide-layout-wrapper--mobile">
        <TopBar
          title={activeScroll?.title || (isEditable ? "New Scroll" : "Scholomance IDE")}
          onOpenSearch={() => { setMobileActiveTab("FILES"); }}
          showMinimap={false}
          onToggleMinimap={() => {}}
          isEditable={isEditable}
          activeScrollId={activeScrollId}
          onEdit={handleEditScroll}
          progression={progression}
          auroraLevel={auroraLevel}
          onCycleAuroraLevel={cycleAuroraLevel}
        />
        <main className="ide-mobile-content">
          {mobileActiveTab === "EDITOR" && editorBlock}
          {mobileActiveTab === "FILES" && (
            <div className="ide-mobile-panel">{filesBlock}</div>
          )}
          {mobileActiveTab === "TOOLS" && (
            <div className="ide-mobile-panel">{toolsBlock}</div>
          )}
          {mobileActiveTab === "SCORE" && (
            <div className="ide-mobile-panel">{scoreBlock}</div>
          )}
        </main>
        <StatusBar
          line={cursorPos.line}
          col={cursorPos.col}
          language="Scroll Language"
          syllableCount={totalSyllables}
          analysisError={analysisError}
        />
        <MobileTabBar />

        <AnimatePresence>
          {tooltipState.token && (
            <WordTooltip
              key="word-card"
              wordData={tooltipWordData}
              analysis={tooltipState.localAnalysis}
              isLoading={tooltipState.pinned && isLookupLoading && !lookupOverride}
              error={tooltipState.pinned ? lookupError : null}
              x={tooltipState.position.x}
              y={tooltipState.position.y}
              onDrag={handleTooltipDrag}
              onClose={handleCloseTooltip}
              onSuggestionClick={handleSuggestionClick}
              sessionHistory={sessionWords}
              sessionIndex={sessionIndex}
              onSessionNavigate={handleSessionNavigate}
            />
          )}
        </AnimatePresence>

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

  /* ── DESKTOP RENDER ── */
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
        auroraLevel={auroraLevel}
        onCycleAuroraLevel={cycleAuroraLevel}
      />
      <main className="ide-main-content">
        <PanelGroup 
          direction={isNarrowViewport ? "vertical" : "horizontal"}
          onLayout={handleLayoutChange}
        >
          {/* 1. Activity Bar (Resizable/Collapsible Icons) */}
          <Panel
            defaultSize={settings?.ideLayout?.[0] ?? 4}
            minSize={2}
            maxSize={12}
            collapsible={true}
            className="ide-activity-bar"
          >
            <div className="activity-bar-content">
              <button
                className={`activity-item ${sidebarTab === 'FILES' ? 'active' : ''}`}
                onClick={() => setSidebarTab('FILES')}
                title="Explorer"
              >
                <FolderIcon size={20} />
                <span className="activity-label">EXPLORER</span>
              </button>
              <button
                className={`activity-item ${sidebarTab === 'SEARCH' ? 'active' : ''}`}
                onClick={() => setSidebarTab('SEARCH')}
                title="Search"
              >
                <SearchIcon size={20} />
                <span className="activity-label">SEARCH</span>
              </button>
              <button
                className={`activity-item ${sidebarTab === 'TOOLS' ? 'active' : ''}`}
                onClick={() => setSidebarTab('TOOLS')}
                title="Hex Tools"
              >
                <ToolsIcon size={20} />
                <span className="activity-label">HEX TOOLS</span>
              </button>
            </div>
            <div className="activity-bar-footer">
               <button className="activity-item" title="Settings">
                  <SettingsIcon size={20} />
               </button>
            </div>
          </Panel>

          <PanelResizeHandle className="activity-resize-handle" />

          {/* 2. Primary Sidebar (Content) */}
          <Panel
            defaultSize={settings?.ideLayout?.[1] ?? (isNarrowViewport ? 28 : 18)}
            minSize={isNarrowViewport ? 20 : 12}
            className="ide-sidebar"
          >
            <div className="sidebar-content">
              {sidebarTab === 'FILES' && (
                <ScrollList
                  scrolls={scrolls}
                  activeScrollId={activeScrollId}
                  onSelect={handleSelectScroll}
                  onDelete={deleteScroll}
                  onNewScroll={handleNewScroll}
                  onEdit={handleEditScrollById}
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
                    onTogglePredictive={handleTogglePredictive}
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
                        onPairSelect={(lines) => {
                          setPinnedLines(lines);
                          if (!lines) setHighlightedLines([]);
                          if (lines) editorRef.current?.scrollToTopSmooth?.();
                        }}
                        onConnectionClick={() => {
                          editorRef.current?.scrollToTopSmooth?.();
                        }}
                        highlightedLines={effectiveHighlightedLines}
                      />
                    </div>
                  )}
                  {isTruesight && (
                    <div className="sidebar-sub-panel">
                      <VowelFamilyPanel
                        visible={true}
                        families={vowelSummary?.families ?? []}
                        totalWords={vowelSummary?.totalWords ?? 0}
                        uniqueWords={vowelSummary?.uniqueWords ?? 0}
                        isEmbedded={true}
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
          <Panel defaultSize={settings?.ideLayout?.[2] ?? (isNarrowViewport ? undefined : 60)} minSize={isNarrowViewport ? "40%" : "30%"}>
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
                    plsPhoneticFeatures={scoreData?.plsPhoneticFeatures || rhymeAstrology?.features || null}
                    onContentChange={handleEditorContentChange}
                    onTitleChange={handleEditorTitleChange}
                    analyzedWords={committedColors.analyzedWords}
                    analyzedWordsByIdentity={committedColors.analyzedWordsByIdentity}
                    analyzedWordsByCharStart={committedColors.analyzedWordsByCharStart}
                    activeConnections={overlayConnections}
                    lineSyllableCounts={deepAnalysis?.lineSyllableCounts || []}
                    highlightedLines={effectiveHighlightedLines}
                    pinnedLines={pinnedLines}
                    vowelColors={activeVowelColors}
                    colorMap={committedColors.colorMap}
                    syntaxLayer={deepAnalysis?.syntaxSummary}
                    analysisMode={analysisMode}
                    theme={theme}
                    onWordActivate={handleWordActivate}
                    onCursorChange={setCursorPos}
                    onScrollChange={setMinimapScrollTop}
                    isEditorIdle={isEditorIdle}
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
          {!isNarrowViewport && (
            <>
              <PanelResizeHandle
                style={{ width: "2px", background: "var(--border-color)" }}
              />
              <Panel 
                defaultSize={settings?.ideLayout?.[3] ?? 25} 
                minSize={15} 
                collapsible={true} 
                className="ide-right-panel"
              >
                <div className="right-panel-container">
                  <div className="right-panel-scroll">
                    {showScorePanel && scoreData && (
                      <div className="right-panel-section">
                        <div className="right-panel-section-header">
                          <span className="right-panel-section-title">CODEx Metrics</span>
                          <button
                            type="button"
                            className="right-panel-close"
                            onClick={() => setShowScorePanel(false)}
                            aria-label="Close CODEx Metrics"
                          >×</button>
                        </div>
                        <HeuristicScorePanel
                          scoreData={scoreData}
                          genreProfile={genreProfile}
                          visible={true}
                          isEmbedded={true}
                        />
                      </div>
                    )}

                    {isTruesight && analysisMode === ANALYSIS_MODES.ANALYZE && (
                      <div className="right-panel-section">
                        <div className="right-panel-section-header">
                          <span className="right-panel-section-title">Analyze</span>
                          <button
                            type="button"
                            className="right-panel-close"
                            onClick={() => handleModeChange(ANALYSIS_MODES.NONE)}
                            aria-label="Close Analysis"
                          >×</button>
                        </div>
                        <AnalysisPanel
                          scheme={schemeDetection}
                          meter={meterDetection}
                          statistics={deepAnalysis?.statistics}
                          literaryDevices={literaryDevices}
                          emotion={emotion}
                          genreProfile={genreProfile}
                          hhmSummary={deepAnalysis?.syntaxSummary?.hhm}
                          scoreData={scoreData}
                          rhymeAstrology={rhymeAstrology}
                          onGroupHover={highlightRhymeGroup}
                          onGroupLeave={clearHighlight}
                          infoBeamEnabled={infoBeamEnabled}
                          onInfoBeamToggle={() => setInfoBeamEnabled((prev) => !prev)}
                          onGroupClick={handleInfoBeamClick}
                          activeInfoBeamFamily={infoBeamFamily}
                        />
                      </div>
                    )}

                    {infoBeamEnabled && infoBeamFamily && (
                      <div className="right-panel-section">
                        <div className="right-panel-section-header">
                          <span className="right-panel-section-title">InfoBeam — Group {infoBeamFamily}</span>
                          <button
                            type="button"
                            className="right-panel-close"
                            onClick={() => setInfoBeamFamily(null)}
                            aria-label="Close InfoBeam"
                          >×</button>
                        </div>
                        <InfoBeamPanel
                          groupLabel={infoBeamFamily}
                          groupColor={patternColor(infoBeamFamily)}
                          connections={infoBeamConnections}
                          scrollLines={scrollLines}
                        />
                      </div>
                    )}

                    {showMinimap && (
                      <div className="right-panel-section">
                        <div className="right-panel-section-header">
                          <span className="right-panel-section-title">Minimap</span>
                          <button
                            type="button"
                            className="right-panel-close"
                            onClick={() => setShowMinimap(false)}
                            aria-label="Close Minimap"
                          >×</button>
                        </div>
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
                      </div>
                    )}

                    {isPredictive && misspellings.length > 0 && (
                      <div className="right-panel-section">
                        <div className="right-panel-section-header">
                          <span className="right-panel-section-title">Spellcheck</span>
                          <button
                            type="button"
                            className="right-panel-close"
                            onClick={() => setIsPredictive(false)}
                            aria-label="Close Spellcheck"
                          >×</button>
                        </div>
                        <div className="misspellings-list">
                          {misspellings.map((err, i) => (
                            <div key={i} className="misspelling-item">
                              <button
                                type="button"
                                className={`error-word${err.suggestions.length > 0 ? " error-word--interactive" : ""}`}
                                disabled={err.suggestions.length === 0}
                                onClick={() => applySpellcheckCorrection(err.word, err.suggestions[0])}
                                title={
                                  err.suggestions.length > 0
                                    ? `Replace "${err.word}" with "${err.suggestions[0]}"`
                                    : "No suggestions available"
                                }
                              >
                                {err.word}
                              </button>
                              <div className="error-suggestions">
                                {err.suggestions.map((s, j) => (
                                  <button
                                    key={j}
                                    className="btn-tiny"
                                    onClick={() => applySpellcheckCorrection(err.word, s)}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!showScorePanel && !(isTruesight && analysisMode === ANALYSIS_MODES.ANALYZE) && !(infoBeamEnabled && infoBeamFamily) && !showMinimap && !(isPredictive && misspellings.length > 0) && (
                      <div className="right-panel-empty">
                        <div className="right-panel-empty-icon">⊘</div>
                        <p>Enable Truesight or CODEx Metrics to see analysis here</p>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </main>

      <StatusBar
        line={cursorPos.line}
        col={cursorPos.col}
        language="Scroll Language"
        syllableCount={totalSyllables}
        analysisError={analysisError}
      />
      
      {/* Floating panel fallback for narrow viewports only */}
      {isNarrowViewport && showMinimap && (
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
          maxWidth={280}
          maxHeight={600}
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

      {isNarrowViewport && isTruesight && analysisMode === ANALYSIS_MODES.ANALYZE && (
        <FloatingPanel
          id="analyze-panel"
          title="Analyze"
          onClose={() => handleModeChange(ANALYSIS_MODES.NONE)}
          defaultX={window.innerWidth - 360}
          defaultY={80}
          defaultWidth={340}
          defaultHeight={540}
          minWidth={280}
          minHeight={200}
          maxWidth={580}
          maxHeight={860}
        >
          <AnalysisPanel
            scheme={schemeDetection}
            meter={meterDetection}
            statistics={deepAnalysis?.statistics}
            literaryDevices={literaryDevices}
            emotion={emotion}
            genreProfile={genreProfile}
            hhmSummary={deepAnalysis?.syntaxSummary?.hhm}
            scoreData={scoreData}
            rhymeAstrology={rhymeAstrology}
            onGroupHover={highlightRhymeGroup}
            onGroupLeave={clearHighlight}
            infoBeamEnabled={infoBeamEnabled}
            onInfoBeamToggle={() => setInfoBeamEnabled((prev) => !prev)}
            onGroupClick={handleInfoBeamClick}
            activeInfoBeamFamily={infoBeamFamily}
          />
        </FloatingPanel>
      )}

      {isNarrowViewport && infoBeamEnabled && infoBeamFamily && (
        <FloatingPanel
          id="infobeam-panel"
          title={`InfoBeam — Group ${infoBeamFamily}`}
          onClose={() => setInfoBeamFamily(null)}
          defaultX={window.innerWidth - 720}
          defaultY={80}
          defaultWidth={320}
          defaultHeight={480}
          minWidth={220}
          minHeight={160}
          maxWidth={500}
          maxHeight={700}
          zIndex={150}
          className="infobeam-floating-panel"
        >
          <InfoBeamPanel
            groupLabel={infoBeamFamily}
            groupColor={patternColor(infoBeamFamily)}
            connections={infoBeamConnections}
            scrollLines={scrollLines}
          />
        </FloatingPanel>
      )}

      {isNarrowViewport && showScorePanel && scoreData && (
        <FloatingPanel
          id="score-panel"
          title="CODEx Metrics"
          className="codex-metrics-panel"
          onClose={() => setShowScorePanel(false)}
          defaultX={window.innerWidth - 340}
          defaultY={80}
          minWidth={260}
          minHeight={180}
          maxWidth={500}
          maxHeight={700}
        >
          <HeuristicScorePanel
            scoreData={scoreData}
            genreProfile={genreProfile}
            visible={true}
            isEmbedded={true}
          />
        </FloatingPanel>
      )}

      <AnimatePresence>
        {tooltipState.token && (
          <WordTooltip
            key="word-card"
            wordData={tooltipWordData}
            analysis={tooltipState.localAnalysis}
            isLoading={tooltipState.pinned && isLookupLoading && !lookupOverride}
            error={tooltipState.pinned ? lookupError : null}
            x={tooltipState.position.x}
            y={tooltipState.position.y}
            onDrag={handleTooltipDrag}
            onClose={handleCloseTooltip}
            onSuggestionClick={handleSuggestionClick}
            sessionHistory={sessionWords}
            sessionIndex={sessionIndex}
            onSessionNavigate={handleSessionNavigate}
          />
        )}
      </AnimatePresence>

      {isNarrowViewport && isPredictive && misspellings.length > 0 && (
        <FloatingPanel
          id="spellcheck-panel"
          title="Spellcheck"
          onClose={() => setIsPredictive(false)}
          defaultX={window.innerWidth - 300}
          defaultY={window.innerHeight - 300}
          minWidth={220}
          minHeight={120}
          maxWidth={400}
          maxHeight={500}
          className="spellcheck-panel"
        >
          <div className="misspellings-list">
            {misspellings.map((err, i) => (
              <div key={i} className="misspelling-item">
                <button
                  type="button"
                  className={`error-word${err.suggestions.length > 0 ? " error-word--interactive" : ""}`}
                  disabled={err.suggestions.length === 0}
                  onClick={() => applySpellcheckCorrection(err.word, err.suggestions[0])}
                  title={
                    err.suggestions.length > 0
                      ? `Replace "${err.word}" with "${err.suggestions[0]}"`
                      : "No suggestions available"
                  }
                >
                  {err.word}
                </button>
                <div className="error-suggestions">
                  {err.suggestions.map((s, j) => (
                    <button
                      key={j}
                      className="btn-tiny"
                      onClick={() => applySpellcheckCorrection(err.word, s)}
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
