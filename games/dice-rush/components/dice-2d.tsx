import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming
} from 'react-native-reanimated';

interface DiceProps {
  value: number;
  size?: number;
  animated?: boolean;
  variant?: 'transparent' | 'solid';
}

// Tight positions for transparent dice (home)
const DICE_POSITIONS_TIGHT: { [key: number]: Array<{ x: number; y: number }> } = {
  1: [{ x: 0.5, y: 0.5 }],
  2: [{ x: 0.15, y: 0.15 }, { x: 0.85, y: 0.85 }],
  3: [{ x: 0.15, y: 0.15 }, { x: 0.5, y: 0.5 }, { x: 0.85, y: 0.85 }],
  4: [{ x: 0.15, y: 0.15 }, { x: 0.85, y: 0.15 }, { x: 0.15, y: 0.85 }, { x: 0.85, y: 0.85 }],
  5: [
    { x: 0.15, y: 0.15 },
    { x: 0.85, y: 0.15 },
    { x: 0.5, y: 0.5 },
    { x: 0.15, y: 0.85 },
    { x: 0.85, y: 0.85 },
  ],
  6: [
    { x: 0.15, y: 0.15 },
    { x: 0.85, y: 0.15 },
    { x: 0.15, y: 0.5 },
    { x: 0.85, y: 0.5 },
    { x: 0.15, y: 0.85 },
    { x: 0.85, y: 0.85 },
  ],
};

// Normal positions for solid dice (game)
const DICE_POSITIONS_NORMAL: { [key: number]: Array<{ x: number; y: number }> } = {
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

interface DotProps {
  size: number;
  variant: 'transparent' | 'solid';
}

const Dot = ({ size, variant }: DotProps) => {
  const dotStyle = variant === 'transparent' 
    ? styles.dotTransparent 
    : styles.dotSolid;
  
  return (
  <View
    style={[
        dotStyle,
      {
        width: size * 0.15,
        height: size * 0.15,
        borderRadius: (size * 0.15) / 2,
      },
    ]}
  />
);
};

interface DiceFaceProps {
  faceValue: number;
  size: number;
  variant: 'transparent' | 'solid';
}

const DiceFace = ({ faceValue, size, variant }: DiceFaceProps) => {
  const DICE_POSITIONS = variant === 'transparent' 
    ? DICE_POSITIONS_TIGHT 
    : DICE_POSITIONS_NORMAL;
  const positions = DICE_POSITIONS[faceValue] || DICE_POSITIONS[1];
  const dotSize = size * 0.15;
  
  const faceStyle = variant === 'transparent'
    ? styles.faceTransparent
    : styles.faceSolid;

  return (
    <View
      style={[
        faceStyle,
        {
          width: size,
          height: size,
          borderRadius: size * 0.2,
        },
      ]}>
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
          <Dot size={size} variant={variant} />
        </View>
      ))}
    </View>
  );
};

export default function Dice({ value, size = 120, animated = false, variant = 'solid' }: DiceProps) {
  const rotationY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (animated) {
      // Cancel any existing animations to prevent overlap
      cancelAnimation(rotationY);
      cancelAnimation(scale);

      // Reset to start position
      rotationY.value = 0;
      scale.value = 1;

      // Fast rotation for quick results display
      rotationY.value = withSequence(
        withTiming(360, { duration: 350 }), // Fast rotation (350ms)
        withTiming(0, { duration: 0 }) // Instant reset for next time
      );
      
      // Pop effect - faster to match rotation
      scale.value = withSequence(
        withTiming(1.2, { duration: 150 }),
        withTiming(1, { duration: 200 })
      );
    }
  }, [value, animated]);

  // Pre-calculate rotation-derived values only when animated
  const rotationDerived = useDerivedValue(() => {
    if (!animated) return 0;
    return rotationY.value % 360;
  }, [animated]);

  const angleFromPerpendicularDerived = useDerivedValue(() => {
    if (!animated) return 90; // Max visibility when not animating
    const rotation = rotationDerived.value;
    return Math.abs((rotation % 180) - 90);
  }, [animated]);

  // Constants for fade calculation
  const FADE_THRESHOLD = 25;
  const THICKNESS_MULTIPLIER = 0.5;

  const animatedStyle = useAnimatedStyle(() => {
    // Skip expensive calculations when not animated
    if (!animated) {
      return {
        transform: [
          { scale: scale.value },
        ],
        opacity: opacity.value,
      };
    }

    // Calculate scale based on rotation to simulate thickness
    const angleFromPerpendicular = angleFromPerpendicularDerived.value;
    // Simplified thickness calculation - avoid Math.cos when possible
    const thicknessScale = 1 + (Math.cos((angleFromPerpendicular * Math.PI) / 180) * THICKNESS_MULTIPLIER);
    
    // Simplified fade calculation - use square instead of cubic for better performance
    const fadeOpacity = angleFromPerpendicular < FADE_THRESHOLD
      ? Math.pow(angleFromPerpendicular / FADE_THRESHOLD, 2) // Square fade (faster than cubic)
      : 1;
    
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotationY.value}deg` },
        { scale: scale.value * thicknessScale },
      ],
      opacity: opacity.value * fadeOpacity,
    };
  });

  // Single face with wave distortion effects
  return (
    <Animated.View 
      style={[styles.container, { width: size, height: size }, animatedStyle]}
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}>
      <DiceFace faceValue={value} size={size} variant={variant} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Ensure dice renders above background
  },
  faceTransparent: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  faceSolid: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
  },
  dotTransparent: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  dotSolid: {
    backgroundColor: '#000000',
  },
});

