import { motion } from "framer-motion";
import { useCurrentSong } from "../../hooks/useCurrentSong.jsx";
import { COLORS } from "../../data/library";

export default function WatchPage() {
  const { currentSong } = useCurrentSong();
  const accent = COLORS[currentSong.school] || COLORS.VOID;

  return (
    <section className="section min-h-screen">
      <div className="container">
        <header className="section-header">
          <div className="kicker">Sonic Thaumaturgy Interface</div>
          <h1 className="title">A ritual UI for rhythm, rhyme, and phoneme alchemy.</h1>
          <p className="subtitle">
            Watch the current invocation, then tune the radio by school-frequency.
            When you&apos;re ready, step into the Codex and inspect the phonetic skeleton of a word.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className={`badge badge--${currentSong.school.toLowerCase()}`}>
              {currentSong.school}
            </span>
            <span className="badge glass">
              <span style={{ color: accent }}>{currentSong.title}</span>
            </span>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="relative max-w-4xl mx-auto"
        >
          <div className="glass-strong p-8 rounded-2xl border-bold shadow-elevated">
            {/* Screen */}
            <div className="relative aspect-video rounded-lg overflow-hidden glass-strong border-soft">
              <iframe
                className="w-full h-full border-0"
                title={`YouTube player: ${currentSong.title}`}
                src={`https://www.youtube.com/embed/${currentSong.yt}?autoplay=0&rel=0&modestbranding=1`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Bottom panel with info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="glass p-4 rounded-lg">
                <div className="kicker mb-1">SIGNAL</div>
                <div className="font-mono text-lg" style={{ color: accent }}>{currentSong.school}</div>
              </div>
              <div className="glass p-4 rounded-lg">
                <div className="kicker mb-1">TRACK</div>
                <div className="font-mono text-lg">{currentSong.title}</div>
              </div>
              <div className="glass p-4 rounded-lg">
                <div className="kicker mb-1">STATUS</div>
                <div className="font-mono text-lg text-primary animate-pulse">LOCKED</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
