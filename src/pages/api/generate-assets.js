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

    try {
      const jsonData = JSON.parse(output);
      if (jsonData.progress) {
        res.write(`data: ${JSON.stringify({ progress: jsonData.progress, currentImage: jsonData.currentImage })}\n\n`);
      } else if (jsonData.error) {
        res.write(`data: ${JSON.stringify({ error: jsonData.error })}\n\n`);
      }
    } catch (error) {
      console.error('Error parsing JSON:', error);
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