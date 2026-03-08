import { SCHOOLS } from "./schools.js";

/**
 * Get the school ID associated with a given vowel family.
 * @param {string} family - Vowel family token (e.g., "IY")
 * @returns {string|null} School ID or null if no affinity
 */
export function getSchoolForVowel(family) {
  if (!family) return null;
  const target = String(family).toUpperCase();
  const match = Object.values(SCHOOLS).find((school) =>
    school.vowelAffinities?.includes(target)
  );
  return match?.id ?? null;
}

/**
 * Get all vowel families associated with a specific school.
 * @param {string} schoolId - School ID (e.g., "SONIC")
 * @returns {string[]} Array of vowel family IDs
 */
export function getVowelsBySchool(schoolId) {
  return SCHOOLS[schoolId]?.vowelAffinities ?? [];
}
