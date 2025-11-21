import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

interface DiceProps {
  value: number;
  size?: number;
  animated?: boolean;
}

const DICE_POSITIONS: { [key: number]: Array<{ x: number; y: number }> } = {
  1: [{ x: 0.5, y: 0.5 }],
  2: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }],
  3: [{ x: 0.25, y: 0.25 }, { x: 0.5, y: 0.5 }, { x: 0.75, y: 0.75 }],
  4: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.25, y: 0.75 }, { x: 0.75, y: 0.75 }],
  5: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.5, y: 0.5 },
    { x: 0.25, y: 0.75 },
    { x: 0.75, y: 0.75 },
  ],
  6: [
    { x: 0.25, y: 0.2 },
    { x: 0.75, y: 0.2 },
    { x: 0.25, y: 0.5 },
    { x: 0.75, y: 0.5 },
    { x: 0.25, y: 0.8 },
    { x: 0.75, y: 0.8 },
  ],
};

const Dot = ({ size }: { size: number }) => (
  <View
    style={[
      styles.dot,
      {
        width: size * 0.15,
        height: size * 0.15,
        borderRadius: (size * 0.15) / 2,
      },
    ]}
  />
);

export default function Dice({ value, size = 120, animated = false }: DiceProps) {
  const rotationX = useSharedValue(0);
  const rotationY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (animated) {
      rotationX.value = withSequence(
        withRepeat(
          withTiming(360, { duration: 150, reduceMotion: false }),
          3,
          false
        ),
        withTiming(0, { duration: 300, reduceMotion: false })
      );
      rotationY.value = withSequence(
        withRepeat(
          withTiming(360, { duration: 180, reduceMotion: false }),
          3,
          false
        ),
        withTiming(0, { duration: 300, reduceMotion: false })
      );
      scale.value = withSequence(
        withTiming(1.2, { duration: 100, reduceMotion: false }),
        withTiming(1, { duration: 200, reduceMotion: false })
      );
    }
  }, [value, animated]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1000 },
        { rotateX: `${rotationX.value}deg` },
        { rotateY: `${rotationY.value}deg` },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  const positions = DICE_POSITIONS[value] || DICE_POSITIONS[1];
  const dotSize = size * 0.15;

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, animatedStyle]}>
      <View
        style={[
          styles.dice,
          {
            width: size,
            height: size,
            borderRadius: size * 0.2,
          },
        ]}>
        <View style={styles.face}>
          {positions.map((pos, index) => (
            <View
              key={index}
              style={[
                {
                  position: 'absolute',
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  transform: [{ translateX: -dotSize / 2 }, { translateY: -dotSize / 2 }],
                },
              ]}>
              <Dot size={size} />
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dice: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  face: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  dot: {
    backgroundColor: '#000000',
  },
});

