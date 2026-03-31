import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { LINKS } from "../../data/library";
import { useTheme } from "../../hooks/useTheme.jsx";
import { useAuth } from "../../hooks/useAuth.jsx";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import { preloadRoute } from "../../lib/routes.js";

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

function normalizeAdminList(rawValue) {
  return String(rawValue || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminUser(user) {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  if (String(user.role || "").toLowerCase() === "admin") return true;

  const adminAllowlist = normalizeAdminList(import.meta.env.VITE_ADMIN_USERNAMES || "admin");
  const username = String(user.username || "").toLowerCase();
  const email = String(user.email || "").toLowerCase();

  return adminAllowlist.includes(username) || adminAllowlist.includes(email);
}

const MOBILE_ROUTE_COPY = {
  watch: "Witness the live arena and current ritual signal.",
  listen: "Tune stations, broadcasts, and ambient transmission.",
  read: "Compose scrolls and inspect their hidden anatomy.",
  combat: "Cast verses into live conflict and scoring.",
  nexus: "Survey unlocked paths, schools, and progression.",
  collab: "Coordinate agent work and active pipelines.",
  profile: "Review account standing and inner-sanctum access.",
  auth: "Enter the portal and secure your chamber.",
};

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  const activeSection = location.pathname.replace("/", "") || "watch";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [navigatingPath, setNavigatingPath] = useState(null);
  const navTimeoutRef = useRef(null);
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const prefersReducedMotion = usePrefersReducedMotion();
  const canAccessCollab = isAdminUser(user);
  const nextThemeLabel = theme === "dark" ? "light" : "dark";
  const ThemeIcon = theme === "dark" ? SunIcon : MoonIcon;
  const navLinks = LINKS.filter((link) => link.id !== "collab" || canAccessCollab);

  const allLinks = [
    ...navLinks,
    {
      id: user ? "profile" : "auth",
      path: user ? "/profile" : "/auth",
      label: user ? user.username : "Portal",
    },
  ];

  const handleNav = useCallback((path) => {
    if (location.pathname === path) {
      setIsMenuOpen(false);
      setNavigatingPath(null);
      return;
    }
    
    setNavigatingPath(path);
    startTransition(() => {
      navigate(path);
    });
  }, [navigate, location.pathname]);

  // Reset navigating state when location changes
  useEffect(() => {
    setNavigatingPath(null);
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current); };
  }, []);

  const handleToggle = useCallback(() => {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }
    setIsMenuOpen((prev) => !prev);
    setNavigatingPath(null);
  }, []);

  // Magical nav: select link → glow animation → navigate quickly
  const handleMobileNavClick = useCallback((e, linkPath) => {
    e.preventDefault();
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(5);
    }
    if (navigatingPath) return; // already transitioning
    handleNav(linkPath);
  }, [navigatingPath, handleNav]);

  const overlayTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.26, ease: "easeOut" };

  return (
    <>
      <nav className="primary-nav" aria-label="Primary navigation">
        <div className="nav-inner">
          <motion.button
            className="nav-brand font-bold"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            onClick={handleToggle}
            whileTap={{ scale: 0.96 }}
            animate={{ 
              textShadow: isMenuOpen 
                ? "0 0 20px var(--active-school-color)" 
                : "0 0 0px var(--active-school-color)"
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            SCHOLOMANCE
          </motion.button>

          {/* Desktop nav links */}
          <div id="nav-links" className="nav-links">
            {allLinks.map((l) => (
              <div key={l.id} className="relative">
                <NavLink
                  to={l.path}
                  className={({ isActive }) =>
                    `nav-link${isActive ? " active" : ""}${isPending && navigatingPath === l.path ? " is-navigating" : ""}`
                  }
                  onMouseEnter={() => preloadRoute(l.path)}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNav(l.path);
                  }}
                >
                  {l.label}
                </NavLink>
                {activeSection === l.id && (
                  <motion.div
                    layoutId="nav-highlight"
                    className="absolute bottom-0 left-0 w-full h-0.5"
                    style={{ backgroundColor: "var(--active-school-color)" }}
                    transition={{ type: "spring", bounce: 0.25, duration: 0.6 }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="nav-controls">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${nextThemeLabel} mode`}
              title={`Switch to ${nextThemeLabel} mode`}
            >
              <ThemeIcon />
            </button>

            {/* Mobile menu button */}
            <button
              className="nav-toggle"
              aria-expanded={isMenuOpen}
              aria-controls="nav-mobile-menu"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              onClick={handleToggle}
            >
              <span aria-hidden="true">
                <div className={`hamburger-bar${isMenuOpen ? " hamburger-bar--open-top" : ""}`} />
                <div className={`hamburger-bar${isMenuOpen ? " hamburger-bar--open-mid" : ""}`} />
                <div className={`hamburger-bar${isMenuOpen ? " hamburger-bar--open-bot" : ""}`} />
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile fullscreen overlay — outside nav to avoid backdrop-filter containing block */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            id="nav-mobile-menu"
            className="nav-mobile-overlay"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={overlayTransition}
          >
            <motion.div
              className="nav-mobile-shell"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
              transition={overlayTransition}
            >
              <div className="nav-mobile-header">
                <p className="nav-mobile-eyebrow">Wayfinding</p>
                <h2 className="nav-mobile-title">Traverse the Scholomance</h2>
                <p className="nav-mobile-copy">
                  Move between chambers without dropping the ritual thread or losing your place.
                </p>
              </div>

              <div className="nav-mobile-links">
                {allLinks.map((l, i) => {
                  const isSelected = navigatingPath === l.path;
                  const isOther = navigatingPath && !isSelected;
                  const isActive = location.pathname === l.path;
                  return (
                    <motion.div
                      key={l.id}
                      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                      animate={{
                        opacity: isOther ? 0.35 : 1,
                        y: 0,
                        scale: isSelected && !prefersReducedMotion ? 1.02 : 1,
                      }}
                      transition={{
                        delay: navigatingPath || prefersReducedMotion ? 0 : i * 0.04,
                        duration: prefersReducedMotion ? 0 : 0.24,
                        ease: "easeOut",
                      }}
                    >
                      <NavLink
                        to={l.path}
                        onClick={(e) => handleMobileNavClick(e, l.path)}
                        onTouchStart={() => preloadRoute(l.path)}
                        className={`nav-mobile-link${isActive ? " active" : ""}${isSelected ? " nav-mobile-link--selected" : ""}`}
                      >
                        <span className="nav-mobile-link-copy">
                          <span className="nav-mobile-link-label">{l.label}</span>
                          <span className="nav-mobile-link-meta">
                            {MOBILE_ROUTE_COPY[l.id] || "Open chamber."}
                          </span>
                        </span>
                        <span className="nav-mobile-link-state">
                          {isSelected ? "Opening" : isActive ? "Current" : "Open"}
                        </span>
                        {isSelected && (
                          <motion.span
                            className="nav-mobile-link__glow"
                            initial={{ opacity: 0, scale: 0.75 }}
                            animate={{ opacity: 1, scale: 1.2 }}
                            transition={overlayTransition}
                            aria-hidden="true"
                          />
                        )}
                      </NavLink>
                    </motion.div>
                  );
                })}
              </div>

              <div className="nav-mobile-footer">
                <button
                  type="button"
                  className="nav-mobile-theme-btn"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${nextThemeLabel} mode`}
                >
                  <ThemeIcon />
                  Switch to {nextThemeLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
