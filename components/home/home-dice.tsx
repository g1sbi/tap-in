import Dice from '@/components/game/dice-2d';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';

interface HomeDiceProps {
  size?: number;
}

export default function HomeDice({ size = 120 }: HomeDiceProps) {
  // Continuous slow rotation values - only Y axis (vertical)
  const rotationY = useSharedValue(0);
  const scale = useSharedValue(1);
  
  // Random value for the dice (changes on touch and when perpendicular to observer)
  const [diceValue, setDiceValue] = useState(3);
  
  // Function to change dice value (called from worklet)
  // Ensures the new value is always different from the previous one
  const changeDiceValue = () => {
    setDiceValue((prevValue) => {
      let newValue;
      do {
        newValue = Math.floor(Math.random() * 6) + 1;
      } while (newValue === prevValue);
      return newValue;
    });
  };

  // Start continuous rotation animation with pauses at parallel positions (0°, 180°)
  // Fast rotation between stops, pause when face is parallel to observer
  const startContinuousRotation = () => {
    const currentRotation = rotationY.value;
    
    // Normalize current rotation to nearest multiple of 180° to prevent drift
    const normalized = Math.round(currentRotation / 180) * 180;
    const nextTarget = normalized + 180;
    
    // Configuration: adjust these values to change animation behavior
    const ROTATION_DURATION = 800; // Time to rotate 180° in milliseconds
    const PAUSE_DURATION = 200;     // Pause time at parallel position in milliseconds
    
    // Change dice value slightly before the midpoint to compensate for setTimeout delay
    // Anticipate by 60ms to ensure change happens when opacity is at minimum
    const FACE_CHANGE_OFFSET = 50; // milliseconds before midpoint
    setTimeout(() => {
      changeDiceValue();
    }, (ROTATION_DURATION / 2) - FACE_CHANGE_OFFSET);
    
    // Single 180° rotation with pause, then call itself again
    // Using runOnJS to avoid stack overflow from worklet recursion
    rotationY.value = withSequence(
      // Fast rotation to next parallel position (180° away)
      // Linear easing ensures midpoint of time = midpoint of rotation (90°)
      withTiming(nextTarget, {
        duration: ROTATION_DURATION,
        easing: Easing.linear,
      }),
      // Pause at parallel position
      withDelay(PAUSE_DURATION, withTiming(nextTarget, { 
        duration: 0,
      }, (finished) => {
        'worklet';
        if (finished) {
          // Call startContinuousRotation again via runOnJS to continue the loop
          // This prevents stack overflow by moving execution back to JS thread
          runOnJS(startContinuousRotation)();
        }
      }))
    );
  };


  // Continuous slow rotation animation
  useEffect(() => {
    startContinuousRotation();
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotationY.value}deg` },
        { scale: scale.value },
      ],
    };
  });

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Cancel current animations
    cancelAnimation(rotationY);
    
    const currentRotation = rotationY.value;
    // Normalize to nearest 180° multiple to prevent drift after spin
    const normalized = Math.round(currentRotation / 180) * 180;
    const targetRotation = normalized + 720;
    
    // Quick spin animation on touch - only around Y axis
    // Use withTiming instead of withSpring for more predictable duration
    rotationY.value = withTiming(targetRotation, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      'worklet';
      if (finished) {
        // Resume continuous rotation from current position after spin completes
        // Must use runOnJS to call JavaScript function from worklet
        runOnJS(startContinuousRotation)();
      }
    });
    
    // Scale bounce effect - less bouncy
    scale.value = withSpring(1.1, {
      damping: 15,
      stiffness: 180,
    }, () => {
      scale.value = withSpring(1, {
        damping: 18,
        stiffness: 150,
      });
    });
    
    // Change dice value randomly (different from current)
    changeDiceValue();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
      android_ripple={{
        color: 'rgba(255, 255, 255, 0.2)',
        borderless: true,
        radius: size / 2,
      }}
      style={({ pressed }) => [
        styles.pressable,
        pressed && styles.pressablePressed,
      ]}>
          <Animated.View style={[styles.container, { width: size, height: size }, animatedStyle]}>
            <Dice value={diceValue} size={size} animated={false} variant="transparent" />
          </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressablePressed: {
    opacity: Platform.OS === 'ios' ? 0.7 : 1,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
});

