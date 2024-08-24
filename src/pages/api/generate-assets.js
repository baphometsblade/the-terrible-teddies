import { spawn } from 'child_process';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'generate_assets.py');

  const pythonProcess = spawn('python', [scriptPath]);

  let output = '';
  let error = '';

  pythonProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    error += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python script exited with code ${code}`);
      console.error('Error:', error);
      return res.status(500).json({ message: 'Asset generation failed', error });
    }

    const imagesCount = (output.match(/Generated and stored card/g) || []).length;
    const cardsCount = imagesCount;

    res.status(200).json({
      message: 'Assets generated successfully',
      imagesCount,
      cardsCount,
    });
  });
}