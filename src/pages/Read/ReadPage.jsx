import {
  FolderIcon,
  SearchIcon,
  ToolsIcon,
  SettingsIcon,
} from "../../components/Icons.jsx";
import { useUserSettings } from "../../hooks/useUserSettings.js";
import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from "react";
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
import { getVowelColorsForSchool, getRitualPalette } from "../../data/schoolPalettes.js";
import { SCHOOLS, VOWEL_FAMILY_TO_SCHOOL, getSchoolsByUnlock } from "../../data/schools.js";
import { normalizeVowelFamily } from "../../lib/phonology/vowelFamily.js";
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
import FloatingPanel from "../../components/shared/FloatingPanel.jsx";
import IDEAmbientCanvas from "./IDEAmbientCanvas.jsx";
import { ToolbarChannel, TOOLBAR_TOOL, SAVE_STATE } from "../../lib/truesight/compiler/toolbarBytecode";
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
const AUTOSAVE_DELAY_MS = 180000; // 3 minutes

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

function normalizeComparableWord(value) {
  return String(value || "").trim().toUpperCase();
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
  const [editorContent, setEditorContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [selectedSchool, setSelectedSchool] = useState("SONIC");
  const [infoBeamEnabled, setInfoBeamEnabled] = useState(false);
  const [infoBeamFamily, setInfoBeamFamily] = useState(null);

  // Use settings for initial state if available
  const [isTruesight, setIsTruesight] = useState(settings?.truesightEnabled ?? false);
  const [isPredictive, setIsPredictive] = useState(settings?.predictiveEnabled ?? false);
  const [mirrored, setMirrored] = useState(settings?.mirroredEnabled ?? false); // Mirror state
  const [analysisMode, setAnalysisMode] = useState(settings?.analysisMode ?? ANALYSIS_MODES.NONE);
  const [_isActivityBarExpanded, _setIsActivityBarExpanded] = useState(settings?.ideLayout?.[0] > 18);
  
  const [highlightedLines, setHighlightedLines] = useState([]);
  const [pinnedLines, setPinnedLines] = useState([]);
  const [_saveStatus, setSaveStatus] = useState("Saved");
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("FILES");
  const [mobileActiveTab, setMobileActiveTab] = useState("EDITOR");
  const [showScorePanel, setShowScorePanel] = useState(false);
  const [showOraclePanel, setShowOraclePanel] = useState(true);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const schoolColorHex = useMemo(() => {
    return SCHOOLS[selectedSchool]?.color || "#d5b34b";
  }, [selectedSchool]);

  const effectiveHighlightedLines = useMemo(() => {
    return [...new Set([...highlightedLines, ...pinnedLines])];
  }, [highlightedLines, pinnedLines]);
  
  const {
    analysis: deepAnalysis,
    schemeDetection,
    meterDetection,
    genreProfile,
    scoreData,
    rhymeAstrology,
    narrativeAMP,
    oracle,
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

  // Sync toolbar state to bytecode channel
  useEffect(() => {
    ToolbarChannel.setTool(TOOLBAR_TOOL.TRUESIGHT, isTruesight);
  }, [isTruesight]);
  
  useEffect(() => {
    ToolbarChannel.setTool(TOOLBAR_TOOL.PREDICTIVE, isPredictive);
  }, [isPredictive]);
  
  useEffect(() => {
    ToolbarChannel.setTool(TOOLBAR_TOOL.ANALYSIS_MODE, analysisMode);
  }, [analysisMode]);
  
  useEffect(() => {
    ToolbarChannel.setTool(TOOLBAR_TOOL.SCHEME_DETECTION, !!schemeDetection);
  }, [schemeDetection]);

  const handleToggleTruesight = useCallback(() => {
    setIsTruesight((prev) => {
      const next = !prev;
      updateSettings({ truesightEnabled: next });
      ToolbarChannel.setTool(TOOLBAR_TOOL.TRUESIGHT, next);
      setHighlightedLines([]);
      return next;
    });
  }, [updateSettings]);

  const handleTogglePredictive = useCallback(() => {
    setIsPredictive(prev => {
      const next = !prev;
      updateSettings({ predictiveEnabled: next });
      ToolbarChannel.setTool(TOOLBAR_TOOL.PREDICTIVE, next);
      return next;
    });
  }, [updateSettings]);

  const handleToggleMirrored = useCallback(() => {
    setMirrored((prev) => {
      const next = !prev;
      updateSettings({ mirroredEnabled: next });
      return next;
    });
  }, [updateSettings]);

  const handleModeChange = useCallback((nextMode) => {
    setAnalysisMode((prev) => {
      const resolvedMode = prev === nextMode ? ANALYSIS_MODES.NONE : nextMode;
      updateSettings({ analysisMode: resolvedMode });
      ToolbarChannel.setTool(TOOLBAR_TOOL.ANALYSIS_MODE, resolvedMode);
      return resolvedMode;
    });
    setHighlightedLines([]);
  }, [updateSettings]);

  useLayoutEffect(() => {
    // Combined activity bar width — drives IDE.css label reveal thresholds
    const layout = settings?.ideLayout;
    // Support old 5-element layout (icons + labels were separate) → merge them
    const isOldLayout = layout?.length === 5;
    const combinedPct = isOldLayout
      ? (layout[0] + layout[1])
      : (layout?.[0] ?? 3);
    const el = document.querySelector('.ide-activity-combined');
    if (el) el.setAttribute('data-panel-size', combinedPct.toFixed(1));
  }, [settings?.ideLayout]);

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
  const _activityBarRef = useRef(null);
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
    editorContent: "",
    editorTitle: "",
    activeScrollTitle: "",
    activeScrollId: null,
    activeScrollSubmittedAt: null,
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
  const documentContent = isEditable ? editorContent : activeScrollContent;
  const truesightContent = documentContent;

  useEffect(() => {
    autosaveScrollIdRef.current = activeScrollId || null;
  }, [activeScrollId]);

  useEffect(() => {
    autosaveInputsRef.current = {
      isEditable,
      editorContent,
      editorTitle,
      activeScrollTitle: String(activeScroll?.title || ""),
      activeScrollId,
      activeScrollSubmittedAt: activeScroll?.submittedAt || null,
    };
  }, [isEditable, editorContent, editorTitle, activeScroll?.title, activeScroll?.submittedAt, activeScrollId]);

  const lineCount = useMemo(() => {
    return truesightContent.split("\n").length;
  }, [truesightContent]);

  const currentLineText = useMemo(() => {
    const lines = String(editorContent || "").split("\n");
    // If no cursor, default to the last line being typed
    const currentLineIdx = Number.isInteger(cursorPos?.lineNumber) ? cursorPos.lineNumber - 1 : lines.length - 1;
    return lines[currentLineIdx] || "";
  }, [editorContent, cursorPos]);

  const schoolList = useMemo(
    () => getSchoolsByUnlock(),
    []
  );

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

  // Bytecode is already on wordAnalyses from the backend — no need to build colorMap
  // The visualBytecode field on each wordAnalysis is authoritative and produced by Codex

  const [committedAnalysis, setCommittedAnalysis] = useState({
    analyzedWords: new Map(),
    analyzedWordsByIdentity: new Map(),
    analyzedWordsByCharStart: new Map(),
  });
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const pendingCommitRef = useRef(null);

  useEffect(() => {
    if (!deepAnalysis?.wordAnalyses?.length) return;
    const next = { analyzedWords, analyzedWordsByIdentity, analyzedWordsByCharStart };
    if (isTypingRef.current) {
      pendingCommitRef.current = next;
    } else {
      setCommittedAnalysis(next);
      pendingCommitRef.current = null;
    }
  }, [deepAnalysis, analyzedWords, analyzedWordsByIdentity, analyzedWordsByCharStart]);

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
  // usePanelAnalysis internally debounces at 500ms, so no extra debounce needed here.
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

  const runAutosave = useCallback(async (draft) => {
    if (!draft || draft.context !== autosaveContextRef.current) return;

    const normalizedDraft = {
      context: draft.context,
      id: draft.id || autosaveScrollIdRef.current || undefined,
      title: String(draft.title || "").trim() || "Untitled Scroll",
      content: String(draft.content || ""),
      submittedAt: draft.submittedAt || null,
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
      const savedScroll = await saveScroll({
        ...normalizedDraft,
        submit: false,
      });
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
      console.error("Autosave failed:", error);
    } finally {
      autosaveInFlightRef.current = false;
      const queuedDraft = queuedAutosaveRef.current;
      queuedAutosaveRef.current = null;
      if (queuedDraft) {
        void runAutosave({
          ...queuedDraft,
          id: queuedDraft.id || autosaveScrollIdRef.current || undefined,
        });
      }
    }
  }, [saveScroll]);

  useEffect(() => {
    const snapshot = autosaveInputsRef.current;
    if (!snapshot.isEditable) {
      return;
    }

    const content = String(snapshot.editorContent || "");
    const title = String(snapshot.editorTitle || snapshot.activeScrollTitle || "").trim();
    const hasExistingDraft = Boolean(snapshot.activeScrollId || autosaveScrollIdRef.current);
    if (!hasExistingDraft && !content.trim() && !title) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void runAutosave({
        context: autosaveContextRef.current,
        id: snapshot.activeScrollId || autosaveScrollIdRef.current || undefined,
        title,
        content,
        submittedAt: snapshot.activeScrollSubmittedAt || null,
      });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [activeScroll?.submittedAt, activeScrollId, editorContent, editorTitle, isEditable, runAutosave]);

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
      ToolbarChannel.setTool(TOOLBAR_TOOL.SAVE_STATE, SAVE_STATE.SAVING);
      setSaveStatus("Saving...");
      const isUpdate = Boolean(isEditing && activeScrollId);
      const wasSubmitted = Boolean(activeScroll?.submittedAt);
      const savedScroll = await saveScroll({
        id: isUpdate ? activeScrollId : undefined,
        title,
        content,
        submit: true,
        submittedAt: activeScroll?.submittedAt || null,
      });
      if (!savedScroll) {
        ToolbarChannel.setTool(TOOLBAR_TOOL.SAVE_STATE, SAVE_STATE.DIRTY);
        setSaveStatus("Error");
        addToast("Failed to save scroll", "error");
        return;
      }

      const didSubmitNow = !wasSubmitted && Boolean(savedScroll.submittedAt);
      const actionLabel = didSubmitNow
        ? "Scroll Submitted"
        : isUpdate
          ? "Scroll Updated"
          : "Scroll Saved";

      if (didSubmitNow) {
        const totalPower = scoreData?.totalScore || 0;
        const baseXP = 25;
        const powerXP = Math.round(Math.pow(totalPower, 1.6));
        const xpAwarded = baseXP + powerXP;
        const source = totalPower > 70 ? "legendary_submission"
          : totalPower > 40 ? "expert_submission"
            : "basic_submission";

        addXP(xpAwarded, source);
        addToast(`${actionLabel}! +${xpAwarded} XP`, "success");
      } else {
        addToast(`${actionLabel}!`, "success");
      }

      ToolbarChannel.setTool(TOOLBAR_TOOL.SAVE_STATE, SAVE_STATE.SAVED);
      setSaveStatus("Saved");
      setActiveScrollId(savedScroll.id);
      setEditorContent(String(savedScroll.content || content || ""));
      setEditorTitle(String(savedScroll.title || title || ""));
      autosaveScrollIdRef.current = savedScroll.id || null;
      lastAutosaveFingerprintRef.current = `${savedScroll.id || "new"}|${String(savedScroll.title || title || "")}|${String(savedScroll.content || content || "")}`;
      setIsEditing(false);
      setIsEditable(false);
    },
    [isEditing, activeScrollId, activeScroll?.submittedAt, saveScroll, addXP, addToast, scoreData, bumpAutosaveContext]
  );

  const handleSelectScroll = useCallback((id) => {
    bumpAutosaveContext();
    setActiveScrollId(id);
    setIsEditing(false);
    setIsEditable(false);
    setHighlightedLines([]);
    setSaveStatus("Saved");
  }, [bumpAutosaveContext]);

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

  const handleEditorContentChange = useCallback((content) => {
    isTypingRef.current = true;
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      if (pendingCommitRef.current) {
        setCommittedAnalysis(pendingCommitRef.current);
        pendingCommitRef.current = null;
      }
    }, 400);
    setEditorContent(content);
    ToolbarChannel.setTool(TOOLBAR_TOOL.SAVE_STATE, SAVE_STATE.DIRTY);
    setSaveStatus("Unsaved");
  }, []);

  const handleEditorTitleChange = useCallback((title) => {
    setEditorTitle(String(title || ""));
    if (isEditable) {
      ToolbarChannel.setTool(TOOLBAR_TOOL.SAVE_STATE, SAVE_STATE.DIRTY);
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

  const resolveLexiconContext = useCallback((word) => {
    const normalizedWord = normalizeComparableWord(word);
    if (!normalizedWord) return null;

    const localWordAnalysis = analyzedWords.get(normalizedWord) || null;
    const schoolMeta = getSchoolMetaFromVowelFamily(localWordAnalysis?.vowelFamily || null);
    const wordProfiles = Array.isArray(deepAnalysis?.wordAnalyses) ? deepAnalysis.wordAnalyses : [];
    const matchingProfiles = wordProfiles.filter(
      (profile) => normalizeComparableWord(profile?.normalizedWord || profile?.word) === normalizedWord
    );

    const allConnections = Array.isArray(deepAnalysis?.allConnections) ? deepAnalysis.allConnections : [];
    const matchedLinks = allConnections.flatMap((connection) => {
      const wordA = normalizeComparableWord(connection?.wordA?.normalizedWord || connection?.wordA?.word);
      const wordB = normalizeComparableWord(connection?.wordB?.normalizedWord || connection?.wordB?.word);
      if (wordA !== normalizedWord && wordB !== normalizedWord) return [];

      const opposite = wordA === normalizedWord ? connection?.wordB : connection?.wordA;
      return [{
        word: String(opposite?.word || ""),
        line: Number.isInteger(opposite?.lineIndex) ? opposite.lineIndex + 1 : null,
        charStart: Number.isInteger(opposite?.charStart) ? opposite.charStart : null,
        score: Number(connection?.score) || 0,
        type: String(connection?.type || "near"),
        groupLabel: String(connection?.groupLabel || ""),
      }];
    }).sort((a, b) => (b.score - a.score) || a.word.localeCompare(b.word));

    const astrologyAnchors = Array.isArray(rhymeAstrology?.inspector?.anchors)
      ? rhymeAstrology.inspector.anchors
      : [];
    const astrologyClusters = Array.isArray(rhymeAstrology?.inspector?.clusters)
      ? rhymeAstrology.inspector.clusters
      : [];
    const anchorMatch = astrologyAnchors.find(
      (anchor) => normalizeComparableWord(anchor?.normalizedWord || anchor?.word) === normalizedWord
    ) || null;
    const anchorSign = String(anchorMatch?.sign || "").trim();

    if (!localWordAnalysis && matchingProfiles.length === 0 && matchedLinks.length === 0 && !anchorSign) {
      return null;
    }

    return {
      foundInScroll: matchingProfiles.length > 0,
      totalOccurrences: matchingProfiles.length,
      occurrences: matchingProfiles.slice(0, 8).map((profile) => ({
        word: String(profile?.word || "").trim() || normalizedWord.toLowerCase(),
        line: Number.isInteger(profile?.lineIndex) ? profile.lineIndex + 1 : null,
        charStart: Number.isInteger(profile?.charStart) ? profile.charStart : null,
      })),
      core: {
        vowelFamily: localWordAnalysis?.vowelFamily || null,
        rhymeKey: localWordAnalysis?.rhymeKey || null,
        syllableCount: Number(localWordAnalysis?.syllableCount) || null,
        schoolName: schoolMeta.schoolName,
        schoolGlyph: schoolMeta.schoolGlyph,
      },
      resonanceLinks: matchedLinks.filter((link) => link.type !== "assonance").slice(0, 6),
      assonanceLinks: matchedLinks.filter((link) => link.type === "assonance").slice(0, 6),
      astrology: anchorSign ? {
        sign: anchorSign,
        topMatches: Array.isArray(anchorMatch?.topMatches) ? anchorMatch.topMatches.slice(0, 4) : [],
        clusters: astrologyClusters
          .filter((cluster) => String(cluster?.sign || "").trim() === anchorSign)
          .slice(0, 3),
      } : null,
    };
  }, [analyzedWords, deepAnalysis, rhymeAstrology]);

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

  const lexiconSeedWord = tooltipState.pinned
    ? String(tooltipState.token?.normalizedWord || "")
    : "";

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
    if (!isEditable || !isPredictive || !predictorReady || !editorContent) {
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
  }, [editorContent, isEditable, isPredictive, predictorReady, checkSpelling, getSpellingSuggestions]);

  /* ── Shared content blocks used in both mobile and desktop ── */
  const isAstrologyMode = analysisMode === ANALYSIS_MODES.ASTROLOGY;
  const isAnalyzeMode = isTruesight && analysisMode === ANALYSIS_MODES.ANALYZE;
  const isAnalysisPanelVisible = isAnalyzeMode || isAstrologyMode;
  const analysisPanelTitle = isAstrologyMode ? "Rhyme Astrology" : "Analyze";
  const analysisPanelCloseLabel = isAstrologyMode ? "Close Rhyme Astrology" : "Close Analysis";

  const editorBlock = (
    <div className="codex-workspace">
      <div className="document-container">
        {activeScrollId || isEditable ? (
          <ScrollEditor
            ref={editorRef}
            documentIdentity={activeScrollId || "new"}
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
            analyzedWords={committedAnalysis.analyzedWords}
            analyzedWordsByIdentity={committedAnalysis.analyzedWordsByIdentity}
            analyzedWordsByCharStart={committedAnalysis.analyzedWordsByCharStart}
            activeConnections={overlayConnections}
            lineSyllableCounts={deepAnalysis?.lineSyllableCounts || []}
            highlightedLines={effectiveHighlightedLines}
            pinnedLines={pinnedLines}
            vowelColors={activeVowelColors}
            syntaxLayer={deepAnalysis?.syntaxSummary}
            analysisMode={analysisMode}
            theme={theme}
            onWordActivate={handleWordActivate}
            onCursorChange={setCursorPos}
            mirrored={mirrored}
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

  const searchBlock = (
    <SearchPanel
      seedWord={lexiconSeedWord}
      selectedSchool={selectedSchool}
      contextLookup={resolveLexiconContext}
      onJumpToLine={(line) => {
        editorRef.current?.jumpToLine?.(line);
        if (isMobileViewport) setMobileActiveTab("EDITOR");
      }}
      variant="sidebar"
    />
  );

  const toolsBlock = (
    <div className="sidebar-tools">
      <ToolsSidebar
        editorRef={editorRef}
        isEditable={isEditable}
        isTruesight={isTruesight}
        onToggleTruesight={handleToggleTruesight}
        isPredictive={isPredictive}
        onTogglePredictive={() => setIsPredictive(prev => !prev)}
        mirrored={mirrored}
        onToggleMirrored={handleToggleMirrored}
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
      {isAstrologyMode && (
        <div className="sidebar-sub-panel">
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
            narrativeAMP={narrativeAMP}
            oracle={oracle}
            onGroupHover={highlightRhymeGroup}
            onGroupLeave={clearHighlight}
            infoBeamEnabled={infoBeamEnabled}
            onInfoBeamToggle={() => setInfoBeamEnabled((prev) => !prev)}
            onGroupClick={handleInfoBeamClick}
            activeInfoBeamFamily={infoBeamFamily}
            surfaceMode="astrology"
            currentLineText={currentLineText}
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

  const ritualPalette = useMemo(
    () => getRitualPalette(selectedSchool, theme),
    [selectedSchool, theme]
  );

  const activeSchoolLabel = useMemo(
    () => schoolList.find((school) => school.id === selectedSchool)?.name || "Truesight",
    [schoolList, selectedSchool]
  );

  const mobileVisionLabel = isAstrologyMode
    ? "Astrology"
    : isAnalyzeMode
      ? "Analyze"
      : isTruesight
        ? "Truesight"
        : "Draft";

  const mobileSurfaceTitle = activeScroll?.title || (isEditable ? "New Scroll" : "Scholomance IDE");
  const mobileTabs = [
    {
      id: "EDITOR",
      label: "Editor",
      hint: isEditable ? "Write" : "Read",
      eyebrow: "Writing chamber",
      description: "Compose and revise within the grimoire surface without leaving the live ritual.",
      badge: isEditable ? "Live edit" : "Read only",
    },
    {
      id: "FILES",
      label: "Files",
      hint: "Library",
      eyebrow: "Archive stacks",
      description: "Open drafts, revisit scrolls, or begin a new working from the library ledger.",
      badge: `${scrolls.length} scrolls`,
    },
    {
      id: "SEARCH",
      label: "Oracle",
      hint: "Query",
      eyebrow: "Archive terminal",
      description: "Summon definitions, rhyme fields, shadow echoes, and live scroll resonance from one terminal surface.",
      badge: "Lexicon live",
    },
    {
      id: "TOOLS",
      label: "Tools",
      hint: "Tune",
      eyebrow: "School controls",
      description: "Adjust Truesight, predictive guidance, and school attunement from one control rail.",
      badge: activeSchoolLabel,
    },
    {
      id: "SCORE",
      label: "Score",
      hint: "Metrics",
      eyebrow: "Combat trace",
      description: scoreData
        ? "Inspect total power and the heuristic trail behind every point of damage."
        : "Metrics appear here as soon as the scroll has enough language to score.",
      badge: scoreData ? `${scoreData.traces?.length ?? 0} traces` : "Awaiting data",
    },
  ];

  const currentMobileTab = mobileTabs.find((tab) => tab.id === mobileActiveTab) || mobileTabs[0];

  const MobileTabIcon = ({ tabId }) => {
    switch (tabId) {
      case "EDITOR":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        );
      case "FILES":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        );
      case "SEARCH":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        );
      case "TOOLS":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        );
      case "SCORE":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
          </svg>
        );
      default:
        return null;
    }
  };

  const activeMobilePanel =
    mobileActiveTab === "EDITOR" ? editorBlock :
    mobileActiveTab === "FILES" ? <div className="ide-mobile-panel">{filesBlock}</div> :
    mobileActiveTab === "SEARCH" ? <div className="ide-mobile-panel">{searchBlock}</div> :
    mobileActiveTab === "TOOLS" ? <div className="ide-mobile-panel">{toolsBlock}</div> :
    <div className="ide-mobile-panel">{scoreBlock}</div>;

  /* ── MOBILE RENDER ── */
  if (isMobileViewport) {
    return (
      <div className="ide-layout-wrapper ide-layout-wrapper--mobile">
        <TopBar
          title={mobileSurfaceTitle}
          onOpenSearch={() => { setMobileActiveTab("SEARCH"); }}
          showMinimap={false}
          onToggleMinimap={() => {}}
          isEditable={isEditable}
          activeScrollId={activeScrollId}
          onEdit={handleEditScroll}
          progression={progression}
          auroraLevel={auroraLevel}
          onCycleAuroraLevel={cycleAuroraLevel}
          showMinimapControl={false}
          showSettingsControl={false}
        />
        <main className="ide-mobile-content">
          <section className="ide-mobile-hero" aria-label="Scroll chamber overview">
            <div className="ide-mobile-hero-copy">
              <p className="ide-mobile-hero-eyebrow">Scribe chamber</p>
              <h2 className="ide-mobile-hero-title">{mobileSurfaceTitle}</h2>
              <p className="ide-mobile-hero-description">
                Compose, inspect, and score within one continuous chamber built for touch instead of compromise.
              </p>
            </div>
            <div className="ide-mobile-meta-grid" aria-label="Current ritual state">
              <div className="ide-mobile-meta-chip">
                <span className="ide-mobile-meta-label">School</span>
                <span className="ide-mobile-meta-value">{activeSchoolLabel}</span>
              </div>
              <div className="ide-mobile-meta-chip">
                <span className="ide-mobile-meta-label">Vision</span>
                <span className="ide-mobile-meta-value">{mobileVisionLabel}</span>
              </div>
              <div className="ide-mobile-meta-chip">
                <span className="ide-mobile-meta-label">Power</span>
                <span className="ide-mobile-meta-value">{scoreData ? scoreData.totalScore : "Unscored"}</span>
              </div>
              <div className="ide-mobile-meta-chip">
                <span className="ide-mobile-meta-label">Assist</span>
                <span className="ide-mobile-meta-value">{isPredictive ? "Predictive on" : "Manual"}</span>
              </div>
            </div>
          </section>

          <nav className="ide-mobile-tab-bar" aria-label="Scribe workspace sections">
            {mobileTabs.map((tab) => {
              const isActive = mobileActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`ide-mobile-tab-btn${isActive ? " active" : ""}`}
                  onClick={() => setMobileActiveTab(tab.id)}
                  aria-pressed={isActive}
                  aria-label={`${tab.label} panel`}
                >
                  <span className="ide-mobile-tab-icon" aria-hidden="true">
                    <MobileTabIcon tabId={tab.id} />
                  </span>
                  <span className="ide-mobile-tab-copy">
                    <span className="ide-mobile-tab-label">{tab.label}</span>
                    <span className="ide-mobile-tab-hint">{tab.hint}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <section className={`ide-mobile-stage ide-mobile-stage--${String(currentMobileTab.id || "editor").toLowerCase()}`}>
            <header className="ide-mobile-stage-header">
              <div className="ide-mobile-stage-copy">
                <p className="ide-mobile-stage-eyebrow">{currentMobileTab.eyebrow}</p>
                <h3 className="ide-mobile-stage-title">{currentMobileTab.label}</h3>
                <p className="ide-mobile-stage-description">{currentMobileTab.description}</p>
              </div>
              <span className="ide-mobile-stage-badge">{currentMobileTab.badge}</span>
            </header>
            <div className={`ide-mobile-stage-body${mobileActiveTab === "EDITOR" ? " ide-mobile-stage-body--editor" : ""}`}>
              {activeMobilePanel}
            </div>
          </section>

          <div className="ide-mobile-status-strip" role="status" aria-live="polite">
            <span className={`ide-mobile-status-chip${analysisError ? " is-offline" : ""}`}>
              <span className="status-ready-dot" aria-hidden="true" />
              {analysisError ? "Analysis offline" : "Analysis ready"}
            </span>
            <span className="ide-mobile-status-chip">{`Ln ${cursorPos.line}, Col ${cursorPos.col}`}</span>
            <span className="ide-mobile-status-chip">Syllables {totalSyllables}</span>
            <span className="ide-mobile-status-chip">{mobileVisionLabel}</span>
          </div>
        </main>

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
    <div 
      className="ide-layout-wrapper"
      style={{
        '--ritual-abyss': ritualPalette.abyss,
        '--ritual-panel': ritualPalette.panel,
        '--ritual-parchment': ritualPalette.parchment,
        '--ritual-ink': ritualPalette.ink,
        '--ritual-primary': ritualPalette.primary,
        '--ritual-secondary': ritualPalette.secondary,
        '--ritual-tertiary': ritualPalette.tertiary,
        '--ritual-border': ritualPalette.border,
        '--ritual-glow': ritualPalette.glow,
        '--ritual-aurora-start': ritualPalette.aurora_start,
        '--ritual-aurora-end': ritualPalette.aurora_end,
        '--active-school-glow': ritualPalette.glow + '66', // 40% alpha
      }}
    >
      <TopBar
        title={activeScroll?.title || (isEditable ? "New Scroll" : "Scholomance IDE")}
        onOpenSearch={() => setSidebarTab('SEARCH')}
        showMinimap={showOraclePanel}
        onToggleMinimap={() => setShowOraclePanel(!showOraclePanel)}
        isEditable={isEditable}
        activeScrollId={activeScrollId}
        onEdit={handleEditScroll}
        progression={progression}
        auroraLevel={auroraLevel}
        onCycleAuroraLevel={cycleAuroraLevel}
      />
      <main className="ide-main-content">
        <IDEAmbientCanvas schoolColor={schoolColorHex} />
        <PanelGroup
          className="ide-panel-group"
          direction={isNarrowViewport ? "vertical" : "horizontal"}
        >
          {/* 1. Dedicated Activity Bar (Icons only, far left) */}
          <Panel
            defaultSize={isNarrowViewport ? 10 : 4}
            minSize={isNarrowViewport ? 8 : 4}
            maxSize={isNarrowViewport ? 15 : 6}
            className="ide-activity-bar icon-bar-anchor"
          >
            <div className="activity-icons-col">
              <div className="activity-bar-content">
                {['FILES', 'SEARCH', 'TOOLS'].map((tab) => {
                  const Icon = tab === 'FILES' ? FolderIcon : tab === 'SEARCH' ? SearchIcon : ToolsIcon;
                  return (
                    <button
                      key={tab}
                      className={`activity-item icon-only ${sidebarTab === tab ? 'active' : ''}`}
                      onClick={() => setSidebarTab(tab)}
                      title={tab}
                    >
                      <Icon size={28} />
                    </button>
                  );
                })}
              </div>
              <div className="activity-bar-footer">
                <button className="activity-item icon-only" title="Settings">
                  <SettingsIcon size={24} />
                </button>
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="sidebar-resize-handle" />

          {/* 2. Primary Sidebar (Labels + Content) */}
          <Panel
            defaultSize={isNarrowViewport ? 30 : 20}
            minSize={isNarrowViewport ? 20 : 15}
            className="ide-sidebar expandable-sidebar"
          >
            <div className="sidebar-combined-content">
              {/* Header labels area */}
              <div className="sidebar-labels-header">
                {['EXPLORER', 'ORACLE', 'HEX TOOLS'].map((label, i) => {
                  const tabs = ['FILES', 'SEARCH', 'TOOLS'];
                  return (
                    <button
                      key={label}
                      className={`sidebar-label-btn ${sidebarTab === tabs[i] ? 'active' : ''}`}
                      onClick={() => setSidebarTab(tabs[i])}
                    >
                      <span className="activity-label">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Main content area */}
              <div className="sidebar-body-content">
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
                    seedWord={lexiconSeedWord}
                    selectedSchool={selectedSchool}
                    contextLookup={resolveLexiconContext}
                    onJumpToLine={(line) => {
                      editorRef.current?.jumpToLine?.(line);
                    }}
                    variant="sidebar"
                  />
                )}
                {sidebarTab === 'TOOLS' && (
                  <div className="sidebar-tools">
                    <ToolsSidebar 
                      editorRef={editorRef}
                      isEditable={isEditable}
                      isTruesight={isTruesight}
                      onToggleTruesight={handleToggleTruesight}
                      isPredictive={isPredictive}
                      onTogglePredictive={handleTogglePredictive}
                      mirrored={mirrored}
                      onToggleMirrored={handleToggleMirrored}
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
            </div>
          </Panel>

          <PanelResizeHandle className="sidebar-resize-handle" />
          <Panel defaultSize={settings?.ideLayout?.length === 5 ? settings.ideLayout[3] : (settings?.ideLayout?.[2] ?? (isNarrowViewport ? undefined : 60))} minSize={isNarrowViewport ? "40%" : "30%"}>
            <div className="codex-workspace">
              <div className="document-container">
                {activeScrollId || isEditable ? (
                  <ScrollEditor
                    ref={editorRef}
                    documentIdentity={activeScrollId || "new"}
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
                    analyzedWords={committedAnalysis.analyzedWords}
                    analyzedWordsByIdentity={committedAnalysis.analyzedWordsByIdentity}
                    analyzedWordsByCharStart={committedAnalysis.analyzedWordsByCharStart}
                    activeConnections={overlayConnections}
                    lineSyllableCounts={deepAnalysis?.lineSyllableCounts || []}
                    highlightedLines={effectiveHighlightedLines}
                    pinnedLines={pinnedLines}
                    vowelColors={activeVowelColors}
                    syntaxLayer={deepAnalysis?.syntaxSummary}
                    analysisMode={analysisMode}
                    theme={theme}
                    onWordActivate={handleWordActivate}
                    onCursorChange={setCursorPos}
                    mirrored={mirrored}
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
              <PanelResizeHandle className="sidebar-resize-handle" />
              <Panel 
                defaultSize={settings?.ideLayout?.length === 5 ? settings.ideLayout[4] : (settings?.ideLayout?.[3] ?? 25)}
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

                    {isAnalysisPanelVisible && (
                      <div className="right-panel-section">
                        <div className="right-panel-section-header">
                          <span className="right-panel-section-title">{analysisPanelTitle}</span>
                          <button
                            type="button"
                            className="right-panel-close"
                            onClick={() => handleModeChange(analysisMode)}
                            aria-label={analysisPanelCloseLabel}
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
                          narrativeAMP={narrativeAMP}
                          oracle={oracle}
                          onGroupHover={highlightRhymeGroup}
                          onGroupLeave={clearHighlight}
                          infoBeamEnabled={infoBeamEnabled}
                          onInfoBeamToggle={() => setInfoBeamEnabled((prev) => !prev)}
                          onGroupClick={handleInfoBeamClick}
                          activeInfoBeamFamily={infoBeamFamily}
                          surfaceMode={isAstrologyMode ? "astrology" : "full"}
                          currentLineText={currentLineText}
                          />                      </div>
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

                    {showOraclePanel && (
                      <div className="right-panel-section">
                        <div className="right-panel-section-header">
                          <span className="right-panel-section-title">Lexicon Oracle</span>
                          <button
                            type="button"
                            className="right-panel-close"
                            onClick={() => setShowOraclePanel(false)}
                            aria-label="Close Lexicon Oracle"
                          >×</button>
                        </div>
                        <SearchPanel
                          seedWord={lexiconSeedWord}
                          selectedSchool={selectedSchool}
                          contextLookup={resolveLexiconContext}
                          onJumpToLine={(line) => {
                            editorRef.current?.jumpToLine?.(line);
                          }}
                          variant="rail"
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

                    {!showScorePanel && !isAnalysisPanelVisible && !(infoBeamEnabled && infoBeamFamily) && !showOraclePanel && !(isPredictive && misspellings.length > 0) && (
                      <div className="right-panel-empty">
                        <div className="right-panel-empty-icon">⊘</div>
                        <p>Summon the Lexicon Oracle, Rhyme Astrology, or CODEx Metrics to project analysis here</p>
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
      {isNarrowViewport && showOraclePanel && (
        <FloatingPanel
          id="lexicon-oracle-panel"
          title="Lexicon Oracle"
          onClose={() => setShowOraclePanel(false)}
          defaultX={window.innerWidth - 420}
          defaultY={88}
          defaultWidth={380}
          defaultHeight={520}
          minWidth={280}
          minHeight={240}
          maxWidth={560}
          maxHeight={760}
          zIndex={200}
          className="oracle-floating-panel"
        >
          <SearchPanel
            seedWord={lexiconSeedWord}
            selectedSchool={selectedSchool}
            contextLookup={resolveLexiconContext}
            onJumpToLine={(line) => {
              editorRef.current?.jumpToLine?.(line);
            }}
            variant="floating"
          />
        </FloatingPanel>
      )}

      {isNarrowViewport && isAnalysisPanelVisible && (
        <FloatingPanel
          id={isAstrologyMode ? "astrology-panel" : "analyze-panel"}
          title={analysisPanelTitle}
          onClose={() => handleModeChange(analysisMode)}
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
            narrativeAMP={narrativeAMP}
            oracle={oracle}
            onGroupHover={highlightRhymeGroup}
            onGroupLeave={clearHighlight}
            infoBeamEnabled={infoBeamEnabled}
            onInfoBeamToggle={() => setInfoBeamEnabled((prev) => !prev)}
            onGroupClick={handleInfoBeamClick}
            activeInfoBeamFamily={infoBeamFamily}
            surfaceMode={isAstrologyMode ? "astrology" : "full"}
            currentLineText={currentLineText}
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
