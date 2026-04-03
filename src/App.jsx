import { Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Navigation from "./components/Navigation/Navigation.jsx";
import AtmosphereSync from "./components/AtmosphereSync.jsx";
import { SongProvider } from "./hooks/useCurrentSong.jsx";
import { CODExProvider } from "./hooks/useCODExPipeline.jsx";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { ProgressionProvider } from "./hooks/useProgression.jsx";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion.js";
import { MotionInspector } from "./ui/animation/components/MotionInspector";
import { MotionDebugBadge } from "./ui/animation/components/MotionDebugBadge";
import { ViewportChannel } from "./lib/truesight/compiler/viewportBytecode";

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

function AuthScopedProviders({ children }) {
  const { user, isLoading } = useAuth();
  return (
    <ProgressionProvider authReady={!isLoading} isAuthenticated={Boolean(user)}>
      {children}
    </ProgressionProvider>
  );
}

export default function App() {
  const location = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldReduceMotion = prefersReducedMotion;
  const pageVariants = shouldReduceMotion ? reducedMotionVariants : fullMotionVariants;
  const pageContainerRef = useRef(null);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (main) {
      if (!main.hasAttribute("tabindex")) {
        main.setAttribute("tabindex", "-1");
      }
      main.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  // Root Viewport Observer — establishes the "Single Source of Truth" for PixelBrain
  useEffect(() => {
    if (!pageContainerRef.current) return;
    const unsubscribe = ViewportChannel.observe(pageContainerRef.current);
    return unsubscribe;
  }, []);

  return (
    <CODExProvider>
      <AuthProvider>
        <AuthScopedProviders>
          <SongProvider>
            <AtmosphereSync />
            <div className="aurora-background" aria-hidden="true" />
            <div className="vignette" aria-hidden="true" />
            <div className="scanlines" aria-hidden="true" />
            
            {/* Animation AMP Debug Tooling (Phase 4) */}
            {import.meta.env.DEV && (
              <>
                <MotionInspector />
                <MotionDebugBadge />
              </>
            )}

            <div className="page-container" ref={pageContainerRef}>
              <a href="#main-content" className="skip-link">
                Skip to main content
              </a>
              <Navigation />
              <AnimatePresence mode="wait">
                <motion.main
                  key={location.pathname}
                  id="main-content"
                  className="page-content"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15, ease: "easeOut" }}
                >
                  <Suspense fallback={null}>
                    <Outlet />
                  </Suspense>
                </motion.main>
              </AnimatePresence>
            </div>
          </SongProvider>
        </AuthScopedProviders>
      </AuthProvider>
    </CODExProvider>
  );
}
