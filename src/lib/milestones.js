// What the back room is still keeping from a new face. The gates are the
// same numbers the features themselves refuse.

import { CRAWL_UNLOCK_BATTLES } from './barCrawl';
import { STAR_UNLOCK_CARDS } from './cardStars';
import { PLAQUES } from './plaques';

export const houseUnlocks = (state = {}) => {
  const chapters = state.claimedChapters || [];
  const firstPlaque = PLAQUES[0];
  return [
    { id: 'stars', name: 'Taking them home', need: `Own ${STAR_UNLOCK_CARDS} cards`, open: (state.ownedCards || []).length >= STAR_UNLOCK_CARDS },
    { id: 'crawl', name: 'The bar crawl', need: `Finish ${CRAWL_UNLOCK_BATTLES} fights`, open: (state.totalBattles || 0) >= CRAWL_UNLOCK_BATTLES },
    { id: 'chapter2', name: 'The lock-in', need: 'Finish The First Round', open: chapters.includes('story_first_round') },
    { id: 'plaque', name: 'A plaque on the wall', need: `Reach level ${firstPlaque.level}`, open: (state.level || 1) >= firstPlaque.level },
  ];
};
