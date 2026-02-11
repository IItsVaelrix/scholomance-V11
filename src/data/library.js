import { SCHOOLS, generateSchoolColor } from "./schools";

// Shared data constants for Scholomance

export const LIBRARY = {
  lexiconic: {
    title: "Sonic Thaumaturgy",
    yt: "9_QmbwbY0tc",
    school: "SONIC",
  },
  schism: {
    title: "Psychic Schism",
    yt: "3tmd-ClpJxA",
    school: "PSYCHIC",
  },
  void: {
    title: "VOID",
    yt: "F2yr6zQwqQk",
    school: "VOID",
  },
  alchemy: {
    title: "Verbal Alchemy",
    yt: "GtgyCnJcZRw",
    school: "ALCHEMY",
  },
  will: {
    title: "Willpower Surge",
    yt: "5iIUiYkmkw8",
    school: "WILL",
  },
  sonic_harmony: {
    title: "Harmony",
    suno: "https://suno.com/song/236e9f87-4d38-43da-a98a-b39447256d21",
    school: "SONIC",
  },
};

// Meditation tracks — separate from school music
export const MEDITATION_TRACKS = [
  { id: "meditation-1", title: "Stillness" },
  { id: "meditation-2", title: "Inner Temple" },
  { id: "meditation-3", title: "Deep Focus" },
];

export const LINKS = [
  { id: "watch", path: "/watch", label: "Watch" },
  { id: "listen", path: "/listen", label: "Listen" },
  { id: "read", path: "/read", label: "Scribe" },
  { id: "collab", path: "/collab", label: "Collab" },
];

// Dynamically generate COLORS from SCHOOLS source of truth
export const COLORS = Object.keys(SCHOOLS).reduce((acc, schoolId) => {
  acc[schoolId] = generateSchoolColor(schoolId);
  return acc;
}, {});

// Dynamically generate ANGLES from SCHOOLS source of truth
export const SCHOOL_ANGLES = Object.values(SCHOOLS).reduce((acc, school) => {
  acc[school.id] = school.angle;
  return acc;
}, {});

export function schoolToBadgeClass(school) {
  return `badge--${String(school || "").toLowerCase()}`;
}
