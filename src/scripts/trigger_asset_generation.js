import { exec } from 'child_process';
import path from 'path';

export function triggerAssetGeneration() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'generate_assets.py');
    const pythonProcess = exec(`python ${scriptPath}`);

    let output = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log(data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Asset generation process exited with code ${code}`));
      }
    });
  });
}