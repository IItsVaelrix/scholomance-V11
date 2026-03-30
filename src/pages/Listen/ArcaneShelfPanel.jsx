/**
 * ArcaneShelfPanel — Left and right decorative shelving of the Signal Laboratory.
 *
 * Renders CSS-drawn alchemical props, an arcane monitor display, candles,
 * a lamp, and floating bytecode particle effects. Purely decorative — no
 * game logic. Responds to school theme color and isPlaying state.
 */

const BYTECODE_CHARS = [
  '0x', '1A', 'FF', 'E7', 'A3', 'B9', 'f0', 'D4',
  '∂', 'λ', '∑', 'ψ', '∇', '⊕', '⊗', 'φ',
  '01', '10', '11', '00', 'C9', '3F', '7E', '8B',
];

function makeParticles(seed, count = 18) {
  return Array.from({ length: count }, (_, i) => {
    const s = (seed * 7 + i * 13) % 100;
    return {
      id: i,
      char: BYTECODE_CHARS[(seed + i * 3) % BYTECODE_CHARS.length],
      x: 4 + ((s * 9.1 + i * 5.7) % 88),
      y: 4 + ((s * 7.3 + i * 11.9) % 88),
      delay: (i * 0.41 + seed * 0.07) % 5,
      duration: 3.5 + ((i * 0.63 + seed) % 2.8),
      size: 0.52 + ((i * 0.04 + seed * 0.01) % 0.22),
      opacity: 0.12 + ((i * 0.038 + seed * 0.012) % 0.22),
    };
  });
}

const LEFT_PARTICLES  = makeParticles(3);
const RIGHT_PARTICLES = makeParticles(11);

export function ArcaneShelfPanel({
  side = 'left',
  schoolName = 'STANDBY',
  schoolColor = '#c9a227',
  isPlaying = false,
  prefersReducedMotion = false,
}) {
  const isLeft = side === 'left';
  const particles = isLeft ? LEFT_PARTICLES : RIGHT_PARTICLES;

  return (
    <aside
      className={[
        'arcane-shelf',
        `arcane-shelf--${side}`,
        isPlaying ? 'is-active' : '',
        prefersReducedMotion ? 'is-reduced-motion' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {/* ── Bytecode particles ───────────────────────────────────────── */}
      <div className="arcane-shelf__particles">
        {particles.map(p => (
          <span
            key={p.id}
            className="shelf-particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              fontSize: `${p.size}rem`,
              color: schoolColor,
            }}
          >
            {p.char}
          </span>
        ))}
      </div>

      {/* ── Shelf frame ──────────────────────────────────────────────── */}
      <div className="arcane-shelf__wall" />
      <div className="arcane-shelf__frame">

        {/* ─── LEFT PANEL ─────────────────────────────────────────── */}
        {isLeft && <>
          {/* Monitor */}
          <div className="shelf-monitor">
            <div className="shelf-monitor__housing">
              <div className="shelf-monitor__screen">
                <div className="shelf-monitor__scanlines" />
                <div className="shelf-monitor__content">
                  <div className="shelf-monitor__kicker">STATION</div>
                  <div
                    className="shelf-monitor__school"
                    style={{ color: schoolColor }}
                  >
                    {schoolName.toUpperCase()}
                  </div>
                  <div className="shelf-monitor__divider" />
                  <div className="shelf-monitor__prog">SCHOLOMANCE RADIO</div>
                  <div className={`shelf-monitor__status${isPlaying ? ' is-live' : ''}`}>
                    {isPlaying ? '● TRANSMITTING' : '○ STANDBY'}
                  </div>
                </div>
                <div className="shelf-monitor__corner shelf-monitor__corner--tl" />
                <div className="shelf-monitor__corner shelf-monitor__corner--tr" />
                <div className="shelf-monitor__corner shelf-monitor__corner--bl" />
                <div className="shelf-monitor__corner shelf-monitor__corner--br" />
              </div>
              <div className="shelf-monitor__bezel" />
              <div className="shelf-monitor__stand" />
            </div>
          </div>

          {/* Shelf tier 1 — Flask row */}
          <div className="shelf-tier shelf-tier--1">
            <div className="shelf-plank" />
            <div className="shelf-props">
              <div className="alc-flask alc-flask--tall alc-flask--teal">
                <div className="alc-flask__neck" />
                <div className="alc-flask__body">
                  <div className="alc-flask__liquid" />
                  <div className="alc-flask__sparkles" />
                  <div className="alc-flask__shine" />
                </div>
              </div>
              <div className="alc-flask alc-flask--round alc-flask--amber">
                <div className="alc-flask__neck" />
                <div className="alc-flask__body">
                  <div className="alc-flask__liquid" />
                  <div className="alc-flask__sparkles" />
                  <div className="alc-flask__shine" />
                </div>
              </div>
              <div className="alc-vial alc-vial--violet">
                <div className="alc-vial__body">
                  <div className="alc-vial__liquid" />
                  <div className="alc-vial__shine" />
                </div>
                <div className="alc-vial__stopper" />
              </div>
            </div>
          </div>

          {/* Shelf tier 2 — Orb + mortar */}
          <div className="shelf-tier shelf-tier--2">
            <div className="shelf-plank" />
            <div className="shelf-props shelf-props--centered">
              <div className="alc-orb">
                <div
                  className="alc-orb__sphere"
                  style={{ '--orb-color': schoolColor }}
                />
                <div className="alc-orb__ring" />
                <div className="alc-orb__stand" />
                <div
                  className="alc-orb__glow"
                  style={{ background: schoolColor }}
                />
              </div>
              <div className="alc-mortar">
                <div className="alc-mortar__bowl" />
                <div className="alc-mortar__pestle" />
              </div>
            </div>
          </div>

          {/* Shelf tier 3 — Candle trio */}
          <div className="shelf-tier shelf-tier--3">
            <div className="shelf-plank" />
            <div className="shelf-props shelf-props--candles">
              <div className="alc-candle alc-candle--tall">
                <div className="alc-candle__flame">
                  <div className="alc-candle__flame-inner" />
                </div>
                <div className="alc-candle__glow" />
                <div className="alc-candle__body" />
                <div className="alc-candle__base" />
              </div>
              <div className="alc-candle alc-candle--mid">
                <div className="alc-candle__flame">
                  <div className="alc-candle__flame-inner" />
                </div>
                <div className="alc-candle__glow" />
                <div className="alc-candle__body" />
                <div className="alc-candle__base" />
              </div>
              <div className="alc-candle alc-candle--short">
                <div className="alc-candle__flame">
                  <div className="alc-candle__flame-inner" />
                </div>
                <div className="alc-candle__glow" />
                <div className="alc-candle__body" />
                <div className="alc-candle__base" />
              </div>
            </div>
          </div>

          {/* Base — Floor lamp */}
          <div className="shelf-base">
            <div className="alc-lamp alc-lamp--floor">
              <div className="alc-lamp__shade" />
              <div className="alc-lamp__glow" />
              <div className="alc-lamp__stem" />
              <div className="alc-lamp__foot" />
            </div>
          </div>
        </>}

        {/* ─── RIGHT PANEL ─────────────────────────────────────────── */}
        {!isLeft && <>
          {/* Astrolabe */}
          <div className="shelf-astrolabe">
            <div className="astrolabe__housing">
              <div className="astrolabe__ring astrolabe__ring--outer" />
              <div className="astrolabe__ring astrolabe__ring--mid" style={{ borderColor: schoolColor }} />
              <div className="astrolabe__ring astrolabe__ring--inner" />
              <div className="astrolabe__arm" />
              <div className="astrolabe__arm astrolabe__arm--cross" />
              <div className="astrolabe__tick astrolabe__tick--n" />
              <div className="astrolabe__tick astrolabe__tick--e" />
              <div className="astrolabe__tick astrolabe__tick--s" />
              <div className="astrolabe__tick astrolabe__tick--w" />
              <div
                className="astrolabe__center"
                style={{ background: schoolColor, boxShadow: `0 0 12px ${schoolColor}` }}
              />
            </div>
            <div
              className="astrolabe__glow"
              style={{ background: `radial-gradient(circle, ${schoolColor}40 0%, transparent 70%)` }}
            />
            <div className="astrolabe__pedestal" />
          </div>

          {/* Shelf tier 1 — Flasks */}
          <div className="shelf-tier shelf-tier--1">
            <div className="shelf-plank" />
            <div className="shelf-props">
              <div className="alc-flask alc-flask--erlen alc-flask--violet">
                <div className="alc-flask__neck" />
                <div className="alc-flask__body">
                  <div className="alc-flask__liquid" />
                  <div className="alc-flask__bubble alc-flask__bubble--1" />
                  <div className="alc-flask__shine" />
                </div>
              </div>
              <div className="alc-flask alc-flask--tall alc-flask--crimson">
                <div className="alc-flask__neck" />
                <div className="alc-flask__body">
                  <div className="alc-flask__liquid" />
                  <div className="alc-flask__shine" />
                </div>
              </div>
              <div className="alc-vial alc-vial--gold">
                <div className="alc-vial__body">
                  <div className="alc-vial__liquid" />
                  <div className="alc-vial__shine" />
                </div>
                <div className="alc-vial__stopper" />
              </div>
            </div>
          </div>

          {/* Shelf tier 2 — Gem + tome */}
          <div className="shelf-tier shelf-tier--2">
            <div className="shelf-plank" />
            <div className="shelf-props shelf-props--centered">
              <div className="alc-gem">
                <div className="alc-gem__top" />
                <div className="alc-gem__mid" />
                <div className="alc-gem__bot" />
                <div
                  className="alc-gem__glow"
                  style={{ background: `radial-gradient(circle, ${schoolColor}55 0%, transparent 70%)` }}
                />
              </div>
              <div className="alc-tome">
                <div className="alc-tome__cover" />
                <div className="alc-tome__spine" />
                <div className="alc-tome__pages" />
                <div className="alc-tome__clasp" />
                <div className="alc-tome__glyph">✦</div>
              </div>
            </div>
          </div>

          {/* Shelf tier 3 — Candle duo */}
          <div className="shelf-tier shelf-tier--3">
            <div className="shelf-plank" />
            <div className="shelf-props shelf-props--candles">
              <div className="alc-candle alc-candle--tall">
                <div className="alc-candle__flame">
                  <div className="alc-candle__flame-inner" />
                </div>
                <div className="alc-candle__glow" />
                <div className="alc-candle__body" />
                <div className="alc-candle__base" />
              </div>
              <div className="alc-candle alc-candle--mid">
                <div className="alc-candle__flame">
                  <div className="alc-candle__flame-inner" />
                </div>
                <div className="alc-candle__glow" />
                <div className="alc-candle__body" />
                <div className="alc-candle__base" />
              </div>
            </div>
          </div>

          {/* Base — Pedestal lamp */}
          <div className="shelf-base">
            <div className="alc-lamp alc-lamp--pedestal">
              <div className="alc-lamp__shade alc-lamp__shade--ornate" />
              <div className="alc-lamp__glow" />
              <div className="alc-lamp__stem alc-lamp__stem--ornate" />
              <div className="alc-lamp__foot alc-lamp__foot--wide" />
            </div>
          </div>
        </>}

      </div>{/* shelf-frame */}

      {/* Ambient edge lighting */}
      <div className="arcane-shelf__edge-light" />
    </aside>
  );
}
