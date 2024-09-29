import { supabase } from '../lib/supabase';

const AIOpponent = {
  generateTeddy: async () => {
    const { data, error } = await supabase
      .from('terrible_teddies')
      .select('*')
      .order('RANDOM()')
      .limit(1)
      .single();

    if (error) {
      console.error('Error generating AI teddy:', error);
      return null;
    }

    return data;
  },

  chooseAction: (aiTeddy, playerTeddy, difficulty) => {
    const actions = ['attack', 'defend', 'special'];
    let weights;

    switch (difficulty) {
      case 'easy':
        weights = [0.6, 0.3, 0.1];
        break;
      case 'medium':
        weights = [0.4, 0.3, 0.3];
        break;
      case 'hard':
        weights = [0.3, 0.3, 0.4];
        break;
      default:
        weights = [0.33, 0.33, 0.34];
    }

    // Simple AI logic based on difficulty and current game state
    if (aiTeddy.health < playerTeddy.health && Math.random() < 0.7) {
      return 'special';
    } else if (aiTeddy.defense < playerTeddy.attack && Math.random() < 0.6) {
      return 'defend';
    } else {
      const randomValue = Math.random();
      let sum = 0;
      for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (randomValue <= sum) {
          return actions[i];
        }
      }
      return 'attack'; // Fallback to attack if something goes wrong
    }
  }
};

export default AIOpponent;