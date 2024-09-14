import { generateGameAssets } from '../../scripts/generate-game-assets';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    await generateGameAssets((data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ completed: true })}\n\n`);
  } catch (error) {
    console.error('Error generating assets:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
  } finally {
    res.end();
  }
}
