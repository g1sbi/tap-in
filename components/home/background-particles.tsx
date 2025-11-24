import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  withDelay,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Generate random properties for particles
const NUM_PARTICLES = 15;
const particles = Array.from({ length: NUM_PARTICLES }).map((_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height,
  size: Math.random() * 4 + 2, // 2-6px
  duration: Math.random() * 5000 + 5000, // 5-10s
  delay: Math.random() * 2000,
  color: Math.random() > 0.5 ? '#00D4FF' : '#FF00FF', // Cyan or Magenta
}));

const Particle = ({ config }: { config: typeof particles[0] }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Vertical movement (floating up)
    translateY.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(-100, {
          duration: config.duration,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );

    // Opacity fade in/out
    opacity.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: config.duration * 0.2 }),
          withTiming(0.6, { duration: config.duration * 0.6 }),
          withTiming(0, { duration: config.duration * 0.2 })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: config.x },
      { translateY: config.y + translateY.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        {
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
          shadowColor: config.color,
          shadowRadius: config.size * 2,
          shadowOpacity: 0.8,
        },
      ]}
    />
  );
};

export default function BackgroundParticles() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <Particle key={p.id} config={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
  },
});

