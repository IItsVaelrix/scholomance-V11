import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { LINKS } from "../../data/library";
import { useTheme } from "../../hooks/useTheme.jsx";
import { useAuth } from "../../hooks/useAuth.jsx";
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

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = location.pathname.replace("/", "") || "watch";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState(null);
  const navTimeoutRef = useRef(null);
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
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

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setSelectedLink(null);
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
    return () => { if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current); };
  }, []);

  const handleToggle = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
    setSelectedLink(null);
  }, []);

  // Magical nav: select link → glow animation → navigate quickly
  const handleMobileNavClick = useCallback((e, linkPath) => {
    e.preventDefault();
    if (selectedLink) return; // already transitioning
    setSelectedLink(linkPath);
    navTimeoutRef.current = setTimeout(() => {
      // If already on this path, just close the menu
      if (location.pathname === linkPath) {
        setIsMenuOpen(false);
        setSelectedLink(null);
      } else {
        navigate(linkPath);
      }
    }, 100);
  }, [navigate, selectedLink, location.pathname]);

  return (
    <>
      <nav className="primary-nav" aria-label="Primary navigation">
        <div className="nav-inner">
          <NavLink to="/watch" className="nav-brand font-bold" aria-label="Scholomance Home">
            SCHOLOMANCE
          </NavLink>

          {/* Desktop nav links */}
          <div id="nav-links" className="nav-links">
            {allLinks.map((l) => (
              <div key={l.id} className="relative">
                <NavLink
                  to={l.path}
                  className={({ isActive }) =>
                    `nav-link${isActive ? " active" : ""}`
                  }
                  onMouseEnter={() => preloadRoute(l.path)}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {/* Centered link list */}
            <div className="nav-mobile-links">
              {allLinks.map((l, i) => {
                const isSelected = selectedLink === l.path;
                const isOther = selectedLink && !isSelected;
                return (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: isOther ? 0.15 : 1,
                      y: 0,
                      scale: isSelected ? 1.15 : 1,
                    }}
                    transition={{
                      delay: selectedLink ? 0 : i * 0.06,
                      duration: selectedLink ? 0.4 : 0.3,
                      ease: "easeOut",
                    }}
                  >
                    <NavLink
                      to={l.path}
                      onClick={(e) => handleMobileNavClick(e, l.path)}
                      onTouchStart={() => preloadRoute(l.path)}
                      className={({ isActive }) =>
                        `nav-mobile-link${isActive ? " active" : ""}${isSelected ? " nav-mobile-link--selected" : ""}`
                      }
                    >
                      {l.label}
                      {isSelected && (
                        <motion.span
                          className="nav-mobile-link__glow"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 2.5 }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          aria-hidden="true"
                        />
                      )}
                    </NavLink>
                  </motion.div>
                );
              })}
            </div>

            {/* Theme toggle at bottom */}
            <button
              type="button"
              className="nav-mobile-theme-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${nextThemeLabel} mode`}
            >
              <ThemeIcon />
              Switch to {nextThemeLabel}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
