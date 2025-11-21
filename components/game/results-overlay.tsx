import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import Dice from './dice';
import type { RoundResult } from '@/lib/game-logic';

interface ResultsOverlayProps {
  dice: number;
  myResult: RoundResult;
  myPointsChange: number;
  myBonuses: number;
  opponentResult: RoundResult;
  opponentPointsChange: number;
  opponentBonuses: number;
  onDismiss: () => void;
}

export default function ResultsOverlay({
  dice,
  myResult,
  myPointsChange,
  myBonuses,
  opponentResult,
  opponentPointsChange,
  opponentBonuses,
  onDismiss,
}: ResultsOverlayProps) {
  const opponentOpacity = useSharedValue(0);
  const opponentTranslateY = useSharedValue(-50);
  const diceScale = useSharedValue(0);
  const diceRotation = useSharedValue(0);
  const myOpacity = useSharedValue(0);
  const myTranslateY = useSharedValue(50);

  useEffect(() => {
    opponentOpacity.value = withTiming(1, { duration: 300, reduceMotion: false });
    opponentTranslateY.value = withSpring(0, { damping: 12, reduceMotion: false });

    setTimeout(() => {
      diceScale.value = withSpring(1, { damping: 8, reduceMotion: false });
      diceRotation.value = withSequence(
        withTiming(360, { duration: 400, reduceMotion: false }),
        withTiming(0, { duration: 0, reduceMotion: false })
      );
    }, 200);

    setTimeout(() => {
      myOpacity.value = withTiming(1, { duration: 300, reduceMotion: false });
      myTranslateY.value = withSpring(0, { damping: 12, reduceMotion: false });
    }, 600);

    setTimeout(() => {
      onDismiss();
    }, 4000);
  }, []);

  const opponentStyle = useAnimatedStyle(() => ({
    opacity: opponentOpacity.value,
    transform: [{ translateY: opponentTranslateY.value }],
  }));

  const diceStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: diceScale.value },
      { rotate: `${diceRotation.value}deg` },
    ],
  }));

  const myStyle = useAnimatedStyle(() => ({
    opacity: myOpacity.value,
    transform: [{ translateY: myTranslateY.value }],
  }));

  const getResultColor = (result: RoundResult) => {
    switch (result) {
      case 'win':
        return '#00FF88';
      case 'loss':
        return '#FF4458';
      case 'push':
        return '#FFD700';
      default:
        return '#FFFFFF';
    }
  };

  const getResultText = (result: RoundResult) => {
    switch (result) {
      case 'win':
        return 'WIN';
      case 'loss':
        return 'LOSS';
      case 'push':
        return 'PUSH';
      default:
        return '';
    }
  };

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.opponentResult, opponentStyle]}>
        <View
          style={[
            styles.resultCard,
            { borderColor: getResultColor(opponentResult) },
          ]}>
          <Text style={styles.resultLabel}>Opponent</Text>
          <Text style={[styles.resultText, { color: getResultColor(opponentResult) }]}>
            {getResultText(opponentResult)}
          </Text>
          <Text style={styles.pointsChange}>
            {opponentPointsChange >= 0 ? '+' : ''}
            {opponentPointsChange}
            {opponentBonuses > 0 && ` +${opponentBonuses} bonus`}
          </Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.diceContainer, diceStyle]}>
        <Dice value={dice} size={140} animated />
      </Animated.View>

      <Animated.View style={[styles.myResult, myStyle]}>
        <View
          style={[
            styles.resultCard,
            { borderColor: getResultColor(myResult) },
          ]}>
          <Text style={styles.resultLabel}>You</Text>
          <Text style={[styles.resultText, { color: getResultColor(myResult) }]}>
            {getResultText(myResult)}
          </Text>
          <Text style={styles.pointsChange}>
            {myPointsChange >= 0 ? '+' : ''}
            {myPointsChange}
            {myBonuses > 0 && ` +${myBonuses} bonus`}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    zIndex: 1000,
  },
  opponentResult: {
    width: '80%',
  },
  myResult: {
    width: '80%',
  },
  resultCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    borderWidth: 3,
    alignItems: 'center',
    gap: 8,
  },
  resultLabel: {
    fontSize: 14,
    color: '#888',
  },
  resultText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  pointsChange: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  diceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

