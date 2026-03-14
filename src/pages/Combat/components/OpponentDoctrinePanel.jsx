import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

function resolveText(value) {
  if (typeof value === 'string') {
    const text = value.trim();
    return text || null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (value && typeof value === 'object') {
    const candidates = [value.label, value.text, value.name, value.title, value.id, value.key];
    for (const candidate of candidates) {
      const resolved = resolveText(candidate);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
}

function normalizeChipList(values, prefix) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value, index) => {
      if (!value) {
        return null;
      }

      if (typeof value === 'string' || typeof value === 'number') {
        const label = String(value).trim();
        if (!label) {
          return null;
        }

        return {
          id: `${prefix}-${label.toLowerCase()}`,
          label,
          detail: null,
        };
      }

      if (typeof value !== 'object') {
        return null;
      }

      const label = resolveText(value);
      if (!label) {
        return null;
      }

      const detail = resolveText(
        value.detail
        ?? value.description
        ?? value.explanation
        ?? value.durationLabel
        ?? value.school
      );

      return {
        id: resolveText(value.id) || resolveText(value.key) || `${prefix}-${index}`,
        label,
        detail: detail && detail !== label ? detail : null,
      };
    })
    .filter(Boolean);
}

function normalizeArenaCondition(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const label = String(value).trim();
    return label ? { label, detail: null } : null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const label = resolveText(value);
  if (!label) {
    return null;
  }

  const detail = resolveText(
    value.detail
    ?? value.description
    ?? value.school
    ?? value.durationLabel
    ?? value.kind
  );

  return {
    label,
    detail: detail && detail !== label ? detail : null,
  };
}

function joinAnnouncementLabels(items) {
  return items.map((item) => item.label).join(', ');
}

export function OpponentDoctrinePanel({
  opponent,
  profileType,
  doctrine,
  passiveLabel,
  phase,
  telegraph,
  telegraphKey,
  moveId,
  moveLabel,
  moveSchool,
  statusesApplied,
  stolenTokens,
  arenaCondition,
  prefersReduced = false,
}) {
  const opponentName = resolveText(opponent?.name) || 'The Opponent';
  const school = resolveText(opponent?.school);
  const schoolName = resolveText(opponent?.schoolName) || school;
  const resolvedProfileType = resolveText(profileType ?? opponent?.profileType);
  const resolvedDoctrine = resolveText(doctrine ?? opponent?.doctrine ?? opponent?.subtitle);
  const resolvedPassive = resolveText(passiveLabel ?? opponent?.passiveLabel);
  const resolvedPhase = resolveText(phase ?? opponent?.phase);
  const resolvedTelegraph = resolveText(telegraph ?? opponent?.telegraph);
  const resolvedTelegraphKey = resolveText(telegraphKey ?? opponent?.telegraphKey) || resolvedTelegraph;
  const resolvedMoveLabel = resolveText(moveLabel ?? opponent?.moveLabel);
  const resolvedMoveId = resolveText(moveId ?? opponent?.moveId) || resolvedMoveLabel;
  const resolvedMoveSchool = resolveText(moveSchool ?? opponent?.moveSchool);
  const resolvedStatuses = normalizeChipList(statusesApplied ?? opponent?.statusesApplied, 'status');
  const resolvedStolenTokens = normalizeChipList(stolenTokens ?? opponent?.stolenTokens, 'token');
  const resolvedArenaCondition = normalizeArenaCondition(arenaCondition ?? opponent?.arenaCondition);
  const statusSignature = resolvedStatuses.map((item) => item.id).join('|');
  const stolenTokenSignature = resolvedStolenTokens.map((item) => item.id).join('|');
  const [announcement, setAnnouncement] = useState('');
  const previousRef = useRef({
    telegraphKey: null,
    phase: null,
    moveId: null,
    statuses: '',
    stolenTokens: '',
  });

  const hasDetail = Boolean(
    resolvedTelegraph
    || resolvedMoveLabel
    || resolvedPhase
    || resolvedArenaCondition
    || resolvedStatuses.length
    || resolvedStolenTokens.length
  );

  useEffect(() => {
    const previous = previousRef.current;
    const nextMessages = [];

    if (resolvedTelegraph && resolvedTelegraphKey && resolvedTelegraphKey !== previous.telegraphKey) {
      nextMessages.push(`Telegraph from ${opponentName}: ${resolvedTelegraph}.`);
    }

    if (resolvedPhase && previous.phase && resolvedPhase !== previous.phase) {
      nextMessages.push(`${opponentName} shifts into ${resolvedPhase}.`);
    }

    if (resolvedMoveLabel && resolvedMoveId && resolvedMoveId !== previous.moveId) {
      nextMessages.push(`${opponentName} casts ${resolvedMoveLabel}.`);
    }

    if (statusSignature && statusSignature !== previous.statuses) {
      const previousStatuses = new Set(previous.statuses.split('|').filter(Boolean));
      const addedStatuses = resolvedStatuses.filter((item) => !previousStatuses.has(item.id));
      if (addedStatuses.length > 0) {
        nextMessages.push(`Statuses applied: ${joinAnnouncementLabels(addedStatuses)}.`);
      }
    }

    if (stolenTokenSignature && stolenTokenSignature !== previous.stolenTokens) {
      const previousTokens = new Set(previous.stolenTokens.split('|').filter(Boolean));
      const addedTokens = resolvedStolenTokens.filter((item) => !previousTokens.has(item.id));
      if (addedTokens.length > 0) {
        nextMessages.push(`Tokens stolen: ${joinAnnouncementLabels(addedTokens)}.`);
      }
    }

    setAnnouncement(nextMessages.join(' '));
    previousRef.current = {
      telegraphKey: resolvedTelegraphKey,
      phase: resolvedPhase,
      moveId: resolvedMoveId,
      statuses: statusSignature,
      stolenTokens: stolenTokenSignature,
    };
  }, [
    opponentName,
    resolvedMoveId,
    resolvedMoveLabel,
    resolvedPhase,
    resolvedStatuses,
    resolvedStolenTokens,
    resolvedTelegraph,
    resolvedTelegraphKey,
    statusSignature,
    stolenTokenSignature,
  ]);

  const shouldRender = Boolean(
    resolvedProfileType
    || resolvedDoctrine
    || resolvedPassive
    || resolvedPhase
    || resolvedTelegraph
    || resolvedMoveLabel
    || resolvedStatuses.length
    || resolvedStolenTokens.length
    || resolvedArenaCondition
    || schoolName
  );

  if (!shouldRender) {
    return null;
  }

  return (
    <section
      className="combat-doctrine-panel"
      data-school={school || undefined}
      aria-label="Opponent doctrine surface"
    >
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* ── Identity strip: always visible, single compact row ── */}
      <div className="combat-doctrine-identity">
        <h2 className="combat-doctrine-name">{opponentName}</h2>
        {resolvedDoctrine && (
          <span className="combat-doctrine-subtitle">{resolvedDoctrine}</span>
        )}
        <div className="combat-doctrine-tags">
          {resolvedProfileType && (
            <span className="combat-doctrine-tag">
              <abbr title="Profile type">{resolvedProfileType}</abbr>
            </span>
          )}
          {schoolName && (
            <span className="combat-doctrine-tag combat-doctrine-tag--school">
              {schoolName}
            </span>
          )}
          {resolvedPassive && (
            <span className="combat-doctrine-tag combat-doctrine-tag--passive" title="Passive ability">
              {resolvedPassive}
            </span>
          )}
          {resolvedPhase && (
            <span className="combat-doctrine-tag combat-doctrine-tag--phase" aria-label={`Phase: ${resolvedPhase}`}>
              {resolvedPhase}
            </span>
          )}
        </div>
      </div>

      {/* ── Live combat detail: telegraph, move, statuses — scrolls internally ── */}
      {hasDetail && (
        <div className="combat-doctrine-detail">
          <AnimatePresence initial={false} mode="popLayout">
            {resolvedTelegraph && (
              <motion.div
                key={`telegraph-${resolvedTelegraphKey || resolvedTelegraph}`}
                className="combat-doctrine-banner combat-doctrine-banner--telegraph"
                role="status"
                aria-live="polite"
                initial={prefersReduced ? {} : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? {} : { opacity: 0, y: -3 }}
                transition={{ duration: prefersReduced ? 0 : 0.22, ease: 'easeOut' }}
              >
                <span className="combat-doctrine-banner-label">Telegraph</span>
                <span className="combat-doctrine-banner-text">{resolvedTelegraph}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {resolvedArenaCondition && (
            <div className="combat-doctrine-inline-card">
              <span className="combat-doctrine-card-label">Arena</span>
              <strong className="combat-doctrine-card-title">{resolvedArenaCondition.label}</strong>
              {resolvedArenaCondition.detail && (
                <span className="combat-doctrine-card-detail">{resolvedArenaCondition.detail}</span>
              )}
            </div>
          )}

          <AnimatePresence initial={false} mode="popLayout">
            {resolvedMoveLabel && (
              <motion.div
                key={`move-${resolvedMoveId || resolvedMoveLabel}`}
                className="combat-doctrine-inline-card combat-doctrine-inline-card--move"
                role="status"
                aria-live="polite"
                initial={prefersReduced ? {} : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={prefersReduced ? {} : { opacity: 0, scale: 0.98 }}
                transition={{ duration: prefersReduced ? 0 : 0.2, ease: 'easeOut' }}
              >
                <span className="combat-doctrine-card-label">Move</span>
                <strong className="combat-doctrine-card-title">{resolvedMoveLabel}</strong>
                {resolvedMoveSchool && (
                  <span className="combat-doctrine-card-detail">{resolvedMoveSchool}</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {resolvedStatuses.length > 0 && (
            <div className="combat-doctrine-chip-row" role="list" aria-label="Opponent statuses">
              <span className="combat-doctrine-chip-label">Status</span>
              {resolvedStatuses.map((status) => (
                <span
                  key={status.id}
                  className="combat-doctrine-chip"
                  role="listitem"
                  aria-label={status.detail ? `${status.label}: ${status.detail}` : status.label}
                >
                  <strong>{status.label}</strong>
                  {status.detail && <span>{status.detail}</span>}
                </span>
              ))}
            </div>
          )}

          {resolvedStolenTokens.length > 0 && (
            <div className="combat-doctrine-chip-row" role="list" aria-label="Stolen tokens">
              <span className="combat-doctrine-chip-label">Stolen</span>
              {resolvedStolenTokens.map((token) => (
                <span
                  key={token.id}
                  className="combat-doctrine-chip combat-doctrine-chip--stolen"
                  role="listitem"
                  aria-label={token.detail ? `${token.label}: ${token.detail}` : token.label}
                >
                  <strong>{token.label}</strong>
                  {token.detail && <span>{token.detail}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
