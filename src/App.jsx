import { Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Navigation from "./components/Navigation/Navigation.jsx";
import AtmosphereSync from "./components/AtmosphereSync.jsx";
import { SongProvider } from "./hooks/useCurrentSong.jsx";
import { useAmbientPlayer } from "./hooks/useAmbientPlayer.jsx";
import { ProgressionProvider, useProgression } from "./hooks/useProgression.jsx";
import { CODExProvider } from "./hooks/useCODExPipeline.jsx";
import { AuthProvider } from "./hooks/useAuth.jsx";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion.js";

function AmbientWatchSync({ isWatchRoute }) {
  const { progression } = useProgression();
  const { isPlaying, isTuning, isPaused, pause, play } = useAmbientPlayer(progression.unlockedSchools);
  const shouldResumeAfterWatchRef = useRef(false);

  useEffect(() => {
    if (isWatchRoute) {
      if (isPlaying || isTuning) {
        shouldResumeAfterWatchRef.current = true;
        pause();
      }
      return;
    }

    if (shouldResumeAfterWatchRef.current && isPaused) {
      shouldResumeAfterWatchRef.current = false;
      play();
    }
  }, [isWatchRoute, isPlaying, isTuning, isPaused, pause, play]);
  return null;
}

const fullMotionVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const reducedMotionVariants = {
  initial: {},
  animate: {},
  exit: {},
};

export default function App() {
  const location = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isWatchRoute = location.pathname === "/" || location.pathname.startsWith("/watch");

  const shouldReduceMotion = prefersReducedMotion;
  const pageVariants = shouldReduceMotion ? reducedMotionVariants : fullMotionVariants;

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (main) {
      if (!main.hasAttribute("tabindex")) {
        main.setAttribute("tabindex", "-1");
      }
      main.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  return (
    <CODExProvider>
      <AuthProvider>
        <ProgressionProvider>
          <SongProvider>
            <AtmosphereSync />
            <div className="aurora-background" aria-hidden="true" />
            <div className="vignette" aria-hidden="true" />
            <div className="scanlines" aria-hidden="true" />
            
            <div className="page-container">
              <a href="#main-content" className="skip-link">
                Skip to main content
              </a>
              <Navigation />
              <AmbientWatchSync isWatchRoute={isWatchRoute} />
              <AnimatePresence mode="wait">
                <motion.main
                  key={location.pathname}
                  id="main-content"
                  className="page-content"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" }}
                >
                  <Suspense fallback={<div>Loading...</div>}>
                    <Outlet />
                  </Suspense>
                </motion.main>
              </AnimatePresence>
            </div>
          </SongProvider>
        </ProgressionProvider>
      </AuthProvider>
    </CODExProvider>
  );
}
