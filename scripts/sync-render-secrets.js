import fs from 'node:fs';
import path from 'node:path';

/**
 * sync-render-secrets.js
 * 
 * Synchronizes local .env secrets to a Render.com service via the Render API.
 * 
 * Usage:
 *   node scripts/sync-render-secrets.js
 * 
 * Required Environment Variables:
 *   RENDER_API_KEY: Your Render API key
 *   RENDER_SERVICE_ID: The ID of your Render service (found in the service settings URL)
 */

const API_KEY = process.env.RENDER_API_KEY;
const SERVICE_ID = process.env.RENDER_SERVICE_ID;

async function sync() {
  if (!API_KEY || !SERVICE_ID) {
    console.error('Error: RENDER_API_KEY and RENDER_SERVICE_ID must be set.');
    process.exit(1);
  }

  // Load .env
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found in current directory.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = envContent
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const [key, ...rest] = line.split('=');
      return { key: key.trim(), value: rest.join('=').trim() };
    });

  console.log(`🚀 Syncing ${envVars.length} environment variables to Render...`);

  try {
    const response = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/env-vars`, {
      method: 'PUT', // PUT replaces all env vars for the service
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(envVars.map(v => ({
        key: v.key,
        value: v.value
      })))
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Render API error: ${JSON.stringify(errorData)}`);
    }

    console.log('✅ Successfully synchronized environment variables to Render.');
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

sync();
