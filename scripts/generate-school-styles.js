import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSchoolCSSVariables, generateLockedSchoolStyles } from '../src/lib/css/schoolStyles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cssContent = generateSchoolCSSVariables() + generateLockedSchoolStyles();
const outputPath = path.join(__dirname, '../src/lib/css/generated');

if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
}

fs.writeFileSync(path.join(outputPath, 'school-styles.css'), cssContent);

console.log('Successfully generated school-styles.css');
