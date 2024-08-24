import { spawn } from 'child_process';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'generate_assets.py');

  const pythonProcess = spawn('python', [scriptPath]);

  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Python script output:', output);

    const lines = output.split('\n');
    for (const line of lines) {
      if (line.startsWith('PROGRESS:')) {
        const progress = parseFloat(line.split('PROGRESS:')[1]);
        res.write(`data: ${JSON.stringify({ progress })}\n\n`);
      } else if (line.startsWith('CURRENT_IMAGE:')) {
        const currentImage = line.split('CURRENT_IMAGE:')[1].trim();
        res.write(`data: ${JSON.stringify({ currentImage })}\n\n`);
      }
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error('Python script error:', data.toString());
    res.write(`data: ${JSON.stringify({ error: data.toString() })}\n\n`);
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python script exited with code ${code}`);
      res.write(`data: ${JSON.stringify({ error: 'Asset generation failed' })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ message: 'Assets generated successfully' })}\n\n`);
    }
    res.end();
  });
}