import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const scripts = [
  'node src/scripts/create_games_table.js',
  'node src/scripts/populate_supabase.js',
  'node src/scripts/migrate-teddy-data.js',
  'node src/scripts/generate-game-assets.js',
  'node src/scripts/upload_assets.js',
  'node src/scripts/populate-database.js'
];

async function runScript(script) {
  try {
    console.log(`Running script: ${script}`);
    const { stdout, stderr } = await execAsync(script);
    console.log(`Output: ${stdout}`);
    if (stderr) {
      console.error(`Error: ${stderr}`);
    }
  } catch (error) {
    console.error(`Error executing ${script}:`, error);
  }
}

async function runAllScripts() {
  for (const script of scripts) {
    await runScript(script);
  }
  console.log('All scripts have been executed.');
}

runAllScripts();