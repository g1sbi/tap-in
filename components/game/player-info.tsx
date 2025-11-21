import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';

interface PlayerInfoProps {
  points: number;
  winStreak: number;
  round: number;
  totalRounds?: number;
  isOpponent?: boolean;
}

export default function PlayerInfo({
  points,
  winStreak,
  round,
  totalRounds = 20,
  isOpponent = false,
}: PlayerInfoProps) {
  const animatedPoints = useSharedValue(points);
  const scale = useSharedValue(1);
  const [displayPoints, setDisplayPoints] = useState(points);

  useEffect(() => {
    animatedPoints.value = withTiming(points, { duration: 500, reduceMotion: false });
    scale.value = withSpring(1.1, { damping: 8, reduceMotion: false }, () => {
      scale.value = withSpring(1, { damping: 8, reduceMotion: false });
    });
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
      <View style={styles.pointsContainer}>
        <Text style={styles.label}>{isOpponent ? 'Opponent' : 'Your'} Points</Text>
        <Animated.Text style={[styles.points, pointsStyle]}>
          {displayPoints}
        </Animated.Text>
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
  },
  opponentContainer: {
    backgroundColor: '#2A1A2A',
  },
  pointsContainer: {
    alignItems: 'center',
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

