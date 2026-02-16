import { motion } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { useProgression } from "../../hooks/useProgression.jsx";
import { SCHOOLS, getSchoolBadgeClass } from "../../data/schools";
import { getTierForLevel } from "../../lib/progressionUtils";
import "./ProfilePage.css";

export default function ProfilePage() {
  const { user } = useAuth();
  const { progression, levelInfo } = useProgression();

  if (!user || !progression) return null;

  const currentTier = getTierForLevel(levelInfo.level);
  const nextLevelXp = levelInfo.nextLevelXp;
  const xpProgress = ((progression.xp - levelInfo.currentLevelXp) / (nextLevelXp - levelInfo.currentLevelXp)) * 100;

  // Achievement Skeleton
  const achievements = [
    { id: "first_word", title: "First Word", desc: "Save your first scroll.", icon: "📜", unlocked: true },
    { id: "rhymer", title: "Rhyme Weaver", desc: "Create 50 rhymes.", icon: "🎵", unlocked: false },
    { id: "polyglot", title: "Polyglot", desc: "Unlock all schools.", icon: "🌈", unlocked: false },
    { id: "master", title: "Master of Arts", desc: "Reach Level 50.", icon: "👑", unlocked: false },
  ];

  return (
    <section className="section min-h-screen profile-page">
      <div className="container profile-grid">
        {/* Character Card */}
        <motion.div 
          className="profile-card glass-strong"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="avatar-frame">
            <div className="avatar-placeholder">{user.username.charAt(0).toUpperCase()}</div>
            <div className="tier-badge">{currentTier.title}</div>
          </div>
          <h1 className="profile-name">{user.username}</h1>
          <p className="profile-title">Level {levelInfo.level} {currentTier.title}</p>
          
          <div className="xp-bar-container">
            <div className="xp-bar-fill" style={{ width: `${xpProgress}%` }} />
            <span className="xp-text">{progression.xp} / {nextLevelXp} XP</span>
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <span className="stat-label">Scrolls</span>
              <span className="stat-value">0</span> {/* Todo: Connect to real count */}
            </div>
            <div className="stat-box">
              <span className="stat-label">Streak</span>
              <span className="stat-value">1</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Rank</span>
              <span className="stat-value">#--</span>
            </div>
          </div>
        </motion.div>

        {/* Main Content Area */}
        <div className="profile-content">
          {/* Schools Mastery */}
          <motion.div 
            className="content-panel glass"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h2 className="panel-title">School Attunement</h2>
            <div className="schools-grid">
              {Object.values(SCHOOLS).map((school) => {
                const isUnlocked = progression.unlockedSchools.includes(school.id);
                return (
                  <div key={school.id} className={`school-card ${isUnlocked ? 'unlocked' : 'locked'}`} style={{ '--school-color': school.color }}>
                    <div className="school-icon">{school.glyph}</div>
                    <div className="school-info">
                      <h3>{school.name}</h3>
                      <p>{isUnlocked ? "Attuned" : "Locked"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Achievements */}
          <motion.div 
            className="content-panel glass"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="panel-title">Achievements</h2>
            <div className="achievements-list">
              {achievements.map((ach) => (
                <div key={ach.id} className={`achievement-item ${ach.unlocked ? 'unlocked' : 'locked'}`}>
                  <div className="ach-icon">{ach.icon}</div>
                  <div className="ach-details">
                    <h3>{ach.title}</h3>
                    <p>{ach.desc}</p>
                  </div>
                  <div className="ach-status">
                    {ach.unlocked ? "✓" : "🔒"}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
