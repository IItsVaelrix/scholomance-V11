/**
 * SpellCastEffect.jsx
 *
 * School-specific visual overlay that fires during SPELL_FLYING state.
 * Listens to combatBridge 'player:cast' for school identity,
 * renders once then self-clears.
 *
 * Five distinct visual grammars:
 *   SONIC    — purple concentric ripple rings
 *   PSYCHIC  — cyan geometric scan rays
 *   ALCHEMY  — magenta transmutation vortex
 *   WILL     — orange horizontal force blast
 *   VOID     — zinc reality-fracture + glitch static
 */

import { useEffect, useRef, useState } from 'react';
import { combatBridge } from '../combatBridge.js';
import './SpellCastEffect.css';

const EFFECT_DURATION_MS = 1050;
const FALLBACK_SCHOOL = 'sonic';

export function SpellCastEffect({ combatState, prefersReduced }) {
  const [activeSchool, setActiveSchool] = useState(null);
  const pendingRef = useRef(null);
  const timerRef = useRef(null);

  // Capture school from bridge event before state transitions
  useEffect(() => {
    return combatBridge.on('player:cast', ({ school }) => {
      pendingRef.current = (school ?? FALLBACK_SCHOOL).toLowerCase();
    });
  }, []);

  // Fire when combat enters SPELL_FLYING
  useEffect(() => {
    if (combatState !== 'SPELL_FLYING' || prefersReduced) return;

    const school = pendingRef.current ?? FALLBACK_SCHOOL;
    setActiveSchool(school);

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveSchool(null);
    }, EFFECT_DURATION_MS);

    return () => clearTimeout(timerRef.current);
  }, [combatState, prefersReduced]);

  if (!activeSchool) return null;

  return (
    <div
      className={`sce-overlay sce--${activeSchool}`}
      aria-hidden="true"
      role="presentation"
    >
      <SchoolSvg school={activeSchool} />
    </div>
  );
}

// ─── SVG dispatcher ─────────────────────────────────────────────────────────

function SchoolSvg({ school }) {
  switch (school) {
    case 'sonic':   return <SonicSvg />;
    case 'psychic': return <PsychicSvg />;
    case 'alchemy': return <AlchemySvg />;
    case 'will':    return <WillSvg />;
    case 'void':    return <VoidSvg />;
    default:        return <SonicSvg />;
  }
}

// ─── SONIC — five expanding ripple rings + twin sine waves ──────────────────

function SonicSvg() {
  return (
    <svg
      className="sce-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {[0, 1, 2, 3, 4].map(i => (
        <circle
          key={i}
          cx="50" cy="50" r="2"
          className={`sce-sonic-ring sce-sonic-ring--${i}`}
        />
      ))}
      <path
        d="M0,50 Q12.5,38 25,50 T50,50 T75,50 T100,50"
        className="sce-sonic-wave sce-sonic-wave--a"
      />
      <path
        d="M0,50 Q12.5,62 25,50 T50,50 T75,50 T100,50"
        className="sce-sonic-wave sce-sonic-wave--b"
      />
      <circle cx="50" cy="50" r="3" className="sce-sonic-core" />
    </svg>
  );
}

// ─── PSYCHIC — 12 scan rays + rotating hexagon + dashed halo ────────────────

function PsychicSvg() {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const rad = (i * 30 * Math.PI) / 180;
    return {
      x2: 50 + Math.cos(rad) * 68,
      y2: 50 + Math.sin(rad) * 68,
      variant: i % 4,
    };
  });

  return (
    <svg
      className="sce-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {rays.map(({ x2, y2, variant }, i) => (
        <line
          key={i}
          x1="50" y1="50"
          x2={x2.toFixed(2)} y2={y2.toFixed(2)}
          className={`sce-psychic-ray sce-psychic-ray--${variant}`}
        />
      ))}
      <polygon
        points="50,34 62.1,42 62.1,58 50,66 37.9,58 37.9,42"
        className="sce-psychic-hex"
      />
      <circle cx="50" cy="50" r="26" className="sce-psychic-halo" />
      <circle cx="50" cy="50" r="4"  className="sce-psychic-core" />
    </svg>
  );
}

// ─── ALCHEMY — dual vortex arcs + 8 orbiting particles + sigil ring ─────────

function AlchemySvg() {
  const orbs = [
    [50, 24], [67, 32], [74, 50], [67, 68],
    [50, 76], [33, 68], [26, 50], [33, 32],
  ];

  return (
    <svg
      className="sce-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <path
        d="M50,50 C60,35 75,40 70,55 C65,70 50,72 40,62 C30,52 33,38 46,35 C58,32 68,42 62,52"
        className="sce-alchemy-vortex sce-alchemy-vortex--a"
      />
      <path
        d="M50,50 C38,62 23,57 27,43 C31,29 46,27 57,35 C68,43 67,58 56,63 C44,68 32,58 36,47"
        className="sce-alchemy-vortex sce-alchemy-vortex--b"
      />
      {orbs.map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r="1.6"
          className={`sce-alchemy-orb sce-alchemy-orb--${i % 4}`}
        />
      ))}
      <circle cx="50" cy="50" r="7" className="sce-alchemy-sigil" />
    </svg>
  );
}

// ─── WILL — 5 horizontal force lines + 8-point starburst + impact core ──────

function WillSvg() {
  const burst = Array.from({ length: 8 }, (_, i) => {
    const rad = (i * 45 * Math.PI) / 180;
    return {
      x2: (50 + Math.cos(rad) * 28).toFixed(2),
      y2: (50 + Math.sin(rad) * 28).toFixed(2),
      variant: i % 3,
    };
  });

  return (
    <svg
      className="sce-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {[-8, -4, 0, 4, 8].map((offset, i) => (
        <line
          key={i}
          x1="0" y1={50 + offset}
          x2="100" y2={50 + offset}
          className={`sce-will-force sce-will-force--${i}`}
        />
      ))}
      {burst.map(({ x2, y2, variant }, i) => (
        <line
          key={i}
          x1="50" y1="50"
          x2={x2} y2={y2}
          className={`sce-will-burst sce-will-burst--${variant}`}
        />
      ))}
      <circle cx="50" cy="50" r="5" className="sce-will-core" />
    </svg>
  );
}

// ─── VOID — glitch slabs + radial cracks + collapsing maw ───────────────────

function VoidSvg() {
  return (
    <svg
      className="sce-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Glitch displacement bars */}
      <rect x="0"  y="27" width="58" height="7" className="sce-void-glitch sce-void-glitch--0" />
      <rect x="22" y="50" width="76" height="5" className="sce-void-glitch sce-void-glitch--1" />
      <rect x="8"  y="66" width="48" height="4" className="sce-void-glitch sce-void-glitch--2" />
      {/* Radial cracks from (50,50) */}
      <path d="M50,50 L59,31 L63,14"       className="sce-void-crack sce-void-crack--0" />
      <path d="M50,50 L33,61 L21,79"       className="sce-void-crack sce-void-crack--1" />
      <path d="M50,50 L71,56 L89,53"       className="sce-void-crack sce-void-crack--2" />
      <path d="M50,50 L44,27 L50,7"        className="sce-void-crack sce-void-crack--3" />
      {/* Void maw — collapses inward */}
      <circle cx="50" cy="50" r="11" className="sce-void-maw" />
    </svg>
  );
}
