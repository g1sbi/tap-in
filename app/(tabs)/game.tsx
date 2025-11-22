import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameState } from '@/lib/game-state';
import { roomManager } from '@/lib/room-manager';
import Dice from '@/components/game/dice';
import BettingTimer from '@/components/game/betting-timer';
import BettingPanel from '@/components/game/betting-panel';
import PlayerInfo from '@/components/game/player-info';
import ResultsOverlay from '@/components/game/results-overlay';
import type { Prediction, RoundResults } from '@/lib/game-logic';

export default function GameScreen() {
  const router = useRouter();
  const {
    currentDice,
    round,
    myScore,
    opponentScore,
    myBet,
    opponentBet,
    betLocked,
    timeRemaining,
    gamePhase,
    winStreak,
    gameWinner,
    gameOverReason,
    playerId,
    actions,
  } = useGameState();

  const {
    lastRoundResults,
  } = useGameState();
  
  const [showResults, setShowResults] = useState(false);
  const isRushRound = round % 5 === 0 && round > 0;

  const handleQuit = async () => {
    await roomManager.leaveRoom();
    actions.reset();
    router.push('/');
  };

  const handleQuitPrompt = () => {
    Alert.alert(
      'Leave Game?',
      'Are you sure you want to leave? Your opponent will win.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: handleQuit,
        },
      ]
    );
  };

  useEffect(() => {
    if (gamePhase === 'RESULTS' && lastRoundResults) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
    
    // Clear results overlay when game ends
    if (gamePhase === 'GAME_OVER') {
      setShowResults(false);
    }
  }, [gamePhase, lastRoundResults]);

  const handleBet = (amount: number, prediction: Prediction) => {
    if (betLocked || gamePhase !== 'BETTING') return;
    roomManager.lockBet(amount, prediction);
  };

  const handleTimerExpire = () => {
    if (gamePhase === 'BETTING' && !betLocked) {
      roomManager.lockBet(0, 'higher');
    }
  };

  const handleResultsDismiss = () => {
    setShowResults(false);
    actions.setLastRoundResults(null);
  };

  const getMyResult = () => {
    if (!lastRoundResults) return null;
    const playerId = useGameState.getState().playerId;
    return lastRoundResults.playerResults[playerId] || null;
  };

  const getOpponentResult = () => {
    if (!lastRoundResults) return null;
    const opponentId = useGameState.getState().opponentId;
    if (!opponentId) return null;
    return lastRoundResults.playerResults[opponentId] || null;
  };

  const myResult = getMyResult();
  const opponentResult = getOpponentResult();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {gamePhase !== 'GAME_OVER' && (
          <TouchableOpacity style={styles.quitButtonTop} onPress={handleQuitPrompt}>
            <Text style={styles.quitButtonTopText}>QUIT</Text>
          </TouchableOpacity>
        )}
        <View style={styles.opponentArea}>
          <PlayerInfo
            points={opponentScore}
            winStreak={0}
            round={round}
            isOpponent
          />
          <View style={styles.betStatus}>
            {opponentBet ? (
              <View style={styles.lockedIndicator}>
                <Text style={styles.lockedText}>✓ Locked In</Text>
              </View>
            ) : (
              <Text style={styles.thinkingText}>Thinking...</Text>
            )}
          </View>
        </View>

        <View style={styles.diceSection}>
          <View style={styles.currentDice}>
            <Dice value={currentDice} size={120} animated={gamePhase === 'REVEALING'} />
          </View>
          <View style={styles.timerContainer}>
            {gamePhase === 'BETTING' ? (
              <BettingTimer
                seconds={timeRemaining}
                onExpire={handleTimerExpire}
                isRushRound={isRushRound}
              />
            ) : gamePhase === 'REVEALING' ? (
              <Text style={styles.rollingText}>Rolling...</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.bettingArea}>
          {gamePhase === 'BETTING' && (
            <BettingPanel
              maxAmount={myScore}
              onBet={handleBet}
              disabled={betLocked}
              locked={betLocked}
              currentDice={currentDice}
            />
          )}
          {betLocked && gamePhase === 'BETTING' && (
            <View style={styles.waitingContainer}>
              <Text style={styles.waitingText}>Waiting for opponent...</Text>
            </View>
          )}
        </View>

        <View style={styles.myStats}>
          <PlayerInfo points={myScore} winStreak={winStreak} round={round} />
        </View>
      </View>

      {showResults && lastRoundResults && myResult && opponentResult && gamePhase !== 'GAME_OVER' && (
        <ResultsOverlay
          dice={lastRoundResults.dice}
          myResult={myResult.result}
          myPointsChange={myResult.pointsChange}
          myBonuses={myResult.bonuses}
          opponentResult={opponentResult.result}
          opponentPointsChange={opponentResult.pointsChange}
          opponentBonuses={opponentResult.bonuses}
          onDismiss={handleResultsDismiss}
        />
      )}

      {gamePhase === 'GAME_OVER' && (
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverContent}>
            <Text style={styles.gameOverTitle}>Game Over!</Text>
            
            {gameWinner === playerId ? (
              <View style={styles.winnerContainer}>
                <Text style={styles.winnerText}>🎉 YOU WIN! 🎉</Text>
                <Text style={styles.winnerReason}>
                  {gameOverReason === 'points_threshold' && 'Reached 300 points!'}
                  {gameOverReason === 'opponent_zero' && 'Opponent eliminated!'}
                  {gameOverReason === 'rounds_complete' && 'Most points after 20 rounds!'}
                  {gameOverReason === 'opponent_disconnected' && 'Opponent disconnected!'}
                </Text>
              </View>
            ) : gameWinner ? (
              <View style={styles.loserContainer}>
                <Text style={styles.loserText}>😔 You Lost</Text>
                <Text style={styles.loserReason}>
                  {gameOverReason === 'points_threshold' && 'Opponent reached 300 points'}
                  {gameOverReason === 'opponent_zero' && 'You were eliminated'}
                  {gameOverReason === 'rounds_complete' && 'Opponent had more points'}
                </Text>
              </View>
            ) : (
              <View style={styles.drawContainer}>
                <Text style={styles.drawText}>🤝 Draw</Text>
                <Text style={styles.drawReason}>Equal points after 20 rounds</Text>
              </View>
            )}
            
            <View style={styles.finalScoresContainer}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Your Score:</Text>
                <Text style={[styles.scoreValue, gameWinner === playerId && styles.winnerScore]}>
                  {myScore}
                </Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Opponent Score:</Text>
                <Text style={[styles.scoreValue, gameWinner && gameWinner !== playerId && styles.winnerScore]}>
                  {opponentScore}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.quitButton} onPress={handleQuit}>
              <Text style={styles.quitButtonText}>QUIT</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  quitButtonTop: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 100,
    backgroundColor: '#2A2A2A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF4458',
  },
  quitButtonTopText: {
    color: '#FF4458',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  opponentArea: {
    gap: 6,
    flex: 0.2,
  },
  betStatus: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  lockedIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1A3A1A',
  },
  lockedText: {
    color: '#00FF88',
    fontSize: 12,
    fontWeight: '600',
  },
  thinkingText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  diceSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 0.3,
  },
  currentDice: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerContainer: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rollingText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bettingArea: {
    gap: 12,
    flex: 0.3,
    justifyContent: 'center',
  },
  waitingContainer: {
    padding: 12,
    alignItems: 'center',
  },
  waitingText: {
    color: '#888',
    fontSize: 14,
  },
  myStats: {
    flex: 0.2,
  },
  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gameOverContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 24,
  },
  gameOverTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  winnerContainer: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#1A3A1A',
    borderWidth: 3,
    borderColor: '#00FF88',
    width: '100%',
  },
  winnerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00FF88',
  },
  winnerReason: {
    fontSize: 16,
    color: '#88FFAA',
    textAlign: 'center',
  },
  loserContainer: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#3A1A1A',
    borderWidth: 3,
    borderColor: '#FF4458',
    width: '100%',
  },
  loserText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF4458',
  },
  loserReason: {
    fontSize: 16,
    color: '#FF8888',
    textAlign: 'center',
  },
  drawContainer: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#3A3A1A',
    borderWidth: 3,
    borderColor: '#FFD700',
    width: '100%',
  },
  drawText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  drawReason: {
    fontSize: 16,
    color: '#FFE888',
    textAlign: 'center',
  },
  finalScoresContainer: {
    width: '100%',
    gap: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 18,
    color: '#888',
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  winnerScore: {
    color: '#00FF88',
  },
  quitButton: {
    marginTop: 8,
    backgroundColor: '#FF4458',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  quitButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});

