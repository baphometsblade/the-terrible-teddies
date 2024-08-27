import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = process.env.VITE_SUPABASE_API_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('terrible_teddies_cards')
        .select('*');

      if (error) throw error;

      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching bear data:', error);
      res.status(500).json({ error: 'Failed to load bear data' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}