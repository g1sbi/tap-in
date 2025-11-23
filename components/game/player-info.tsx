import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolate,
  useAnimatedReaction,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { GAME_CONSTANTS } from '@/lib/game-constants';

interface PlayerInfoProps {
  points: number;
  winStreak: number;
  round: number;
  totalRounds?: number;
  isOpponent?: boolean;
  isWinning?: boolean;
  isHost?: boolean;
}

export default function PlayerInfo({
  points,
  winStreak,
  round,
  totalRounds = GAME_CONSTANTS.MAX_ROUNDS,
  isOpponent = false,
  isWinning = false,
  isHost = false,
}: PlayerInfoProps) {
  const animatedPoints = useSharedValue(points);
  const scale = useSharedValue(1);
  const [displayPoints, setDisplayPoints] = useState(points);

  useEffect(() => {
    animatedPoints.value = withTiming(points, { duration: 500, reduceMotion: false });
    scale.value = withSequence(
      withTiming(1.05, { duration: 150, easing: Easing.out(Easing.quad), reduceMotion: false }),
      withTiming(1, { duration: 150, reduceMotion: false })
    );
  }, [points]);

  useAnimatedReaction(
    () => animatedPoints.value,
    (value) => {
      runOnJS(setDisplayPoints)(Math.max(0, Math.floor(value)));
    }
  );

  const pointsStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <View style={[styles.container, isOpponent && styles.opponentContainer]}>
      {isHost && (
        <View style={styles.hostBadge}>
          <Text style={styles.hostBadgeText}>HOST</Text>
        </View>
      )}
      <View style={styles.pointsContainer}>
        <Text style={styles.label}>{isOpponent ? 'Opponent' : 'Your'} Points</Text>
        <View style={styles.pointsRow}>
        <Animated.Text style={[styles.points, pointsStyle]}>
          {displayPoints}
        </Animated.Text>
          {isWinning && <Text style={styles.crown}>👑</Text>}
        </View>
      </View>

      <View style={styles.statsRow}>
        {winStreak > 0 && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Streak</Text>
            <Text style={styles.statValue}>{winStreak}</Text>
          </View>
        )}
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Round</Text>
          <Text style={styles.statValue}>
            {round}/{totalRounds}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    gap: 8,
    position: 'relative',
  },
  opponentContainer: {
    backgroundColor: '#2A1A2A',
  },
  hostBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#444',
    zIndex: 10,
  },
  hostBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  pointsContainer: {
    alignItems: 'center',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  points: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  crown: {
    fontSize: 20,
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

