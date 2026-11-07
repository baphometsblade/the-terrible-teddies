// Permanent marks the account can record. Weekly and daily gifts stay off
// this list: their ids would be a new string every Monday.

import { PLAQUES } from './plaques';
import { LEVEL_TRACK, levelMark } from './levelTrack';
import { STORY_CHAPTERS } from './storyCampaign';
import { COLLECTION_SETS } from './collectionBook';

export const RETENTION_MARKS = Object.freeze([
  ...PLAQUES.map((plaque) => plaque.id),
  ...LEVEL_TRACK.map((row) => levelMark(row.level)),
  ...STORY_CHAPTERS.map((chapter) => chapter.id),
  ...COLLECTION_SETS.map((set) => `star_${set.id}`),
]);

const ALLOWED = new Set(RETENTION_MARKS);

export const isRetentionMark = (id) => ALLOWED.has(id);

export const starMark = (setId) => `star_${setId}`;
