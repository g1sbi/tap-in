import { type GameOverReason } from './game-constants';
import { gameConfig } from './game-config';

export type Prediction = 'higher' | 'lower' | '4-or-higher' | '3-or-lower';
export type RoundResult = 'win' | 'loss' | 'push' | 'passed';

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

export interface WinConditionResult {
  gameOver: boolean;
  winner?: string;
  reason?: GameOverReason;
}

/**
 * Calculates the result of a single round based on the dice roll and prediction.
 * 
 * @param oldDice - The previous dice value
 * @param newDice - The new dice value rolled
 * @param prediction - The player's prediction
 * @returns The round result ('win', 'loss', or 'push')
 */
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

/**
 * Calculates bonus points for players based on their betting behavior.
 * 
 * @param bets - Object mapping player IDs to their bets
 * @param oldDice - The previous dice value
 * @param newDice - The new dice value rolled
 * @returns Object mapping player IDs to their bonus points
 */
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

  // Mirror bonus: both players bet same direction and both win
  if (bet1.prediction === bet2.prediction && result1 === 'win' && result2 === 'win') {
    bonuses[player1] = (bonuses[player1] || 0) + gameConfig.MIRROR_BONUS;
    bonuses[player2] = (bonuses[player2] || 0) + gameConfig.MIRROR_BONUS;
  }

  // Contrarian bonus: only this player wins (opponent loses)
  if (result1 === 'win' && result2 === 'loss') {
    bonuses[player1] = (bonuses[player1] || 0) + gameConfig.CONTRARIAN_BONUS;
  }
  if (result2 === 'win' && result1 === 'loss') {
    bonuses[player2] = (bonuses[player2] || 0) + gameConfig.CONTRARIAN_BONUS;
  }

  // Speed bonus: first player to bet
  const sortedBets = Object.values(bets).sort((a, b) => a.timestamp - b.timestamp);
  if (sortedBets.length > 0) {
    bonuses[sortedBets[0].playerId] = (bonuses[sortedBets[0].playerId] || 0) + gameConfig.SPEED_BONUS;
  }

  return bonuses;
}

/**
 * Calculates the complete round results including points changes and bonuses.
 * 
 * @param oldDice - The previous dice value
 * @param newDice - The new dice value rolled
 * @param bets - Object mapping player IDs to their bets
 * @returns The complete round results
 */
export function calculateRoundResults(
  oldDice: number,
  newDice: number,
  bets: { [playerId: string]: Bet }
): RoundResults {
  const playerResults: RoundResults['playerResults'] = {};
  
  // Filter out passed players (amount === 0) from bonus calculations
  // Passed players didn't actually compete, so they shouldn't affect bonuses
  const activeBets = Object.fromEntries(
    Object.entries(bets).filter(([_, bet]) => bet.amount > 0)
  );
  
  const bonuses = calculateBonuses(activeBets, oldDice, newDice);

  Object.entries(bets).forEach(([playerId, bet]) => {
    // If bet amount is 0, player passed (timeout)
    if (bet.amount === 0) {
      playerResults[playerId] = {
        result: 'passed',
        pointsChange: -gameConfig.TIMEOUT_PENALTY,
        bonuses: 0, // No bonuses for passed players
      };
      return;
    }

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

/**
 * Checks if any win conditions have been met.
 * 
 * @param scores - Object mapping player IDs to their current scores
 * @param round - The current round number
 * @returns Win condition check result with game over status, winner, and reason
 */
export function checkWinConditions(
  scores: { [playerId: string]: number },
  round: number
): WinConditionResult {
  const playerIds = Object.keys(scores);
  if (playerIds.length !== 2) return { gameOver: false };

  const [player1, player2] = playerIds;
  const score1 = scores[player1];
  const score2 = scores[player2];

  if (score1 <= gameConfig.MIN_SCORE) {
    return { gameOver: true, winner: player2, reason: 'opponent_zero' };
  }
  if (score2 <= gameConfig.MIN_SCORE) {
    return { gameOver: true, winner: player1, reason: 'opponent_zero' };
  }
  if (score1 >= gameConfig.WINNING_SCORE) {
    return { gameOver: true, winner: player1, reason: 'points_threshold' };
  }
  if (score2 >= gameConfig.WINNING_SCORE) {
    return { gameOver: true, winner: player2, reason: 'points_threshold' };
  }
  if (round >= gameConfig.MAX_ROUNDS) {
    const winner = score1 > score2 ? player1 : score2 > score1 ? player2 : undefined;
    return { gameOver: true, winner, reason: 'rounds_complete' };
  }

  return { gameOver: false };
}

