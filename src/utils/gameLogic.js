import { getTeddyBear, updateTeddyBear } from './teddyBearOperations';

export async function simulateBattle(bear1Id, bear2Id) {
  const bear1 = await getTeddyBear(bear1Id);
  const bear2 = await getTeddyBear(bear2Id);

  if (!bear1 || !bear2) {
    console.error('Error fetching bears for battle');
    return null;
  }

  const bear1Score = calculateBearScore(bear1);
  const bear2Score = calculateBearScore(bear2);

  let winner, loser;
  if (bear1Score > bear2Score) {
    winner = bear1;
    loser = bear2;
  } else {
    winner = bear2;
    loser = bear1;
  }

  // Update stats
  await updateTeddyBear(winner.id, { wins: winner.wins + 1 });
  await updateTeddyBear(loser.id, { losses: loser.losses + 1 });

  return { winner, loser };
}

function calculateBearScore(bear) {
  return bear.strength + bear.agility + bear.intelligence + Math.random() * 10;
}
