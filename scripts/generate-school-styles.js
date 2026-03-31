/**
 * School Styles Generator — Backend Integration
 * 
 * This script generates school styles CSS. In production, it fetches from
 * the backend API. In development/build, it generates locally for reliability.
 * 
 * Usage:
 *   node scripts/generate-school-styles.js [--from-api]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we should fetch from API (only in production)
const FETCH_FROM_API = process.argv.includes('--from-api') && process.env.NODE_ENV === 'production';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

const outputPath = path.join(__dirname, '../src/lib/css/generated');

async function fetchSchoolStyles() {
  try {
    console.log(`Fetching school styles from ${API_BASE_URL}/api/styles/schools...`);
    
    const response = await fetch(`${API_BASE_URL}/api/styles/schools`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const cssContent = await response.text();
    
    // Ensure output directory exists
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    
    // Write CSS file
    fs.writeFileSync(path.join(outputPath, 'school-styles.css'), cssContent);
    
    console.log('✓ Successfully generated school-styles.css from backend API');
    return true;
    
  } catch (error) {
    console.error('✗ Failed to fetch school styles:', error.message);
    console.error('  Falling back to local generation...');
    return await generateLocalFallback();
  }
}

async function generateLocalFallback() {
  try {
    // Dynamic import to avoid circular dependencies
    const { generateSchoolCSSVariables, generateLockedSchoolStyles } = 
      await import('../src/lib/css/schoolStyles.js');
    
    const cssContent = generateSchoolCSSVariables() + generateLockedSchoolStyles();
    
    // Ensure output directory exists
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    
    fs.writeFileSync(path.join(outputPath, 'school-styles.css'), cssContent);
    
    console.log('✓ Successfully generated school-styles.css (local)');
    return true;
    
  } catch (error) {
    console.error('✗ Failed to generate school styles locally:', error.message);
    return false;
  }
}

// Run the script - default to local generation for reliability
(async () => {
  let success;
  if (FETCH_FROM_API) {
    success = await fetchSchoolStyles();
  } else {
    success = await generateLocalFallback();
  }
  
  if (!success) {
    process.exit(1);
  }
})();
