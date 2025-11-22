export type Prediction = 'higher' | 'lower' | '4-or-higher' | '3-or-lower';
export type RoundResult = 'win' | 'loss' | 'push';

export interface Bet {
  amount: number;
  prediction: Prediction;
  timestamp: number;
  playerId: string;
}

export interface RoundResults {
  dice: number;
  playerResults: {
    [playerId: string]: {
      result: RoundResult;
      pointsChange: number;
      bonuses: number;
    };
  };
}

export function calculateRoundResult(
  oldDice: number,
  newDice: number,
  prediction: Prediction
): RoundResult {
  if (prediction === '4-or-higher') {
    return newDice >= 4 ? 'win' : 'loss';
  }
  if (prediction === '3-or-lower') {
    return newDice <= 3 ? 'win' : 'loss';
  }
  
  if (newDice === oldDice) return 'push';
  
  if (prediction === 'higher' && newDice > oldDice) return 'win';
  if (prediction === 'lower' && newDice < oldDice) return 'win';
  return 'loss';
}

export function calculateBonuses(
  bets: { [playerId: string]: Bet },
  oldDice: number,
  newDice: number
): { [playerId: string]: number } {
  const bonuses: { [playerId: string]: number } = {};
  const playerIds = Object.keys(bets);
  
  if (playerIds.length !== 2) return bonuses;

  const [player1, player2] = playerIds;
  const bet1 = bets[player1];
  const bet2 = bets[player2];

  const result1 = calculateRoundResult(oldDice, newDice, bet1.prediction);
  const result2 = calculateRoundResult(oldDice, newDice, bet2.prediction);

  if (bet1.prediction === bet2.prediction && result1 === 'win' && result2 === 'win') {
    bonuses[player1] = (bonuses[player1] || 0) + 10;
    bonuses[player2] = (bonuses[player2] || 0) + 10;
  }

  if (result1 === 'win' && result2 === 'loss') {
    bonuses[player1] = (bonuses[player1] || 0) + 5;
  }
  if (result2 === 'win' && result1 === 'loss') {
    bonuses[player2] = (bonuses[player2] || 0) + 5;
  }

  const sortedBets = Object.values(bets).sort((a, b) => a.timestamp - b.timestamp);
  if (sortedBets.length > 0) {
    bonuses[sortedBets[0].playerId] = (bonuses[sortedBets[0].playerId] || 0) + 2;
  }

  return bonuses;
}

export function calculateRoundResults(
  oldDice: number,
  newDice: number,
  bets: { [playerId: string]: Bet }
): RoundResults {
  const playerResults: RoundResults['playerResults'] = {};
  const bonuses = calculateBonuses(bets, oldDice, newDice);

  Object.entries(bets).forEach(([playerId, bet]) => {
    const result = calculateRoundResult(oldDice, newDice, bet.prediction);
    let pointsChange = 0;

    if (result === 'win') {
      pointsChange = bet.amount;
    } else if (result === 'loss') {
      pointsChange = -bet.amount;
    }

    playerResults[playerId] = {
      result,
      pointsChange,
      bonuses: bonuses[playerId] || 0,
    };
  });

  return {
    dice: newDice,
    playerResults,
  };
}

export function checkWinConditions(
  scores: { [playerId: string]: number },
  round: number
): { gameOver: boolean; winner?: string; reason?: string } {
  const playerIds = Object.keys(scores);
  if (playerIds.length !== 2) return { gameOver: false };

  const [player1, player2] = playerIds;
  const score1 = scores[player1];
  const score2 = scores[player2];

  if (score1 <= 0) {
    return { gameOver: true, winner: player2, reason: 'opponent_zero' };
  }
  if (score2 <= 0) {
    return { gameOver: true, winner: player1, reason: 'opponent_zero' };
  }
  if (score1 >= 300) {
    return { gameOver: true, winner: player1, reason: 'points_threshold' };
  }
  if (score2 >= 300) {
    return { gameOver: true, winner: player2, reason: 'points_threshold' };
  }
  if (round >= 20) {
    const winner = score1 > score2 ? player1 : score2 > score1 ? player2 : undefined;
    return { gameOver: true, winner, reason: 'rounds_complete' };
  }

  return { gameOver: false };
}

