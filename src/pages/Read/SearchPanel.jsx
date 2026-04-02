import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.js';
import { useWordLookup } from '../../hooks/useWordLookup.jsx';
import { ScholomanceDictionaryAPI } from '../../lib/scholomanceDictionary.api.js';
import { getCachedWord, setCachedWord } from '../../lib/platform/wordCache.js';
import './IDE.css';

const BOOT_LINES = [
  'INIT archive lattice...',
  'TRACE phoneme registry...',
  'RESOLVE resonance channels...',
];

const EMPTY_CHANNELS = Object.freeze({
  definitions: [],
  synonyms: [],
  antonyms: [],
  rhymes: [],
  slantRhymes: [],
});

function normalizeLookupWord(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function formatLookupSource(source) {
  if (!source) return 'standby';
  return String(source).replace(/[^a-z0-9+_-]+/gi, ' ').trim().toLowerCase() || 'standby';
}

function toTitleCase(word) {
  const value = String(word || '').trim();
  if (!value) return '';
  return value.replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function buildChannelGroups(entry, scrollContext) {
  const data = entry || EMPTY_CHANNELS;
  return [
    {
      id: 'definitions',
      label: 'Definition Stack',
      words: uniqueStrings(data.definitions?.length ? data.definitions : (data.definition?.text ? [data.definition.text] : [])),
      tone: 'definition',
    },
    {
      id: 'synonyms',
      label: 'Semantic Kin',
      words: uniqueStrings(data.synonyms),
      tone: 'synonym',
    },
    {
      id: 'antonyms',
      label: 'Dissonant Kin',
      words: uniqueStrings(data.antonyms),
      tone: 'antonym',
    },
    {
      id: 'rhymes',
      label: 'Echo Field',
      words: uniqueStrings(data.rhymes),
      tone: 'rhyme',
    },
    {
      id: 'slantRhymes',
      label: 'Shadow Echo',
      words: uniqueStrings(data.slantRhymes),
      tone: 'slant',
    },
    {
      id: 'assonance',
      label: 'Assonance Field',
      words: uniqueStrings(scrollContext?.assonanceLinks?.map((link) => link.word)),
      tone: 'assonance',
    },
  ].filter((group) => group.words.length > 0);
}

export default function SearchPanel({
  seedWord = '',
  selectedSchool = 'DEFAULT',
  contextLookup = null,
  onJumpToLine = null,
  variant = 'sidebar',
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const inputIdRef = useRef(`oracle-query-${Math.random().toString(36).slice(2, 9)}`);
  const userOverrideRef = useRef(false);
  const seedRef = useRef('');

  const [query, setQuery] = useState('');
  const [resolvedWord, setResolvedWord] = useState('');
  const [lookupOverride, setLookupOverride] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const {
    lookup,
    data,
    isLoading,
    error,
    reset,
    source,
  } = useWordLookup();

  const normalizedQuery = useMemo(() => normalizeLookupWord(query), [query]);
  const activeEntry = lookupOverride ?? data;
  const resolvedLookupWord = useMemo(
    () => normalizeLookupWord(activeEntry?.word || resolvedWord || normalizedQuery),
    [activeEntry?.word, normalizedQuery, resolvedWord]
  );
  const scrollContext = useMemo(
    () => (typeof contextLookup === 'function' ? contextLookup(resolvedLookupWord) : null),
    [contextLookup, resolvedLookupWord]
  );
  const channelGroups = useMemo(
    () => buildChannelGroups(activeEntry, scrollContext),
    [activeEntry, scrollContext]
  );
  const definitionRows = useMemo(
    () => uniqueStrings(activeEntry?.definitions?.length ? activeEntry.definitions : (activeEntry?.definition?.text ? [activeEntry.definition.text] : [])),
    [activeEntry]
  );

  const performLookup = useCallback(async (nextWord, options = {}) => {
    const normalized = normalizeLookupWord(nextWord);
    if (!normalized) return;

    if (options.markUser !== false) {
      userOverrideRef.current = true;
    }

    setQuery(normalized);
    setResolvedWord(normalized);
    setLookupOverride(null);
    reset();

    const cached = getCachedWord(normalized);
    if (cached) {
      setLookupOverride(cached);
      return;
    }

    await lookup(normalized);
  }, [lookup, reset]);

  useEffect(() => {
    if (!data || !resolvedWord) return;
    const normalizedDataWord = normalizeLookupWord(data.word || resolvedWord);
    if (!normalizedDataWord) return;
    setCachedWord(normalizedDataWord, data);
  }, [data, resolvedWord]);

  useEffect(() => {
    const normalizedSeed = normalizeLookupWord(seedWord);
    if (!normalizedSeed || normalizedSeed === seedRef.current) return;
    seedRef.current = normalizedSeed;

    if (userOverrideRef.current && normalizedQuery && normalizedQuery !== normalizedSeed) {
      return;
    }

    void performLookup(normalizedSeed, { markUser: false });
  }, [normalizedQuery, performLookup, seedWord]);

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setSuggestions([]);
      setIsSuggesting(false);
      return undefined;
    }

    let isCancelled = false;
    const timeoutId = setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const nextSuggestions = await ScholomanceDictionaryAPI.suggest(normalizedQuery, { limit: 8 });
        if (!isCancelled) {
          setSuggestions(uniqueStrings(nextSuggestions).filter((word) => normalizeLookupWord(word) !== normalizedQuery));
        }
      } catch (_error) {
        if (!isCancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSuggesting(false);
        }
      }
    }, 180);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [normalizedQuery]);

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    void performLookup(query);
  }, [performLookup, query]);

  const handleClear = useCallback(() => {
    userOverrideRef.current = false;
    setQuery('');
    setResolvedWord('');
    setLookupOverride(null);
    setSuggestions([]);
    reset();
  }, [reset]);

  const handleSuggestionSelect = useCallback((word) => {
    void performLookup(word);
  }, [performLookup]);

  const statusTone = error
    ? 'error'
    : isLoading
      ? 'loading'
      : (activeEntry || scrollContext)
        ? 'resolved'
        : 'idle';

  const headerWord = activeEntry?.word || resolvedLookupWord || 'awaiting query';
  const partOfSpeech = uniqueStrings(activeEntry?.pos).slice(0, 3).join(' / ') || 'lexeme';
  const sourceLabel = formatLookupSource(source || (lookupOverride ? 'cache' : null));
  const revealMotion = prefersReducedMotion
    ? { initial: false, animate: false }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };
  const streamMotionProps = prefersReducedMotion
    ? {}
    : {
        initial: 'hidden',
        animate: 'visible',
        variants: {
          hidden: {},
          visible: {
            transition: {
              staggerChildren: 0.035,
            },
          },
        },
      };
  const streamLineMotionProps = prefersReducedMotion
    ? {}
    : {
        variants: {
          hidden: { opacity: 0, y: 5 },
          visible: {
            opacity: 1,
            y: 0,
            transition: {
              duration: 0.2,
              ease: [0.22, 1, 0.36, 1],
            },
          },
        },
      };

  return (
    <div
      className={`search-panel search-panel--oracle search-panel--${variant}`}
      data-school={selectedSchool}
      data-status={statusTone}
    >
      <div className="oracle-shell">
        <div className="oracle-chrome" aria-hidden="true">
          <span className="oracle-chrome-dot oracle-chrome-dot--hot" />
          <span className="oracle-chrome-dot oracle-chrome-dot--warm" />
          <span className="oracle-chrome-dot oracle-chrome-dot--cool" />
          <span className="oracle-chrome-label">PIXELBRAIN LEXICON ORACLE</span>
        </div>

        <form className="oracle-query-form" onSubmit={handleSubmit}>
          <label className="oracle-query-prefix" htmlFor={inputIdRef.current}>
            archive://
          </label>
          <input
            id={inputIdRef.current}
            type="search"
            value={query}
            onChange={(event) => {
              userOverrideRef.current = true;
              setQuery(event.target.value);
            }}
            className="oracle-query-input"
            placeholder="summon a word, echo family, or meaning shard"
            autoComplete="off"
            spellCheck="false"
            aria-label="Search the lexicon oracle"
          />
          {query && (
            <button type="button" className="oracle-query-clear" onClick={handleClear} aria-label="Clear query">
              reset
            </button>
          )}
          <button type="submit" className="oracle-query-submit">
            resolve
          </button>
        </form>

        <div className="oracle-signal-strip" aria-label="Lexicon oracle status">
          <span className="oracle-signal-pill">{statusTone}</span>
          <span className="oracle-signal-pill">source::{sourceLabel}</span>
          <span className="oracle-signal-pill">
            scroll::{scrollContext?.foundInScroll ? `${scrollContext.totalOccurrences} bound` : 'unbound'}
          </span>
          <span className="oracle-signal-pill">
            query::{resolvedLookupWord || '--'}
          </span>
        </div>

        {(suggestions.length > 0 || isSuggesting) && (
          <div className="oracle-suggestion-row" aria-label="Suggested words">
            {isSuggesting && suggestions.length === 0 ? (
              <span className="oracle-suggestion-meta">predicting archive matches...</span>
            ) : (
              suggestions.map((word) => (
                <button
                  key={word}
                  type="button"
                  className="oracle-suggestion-chip"
                  onClick={() => handleSuggestionSelect(word)}
                >
                  {word}
                </button>
              ))
            )}
          </div>
        )}

        <div className="oracle-feed" role="region" aria-live="polite" aria-label="Lexicon terminal output">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="oracle-loading"
                className="oracle-boot"
                {...revealMotion}
                transition={{ duration: 0.24 }}
              >
                {BOOT_LINES.map((line, index) => (
                  <motion.div
                    key={line}
                    className="oracle-boot-line"
                    initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }}
                    animate={prefersReducedMotion ? false : { opacity: 1, x: 0 }}
                    transition={prefersReducedMotion ? undefined : { delay: index * 0.09, duration: 0.22 }}
                  >
                    <span className="oracle-boot-prompt">&gt;&gt;</span>
                    <span>{line}</span>
                  </motion.div>
                ))}
              </motion.div>
            ) : (activeEntry || scrollContext || error || normalizedQuery) ? (
              <motion.div
                key={`oracle-${headerWord}`}
                className="oracle-stack"
                {...revealMotion}
                transition={{ duration: 0.24 }}
              >
                <motion.section
                  className="oracle-section oracle-section--summary"
                  {...streamMotionProps}
                >
                  <div className="oracle-section-head">
                    <span className="oracle-section-index">01</span>
                    <span className="oracle-section-label">Capability Truth</span>
                  </div>
                  <div className="oracle-summary-grid">
                    <motion.div className="oracle-summary-cell" {...streamLineMotionProps}>
                      <span className="oracle-summary-key">word</span>
                      <span className="oracle-summary-value oracle-summary-value--major">
                        {String(headerWord || '').toUpperCase()}
                      </span>
                    </motion.div>
                    <motion.div className="oracle-summary-cell" {...streamLineMotionProps}>
                      <span className="oracle-summary-key">class</span>
                      <span className="oracle-summary-value">{partOfSpeech}</span>
                    </motion.div>
                    <motion.div className="oracle-summary-cell" {...streamLineMotionProps}>
                      <span className="oracle-summary-key">ipa</span>
                      <span className="oracle-summary-value">{activeEntry?.ipa || 'unresolved'}</span>
                    </motion.div>
                    <motion.div className="oracle-summary-cell" {...streamLineMotionProps}>
                      <span className="oracle-summary-key">echo key</span>
                      <span className="oracle-summary-value">{scrollContext?.core?.rhymeKey || 'pending'}</span>
                    </motion.div>
                  </div>
                </motion.section>

                {definitionRows.length > 0 && (
                  <motion.section
                    className="oracle-section"
                    {...streamMotionProps}
                  >
                    <div className="oracle-section-head">
                      <span className="oracle-section-index">02</span>
                      <span className="oracle-section-label">Archive Stack</span>
                    </div>
                    <div className="oracle-log-list">
                      {definitionRows.map((definition, index) => (
                        <motion.div
                          key={`${definition}-${index}`}
                          className="oracle-log-row"
                          {...streamLineMotionProps}
                        >
                          <span className="oracle-log-index">{String(index + 1).padStart(2, '0')}</span>
                          <span className="oracle-log-text">{definition}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.section>
                )}

                {scrollContext && (scrollContext.foundInScroll || scrollContext.resonanceLinks.length > 0 || scrollContext.assonanceLinks.length > 0) && (
                  <motion.section
                    className="oracle-section"
                    {...streamMotionProps}
                  >
                    <div className="oracle-section-head">
                      <span className="oracle-section-index">03</span>
                      <span className="oracle-section-label">Measured Reality</span>
                    </div>
                    <div className="oracle-summary-grid oracle-summary-grid--context">
                      <motion.div className="oracle-summary-cell" {...streamLineMotionProps}>
                        <span className="oracle-summary-key">vowel family</span>
                        <span className="oracle-summary-value">{scrollContext?.core?.vowelFamily || 'unknown'}</span>
                      </motion.div>
                      <motion.div className="oracle-summary-cell" {...streamLineMotionProps}>
                        <span className="oracle-summary-key">school</span>
                        <span className="oracle-summary-value">
                          {scrollContext?.core?.schoolGlyph || '+'} {scrollContext?.core?.schoolName || 'unbound'}
                        </span>
                      </motion.div>
                      <motion.div className="oracle-summary-cell" {...streamLineMotionProps}>
                        <span className="oracle-summary-key">syllables</span>
                        <span className="oracle-summary-value">{scrollContext?.core?.syllableCount || '--'}</span>
                      </motion.div>
                      <motion.div className="oracle-summary-cell" {...streamLineMotionProps}>
                        <span className="oracle-summary-key">occurrences</span>
                        <span className="oracle-summary-value">{scrollContext.totalOccurrences}</span>
                      </motion.div>
                    </div>

                    {scrollContext.occurrences.length > 0 && (
                      <div className="oracle-line-bank">
                        {scrollContext.occurrences.map((occurrence, index) => (
                          <motion.button
                            key={`${occurrence.line}-${occurrence.charStart}-${index}`}
                            type="button"
                            className="oracle-line-link"
                            onClick={() => onJumpToLine?.(occurrence.line)}
                            {...streamLineMotionProps}
                          >
                            <span className="oracle-line-link-label">line {occurrence.line}</span>
                            <span className="oracle-line-link-text">{occurrence.word}</span>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </motion.section>
                )}

                {channelGroups.length > 0 && (
                  <motion.section
                    className="oracle-section"
                    {...streamMotionProps}
                  >
                    <div className="oracle-section-head">
                      <span className="oracle-section-index">04</span>
                      <span className="oracle-section-label">Signal Channels</span>
                    </div>
                    <div className="oracle-channel-stack">
                      {channelGroups.map((group) => (
                        <motion.div
                          key={group.id}
                          className="oracle-channel-block"
                          data-tone={group.tone}
                          {...streamLineMotionProps}
                        >
                          <div className="oracle-channel-label">{group.label}</div>
                          <div className="oracle-token-bank">
                            {group.words.map((word) => (
                              <button
                                key={`${group.id}-${word}`}
                                type="button"
                                className="oracle-token"
                                data-tone={group.tone}
                                onClick={() => handleSuggestionSelect(word)}
                              >
                                {toTitleCase(word)}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.section>
                )}

                {scrollContext?.astrology && (
                  <motion.section
                    className="oracle-section"
                    {...streamMotionProps}
                  >
                    <div className="oracle-section-head">
                      <span className="oracle-section-index">05</span>
                      <span className="oracle-section-label">Astrology Trace</span>
                    </div>
                    <div className="oracle-summary-grid oracle-summary-grid--context">
                      <motion.div className="oracle-summary-cell" {...streamLineMotionProps}>
                        <span className="oracle-summary-key">sign</span>
                        <span className="oracle-summary-value">{scrollContext.astrology.sign || 'unmarked'}</span>
                      </motion.div>
                      <motion.div className="oracle-summary-cell" {...streamLineMotionProps}>
                        <span className="oracle-summary-key">cluster count</span>
                        <span className="oracle-summary-value">{scrollContext.astrology.clusters?.length || 0}</span>
                      </motion.div>
                    </div>
                    {scrollContext.astrology.topMatches?.length > 0 && (
                      <div className="oracle-token-bank">
                        {scrollContext.astrology.topMatches.map((match, index) => {
                          const token = String(match?.token || '').trim();
                          if (!token) return null;
                          const score = Math.round((Number(match?.overallScore) || 0) * 100);
                          return (
                            <button
                              key={`${token}-${index}`}
                              type="button"
                              className="oracle-token"
                              data-tone="assonance"
                              onClick={() => handleSuggestionSelect(token)}
                            >
                              {toTitleCase(token)} [{score}%]
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.section>
                )}

                {scrollContext?.resonanceLinks?.length > 0 && (
                  <motion.section
                    className="oracle-section"
                    {...streamMotionProps}
                  >
                    <div className="oracle-section-head">
                      <span className="oracle-section-index">06</span>
                      <span className="oracle-section-label">Live Resonance</span>
                    </div>
                    <div className="oracle-log-list">
                      {scrollContext.resonanceLinks.map((link, index) => (
                        <motion.button
                          key={`${link.word}-${link.line}-${index}`}
                          type="button"
                          className="oracle-log-row oracle-log-row--interactive"
                          onClick={() => onJumpToLine?.(link.line)}
                          {...streamLineMotionProps}
                        >
                          <span className="oracle-log-index">{String(index + 1).padStart(2, '0')}</span>
                          <span className="oracle-log-text">
                            {link.word} :: {link.type} :: L{link.line || '--'} :: {Math.round((link.score || 0) * 100)}%
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.section>
                )}

                {error && !activeEntry && (
                  <motion.section
                    className="oracle-section oracle-section--error"
                    {...streamMotionProps}
                  >
                    <div className="oracle-section-head">
                      <span className="oracle-section-index">XX</span>
                      <span className="oracle-section-label">Signal Fault</span>
                    </div>
                    <motion.div className="oracle-error-line" {...streamLineMotionProps}>
                      {error}
                    </motion.div>
                  </motion.section>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="oracle-idle"
                className="oracle-idle"
                {...revealMotion}
                transition={{ duration: 0.24 }}
              >
                <p className="oracle-idle-title">Lexicon oracle standing by.</p>
                <p className="oracle-idle-copy">
                  Query a word to stream definitions, rhyme families, slant echoes, and live scroll resonance into the chamber.
                </p>
                <div className="oracle-idle-prompt">
                  <span>&gt;&gt;</span>
                  <span>try: dusk, fracture, vow, ember</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
