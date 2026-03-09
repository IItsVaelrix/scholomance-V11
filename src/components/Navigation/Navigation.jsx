import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { LINKS } from "../../data/library";
import { useTheme } from "../../hooks/useTheme.jsx";
import { useAuth } from "../../hooks/useAuth.jsx";

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
  const themeGlyph = theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19";
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

  // Magical nav: select link → glow animation → navigate after delay
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
    }, 500);
  }, [navigate, selectedLink, location.pathname]);

  return (
    <>
      <nav className="primary-nav w-full z-100" aria-label="Primary navigation">
        <div className="nav-inner flex items-center justify-between">
          <NavLink to="/watch" className="nav-brand font-bold" aria-label="Scholomance Home">
            SCHOLOMANCE
          </NavLink>

          {/* Desktop nav links */}
          <div id="nav-links" className="nav-links hidden md:flex gap-8 items-center">
            {allLinks.map((l) => (
              <div key={l.id} className="relative">
                <NavLink
                  to={l.path}
                  className={({ isActive }) =>
                    `nav-link font-mono text-xs uppercase tracking-wide transition-colors ${isActive ? "text-primary" : "text-muted hover:text-secondary"}`
                  }
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
              <span aria-hidden="true">{themeGlyph}</span>
            </button>

            {/* Mobile menu button */}
            <button
              className="nav-toggle md:hidden p-2"
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
              <span aria-hidden="true">{themeGlyph}</span>
              Switch to {nextThemeLabel}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
