import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
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
  const activeSection = location.pathname.replace("/", "") || "watch";
  const [isMenuOpen, setIsMenuOpen] = useState(false); // For mobile
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const canAccessCollab = isAdminUser(user);
  const nextThemeLabel = theme === "dark" ? "light" : "dark";
  const themeGlyph = theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19";
  const navLinks = LINKS.filter((link) => link.id !== "collab" || canAccessCollab);

  return (
    <nav className="primary-nav w-full z-100" aria-label="Primary navigation">
      <div className="nav-inner flex items-center justify-between">
        <NavLink to="/watch" className="nav-brand font-bold" aria-label="Scholomance Home">
          SCHOLOMANCE
        </NavLink>

        <div
          id="nav-links"
          className={`nav-links flex gap-8 items-center ${isMenuOpen ? "flex-col absolute top-20 left-0 w-full p-8 glass-strong" : "hidden md:flex"}`}
        >
          {[
            ...navLinks, 
            { 
              id: user ? "profile" : "auth", 
              path: user ? "/profile" : "/auth", 
              label: user ? user.username : "Portal" 
            }
          ].map((l) => (
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
            aria-controls="nav-links"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span aria-hidden="true">
              <div className="hamburger-bar" />
              <div className="hamburger-bar" />
              <div className="hamburger-bar" />
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
