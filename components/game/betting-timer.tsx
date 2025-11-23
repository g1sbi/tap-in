import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface BettingTimerProps {
  seconds: number;
  onExpire?: () => void;
  isRushRound?: boolean;
}

export default function BettingTimer({ seconds, onExpire, isRushRound = false }: BettingTimerProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const secondsValue = useSharedValue(seconds);

  useEffect(() => {
    secondsValue.value = seconds;
    if (seconds <= 3 && seconds > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    const speed = isRushRound ? 200 : Math.max(100, 300 / (11 - seconds));
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: speed, reduceMotion: false }),
        withTiming(1, { duration: speed, reduceMotion: false })
      ),
      -1,
      true
    );
  }, [seconds, isRushRound]);

  const animatedStyle = useAnimatedStyle(() => {
    const currentSeconds = secondsValue.value;
    
    // Rush rounds: Always orange
    if (isRushRound) {
      return {
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
        color: '#FF8C00',
      };
    }
    
    // Normal rounds: Red when <= 3s, white otherwise
    const colorInterpolation = interpolate(
      currentSeconds,
      [0, 3, 10],
      [1, 1, 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
      color: colorInterpolation > 0.5 ? '#FF4458' : '#FFFFFF',
    };
  });

  useEffect(() => {
    if (seconds <= 0 && onExpire) {
      onExpire();
    }
  }, [seconds, onExpire]);

  const displaySeconds = Math.max(0, seconds);

  return (
    <Animated.Text style={[styles.timer, animatedStyle, { fontSize: isRushRound ? 56 : 48 }]}>
      {displaySeconds}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  timer: {
    fontWeight: 'bold',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

