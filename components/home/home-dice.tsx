import Dice from '@/games/dice-rush/components/dice-2d';
import { homeDiceConfig } from '@/lib/home-dice-config';
import { useReduceAnimations } from '@/lib/stores';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue
} from 'react-native-reanimated';

interface HomeDiceProps {
  size?: number;
}

export default function HomeDice({ size = homeDiceConfig.defaultSize }: HomeDiceProps) {
  const reduceAnimations = useReduceAnimations();
  
  // Dice animation shared values
  const diceScale = useSharedValue(1);
  const diceSkewX = useSharedValue(0);
  const diceSkewY = useSharedValue(0);
  const diceRotateZ = useSharedValue(0);
  
  // Ripple shared values - 3 ripples for idle, more for press
  const ripple1Scale = useSharedValue(1);
  const ripple1Opacity = useSharedValue(0);
  const ripple1SkewX = useSharedValue(0);
  const ripple1SkewY = useSharedValue(0);
  const ripple1ScaleX = useSharedValue(1);
  const ripple1ScaleY = useSharedValue(1);
  
  const ripple2Scale = useSharedValue(1);
  const ripple2Opacity = useSharedValue(0);
  const ripple2SkewX = useSharedValue(0);
  const ripple2SkewY = useSharedValue(0);
  const ripple2ScaleX = useSharedValue(1);
  const ripple2ScaleY = useSharedValue(1);
  
  const ripple3Scale = useSharedValue(1);
  const ripple3Opacity = useSharedValue(0);
  const ripple3SkewX = useSharedValue(0);
  const ripple3SkewY = useSharedValue(0);
  const ripple3ScaleX = useSharedValue(1);
  const ripple3ScaleY = useSharedValue(1);
  
  // Wave phase for synchronization
  const wavePhase = useSharedValue(0);
  
  // Sequential value for the dice (cycles 1→2→3→4→5→6→1...)
  const [diceValue, setDiceValue] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Refs to track intervals and timeouts
  const valueChangeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleRippleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const valueChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimeout1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimeout2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Function to change dice value
  // Cycle through all six dice faces sequentially (1→2→3→4→5→6→1...)
  const changeDiceValue = () => {
    setDiceValue((prevValue) => {
      return prevValue === 6 ? 1 : prevValue + 1;
    });
  };
    
  // Create a single ripple animation with wave distortion
  const createRippleAnimation = (
    scaleValue: SharedValue<number>,
    opacityValue: SharedValue<number>,
    skewXValue: SharedValue<number>,
    skewYValue: SharedValue<number>,
    scaleXValue: SharedValue<number>,
    scaleYValue: SharedValue<number>,
    duration: number,
    delay: number = 0,
    waveIntensity: number = 1
  ) => {
    'worklet';
    
    // Reset ripple
    scaleValue.value = 1;
    opacityValue.value = 0.6;
    skewXValue.value = 0;
    skewYValue.value = 0;
    scaleXValue.value = 1;
    scaleYValue.value = 1;
      
    // Animate scale expansion
    scaleValue.value = withDelay(
      delay,
      withTiming(homeDiceConfig.rippleExpandScale, {
        duration: duration,
        easing: Easing.out(Easing.ease),
      })
    );
    
    // Animate opacity fade out
    opacityValue.value = withDelay(
      delay,
      withTiming(0, {
        duration: duration,
        easing: Easing.out(Easing.ease),
      })
    );

    // Wave distortion is calculated in useAnimatedStyle based on scale progress
  };

  // Trigger value change ripple burst
  const performValueChangeRipple = () => {
    // Clear any existing timeout
    if (valueChangeTimeoutRef.current) {
      clearTimeout(valueChangeTimeoutRef.current);
    }
    
    setIsAnimating(true);
    
    // Only create ripples if enabled
    if (homeDiceConfig.enableValueChangeRipples) {
      // Create 2-3 ripples in quick succession
      createRippleAnimation(
        ripple1Scale,
        ripple1Opacity,
        ripple1SkewX,
        ripple1SkewY,
        ripple1ScaleX,
        ripple1ScaleY,
        homeDiceConfig.valueRippleDuration,
        0,
        1.5
      );
      
      createRippleAnimation(
        ripple2Scale,
        ripple2Opacity,
        ripple2SkewX,
        ripple2SkewY,
        ripple2ScaleX,
        ripple2ScaleY,
        homeDiceConfig.valueRippleDuration,
        homeDiceConfig.valueRippleDuration * 0.3,
        1.5
      );
    }
    
    // Change value at peak of first ripple
    valueChangeTimeoutRef.current = setTimeout(() => {
      changeDiceValue();
      setIsAnimating(false);
      valueChangeTimeoutRef.current = null;
    }, homeDiceConfig.valueRippleDuration * 0.5);
  };

  // Start continuous wave phase animation for synchronization
  const startWavePhase = () => {
    // Don't start if animations are reduced
    if (reduceAnimations) {
      wavePhase.value = 0;
      return;
    }
    
    // Only start wave phase if distortion is enabled
    if (homeDiceConfig.enableWaveDistortion) {
      wavePhase.value = withRepeat(
        withTiming(2 * Math.PI, {
          duration: 2000,
        easing: Easing.linear,
      }),
        -1,
        false
      );
    }
  };

  // Trigger idle ripple (subtle continuous ripples)
  const triggerIdleRipple = () => {
    // Use the next available ripple (cycle through 1, 2, 3)
    const rippleIndex = Math.floor(Math.random() * 3);
    
    if (rippleIndex === 0) {
      createRippleAnimation(
        ripple1Scale,
        ripple1Opacity,
        ripple1SkewX,
        ripple1SkewY,
        ripple1ScaleX,
        ripple1ScaleY,
        homeDiceConfig.idleRippleDuration,
        0,
        0.5
      );
    } else if (rippleIndex === 1) {
      createRippleAnimation(
        ripple2Scale,
        ripple2Opacity,
        ripple2SkewX,
        ripple2SkewY,
        ripple2ScaleX,
        ripple2ScaleY,
        homeDiceConfig.idleRippleDuration,
        0,
        0.5
      );
    } else {
      createRippleAnimation(
        ripple3Scale,
        ripple3Opacity,
        ripple3SkewX,
        ripple3SkewY,
        ripple3ScaleX,
        ripple3ScaleY,
        homeDiceConfig.idleRippleDuration,
        0,
        0.5
      );
    }
  };

  // Start idle ripple cycle
  const startIdleRipples = () => {
    // Don't start if animations are reduced
    if (reduceAnimations) {
      return;
    }
    
    // Only start ripples if enabled
    if (!homeDiceConfig.enableIdleRipples) {
      return;
    }
    
    // Clear any existing interval
    if (idleRippleIntervalRef.current) {
      clearInterval(idleRippleIntervalRef.current);
    }
    
    // Trigger first ripple immediately
    triggerIdleRipple();
    
    // Set up interval for continuous ripples
    idleRippleIntervalRef.current = setInterval(() => {
      triggerIdleRipple();
    }, homeDiceConfig.idleRippleInterval);
  };

  // Start value change cycle
  const startValueChangeCycle = () => {
    // Don't start if animations are reduced
    if (reduceAnimations) {
      return;
    }
    
    // Clear any existing interval
    if (valueChangeIntervalRef.current) {
      clearInterval(valueChangeIntervalRef.current);
    }
    
    // Set up interval for value changes with ripple bursts
    valueChangeIntervalRef.current = setInterval(() => {
      performValueChangeRipple();
    }, homeDiceConfig.valueChangeInterval);
  };

  // Helper function to clean up all animations and intervals
  const cleanupAnimations = useCallback(() => {
    cancelAnimation(diceScale);
    cancelAnimation(diceSkewX);
    cancelAnimation(diceSkewY);
    cancelAnimation(diceRotateZ);
    cancelAnimation(ripple1Scale);
    cancelAnimation(ripple1Opacity);
    cancelAnimation(ripple1SkewX);
    cancelAnimation(ripple1SkewY);
    cancelAnimation(ripple1ScaleX);
    cancelAnimation(ripple1ScaleY);
    cancelAnimation(ripple2Scale);
    cancelAnimation(ripple2Opacity);
    cancelAnimation(ripple2SkewX);
    cancelAnimation(ripple2SkewY);
    cancelAnimation(ripple2ScaleX);
    cancelAnimation(ripple2ScaleY);
    cancelAnimation(ripple3Scale);
    cancelAnimation(ripple3Opacity);
    cancelAnimation(ripple3SkewX);
    cancelAnimation(ripple3SkewY);
    cancelAnimation(ripple3ScaleX);
    cancelAnimation(ripple3ScaleY);
    cancelAnimation(wavePhase);
    
    if (valueChangeIntervalRef.current) {
      clearInterval(valueChangeIntervalRef.current);
      valueChangeIntervalRef.current = null;
    }
    if (idleRippleIntervalRef.current) {
      clearInterval(idleRippleIntervalRef.current);
      idleRippleIntervalRef.current = null;
    }
    if (valueChangeTimeoutRef.current) {
      clearTimeout(valueChangeTimeoutRef.current);
      valueChangeTimeoutRef.current = null;
    }
    if (pressTimeout1Ref.current) {
      clearTimeout(pressTimeout1Ref.current);
      pressTimeout1Ref.current = null;
    }
    if (pressTimeout2Ref.current) {
      clearTimeout(pressTimeout2Ref.current);
      pressTimeout2Ref.current = null;
    }
  }, []);

  // Helper function to reset all shared values to initial state
  const resetSharedValues = useCallback(() => {
    diceScale.value = 1;
    diceSkewX.value = 0;
    diceSkewY.value = 0;
    diceRotateZ.value = 0;
    ripple1Scale.value = 1;
    ripple1Opacity.value = 0;
    ripple1SkewX.value = 0;
    ripple1SkewY.value = 0;
    ripple1ScaleX.value = 1;
    ripple1ScaleY.value = 1;
    ripple2Scale.value = 1;
    ripple2Opacity.value = 0;
    ripple2SkewX.value = 0;
    ripple2SkewY.value = 0;
    ripple2ScaleX.value = 1;
    ripple2ScaleY.value = 1;
    ripple3Scale.value = 1;
    ripple3Opacity.value = 0;
    ripple3SkewX.value = 0;
    ripple3SkewY.value = 0;
    ripple3ScaleX.value = 1;
    ripple3ScaleY.value = 1;
    wavePhase.value = 0;
    setIsAnimating(false);
  }, []);

  // Effect to handle reduceAnimations changes
  useEffect(() => {
    if (reduceAnimations) {
      // Stop all animations and fix dice at value 4
      cleanupAnimations();
      resetSharedValues();
      setDiceValue(4);
      // Stop wave phase explicitly
      cancelAnimation(wavePhase);
      wavePhase.value = 0;
    } else {
      // Restart animations if they were reduced
      cleanupAnimations();
      resetSharedValues();
      startWavePhase();
      startIdleRipples();
      startValueChangeCycle();
    }
  }, [reduceAnimations, cleanupAnimations, resetSharedValues]);

  // Use useFocusEffect to pause/resume animations based on screen visibility
  useFocusEffect(
    useCallback(() => {
      // Screen is focused - reset values and start fresh animations
      resetSharedValues();
      
      if (!reduceAnimations) {
        startWavePhase();
        startIdleRipples();
        startValueChangeCycle();
      } else {
        // If animations are reduced, just set dice to 4
        setDiceValue(4);
        wavePhase.value = 0;
      }

      return () => {
        // Screen loses focus - clean up all animations
        cleanupAnimations();
      };
    }, [resetSharedValues, cleanupAnimations, reduceAnimations])
  );

  // Derived values for wave calculations (only computed if distortion is enabled)
  const wavePhaseDerived = useDerivedValue(() => {
    if (!homeDiceConfig.enableWaveDistortion) return 0;
    return wavePhase.value;
  }, []);

  const waveAmplitude = homeDiceConfig.enableWaveDistortion ? homeDiceConfig.waveAmplitude : 0;
  const waveDistortion = homeDiceConfig.enableWaveDistortion ? homeDiceConfig.waveDistortion : 0;

  // Dice animated style with wave distortion
  const diceAnimatedStyle = useAnimatedStyle(() => {
    // Skip wave calculations if distortion is disabled
    if (!homeDiceConfig.enableWaveDistortion) {
      return {
        transform: [
          { scale: diceScale.value },
          { rotateZ: `${diceRotateZ.value}deg` },
        ],
      };
    }

    // Calculate wave distortion based on phase
    const phase = wavePhaseDerived.value;
    const waveSkewX = Math.sin(phase) * waveAmplitude * 0.3; // Subtle for dice
    const waveSkewY = Math.cos(phase) * waveAmplitude * 0.3;
    const waveScaleX = 1.0 + Math.cos(phase) * waveDistortion * 0.3;
    const waveScaleY = 1.0 - Math.cos(phase) * waveDistortion * 0.3;
    
    return {
      transform: [
        { scale: diceScale.value },
        { scaleX: waveScaleX * (1 + (diceSkewX.value * 0.01)) },
        { scaleY: waveScaleY * (1 + (diceSkewY.value * 0.01)) },
        { skewX: `${waveSkewX + diceSkewX.value}deg` },
        { skewY: `${waveSkewY + diceSkewY.value}deg` },
        { rotateZ: `${diceRotateZ.value}deg` },
      ],
    };
  });

  // Ripple 1 animated style
  const ripple1Style = useAnimatedStyle(() => {
    const progress = (ripple1Scale.value - 1) / (homeDiceConfig.rippleExpandScale - 1);
    
    // Skip wave calculations if distortion is disabled
    if (!homeDiceConfig.enableWaveDistortion) {
      return {
        transform: [{ scale: ripple1Scale.value }],
        opacity: ripple1Opacity.value,
      };
    }
    
    const phase = wavePhaseDerived.value + progress * Math.PI * 2;
    const skewX = Math.sin(phase) * waveAmplitude;
    const skewY = Math.cos(phase) * waveAmplitude;
    const scaleX = 1.0 + Math.cos(phase) * waveDistortion;
    const scaleY = 1.0 - Math.cos(phase) * waveDistortion;
    
    return {
      transform: [
        { scale: ripple1Scale.value },
        { scaleX: scaleX },
        { scaleY: scaleY },
        { skewX: `${skewX}deg` },
        { skewY: `${skewY}deg` },
      ],
      opacity: ripple1Opacity.value,
    };
  });

  // Ripple 2 animated style
  const ripple2Style = useAnimatedStyle(() => {
    const progress = (ripple2Scale.value - 1) / (homeDiceConfig.rippleExpandScale - 1);
    
    // Skip wave calculations if distortion is disabled
    if (!homeDiceConfig.enableWaveDistortion) {
      return {
        transform: [{ scale: ripple2Scale.value }],
        opacity: ripple2Opacity.value,
      };
    }
    
    const phase = wavePhaseDerived.value + progress * Math.PI * 2 + Math.PI / 3;
    const skewX = Math.sin(phase) * waveAmplitude;
    const skewY = Math.cos(phase) * waveAmplitude;
    const scaleX = 1.0 + Math.cos(phase) * waveDistortion;
    const scaleY = 1.0 - Math.cos(phase) * waveDistortion;
    
    return {
      transform: [
        { scale: ripple2Scale.value },
        { scaleX: scaleX },
        { scaleY: scaleY },
        { skewX: `${skewX}deg` },
        { skewY: `${skewY}deg` },
      ],
      opacity: ripple2Opacity.value,
    };
  });

  // Ripple 3 animated style
  const ripple3Style = useAnimatedStyle(() => {
    const progress = (ripple3Scale.value - 1) / (homeDiceConfig.rippleExpandScale - 1);
    
    // Skip wave calculations if distortion is disabled
    if (!homeDiceConfig.enableWaveDistortion) {
      return {
        transform: [{ scale: ripple3Scale.value }],
        opacity: ripple3Opacity.value,
      };
    }
    
    const phase = wavePhaseDerived.value + progress * Math.PI * 2 + (Math.PI * 2) / 3;
    const skewX = Math.sin(phase) * waveAmplitude;
    const skewY = Math.cos(phase) * waveAmplitude;
    const scaleX = 1.0 + Math.cos(phase) * waveDistortion;
    const scaleY = 1.0 - Math.cos(phase) * waveDistortion;
    
    return {
      transform: [
        { scale: ripple3Scale.value },
        { scaleX: scaleX },
        { scaleY: scaleY },
        { skewX: `${skewX}deg` },
        { skewY: `${skewY}deg` },
      ],
      opacity: ripple3Opacity.value,
    };
  });

  const handlePress = () => {
    // Don't react to taps when animations are reduced
    if (reduceAnimations) {
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Cancel current animations
    cancelAnimation(diceScale);
    cancelAnimation(diceSkewX);
    cancelAnimation(diceSkewY);
    cancelAnimation(diceRotateZ);
    
    // Reset dice transforms
    diceSkewX.value = 0;
    diceSkewY.value = 0;
    diceRotateZ.value = 0;
    
    // Explosive press animation: multiple ripples (only if enabled)
    if (homeDiceConfig.enablePressRipples) {
      for (let i = 0; i < homeDiceConfig.pressRippleCount; i++) {
        // Calculate delay: 0 if instant, staggered if enabled
        const delay = homeDiceConfig.staggerPressRipples 
          ? i * (homeDiceConfig.pressRippleDuration / homeDiceConfig.pressRippleCount)
          : 0;
        const rippleIndex = i % 3;
        
        if (rippleIndex === 0) {
          createRippleAnimation(
            ripple1Scale,
            ripple1Opacity,
            ripple1SkewX,
            ripple1SkewY,
            ripple1ScaleX,
            ripple1ScaleY,
            homeDiceConfig.pressRippleDuration,
            delay,
            2.0 // Maximum wave intensity
          );
        } else if (rippleIndex === 1) {
          createRippleAnimation(
            ripple2Scale,
            ripple2Opacity,
            ripple2SkewX,
            ripple2SkewY,
            ripple2ScaleX,
            ripple2ScaleY,
            homeDiceConfig.pressRippleDuration,
            delay,
            2.0
          );
        } else {
          createRippleAnimation(
            ripple3Scale,
            ripple3Opacity,
            ripple3SkewX,
            ripple3SkewY,
            ripple3ScaleX,
            ripple3ScaleY,
            homeDiceConfig.pressRippleDuration,
            delay,
            2.0
          );
        }
      }
    }
    
    // Dice scale burst with spring
    diceScale.value = withSpring(homeDiceConfig.pressBurst.scaleAmount, {
      damping: homeDiceConfig.pressBurst.damping,
      stiffness: homeDiceConfig.pressBurst.stiffness,
    });
    
    // Extreme wave distortion on dice (only if enabled)
    if (homeDiceConfig.enableWaveDistortion && homeDiceConfig.waveAmplitude > 0) {
      diceSkewX.value = withSequence(
        withTiming(homeDiceConfig.waveAmplitude * 2, {
          duration: homeDiceConfig.pressRippleDuration / 2,
          easing: Easing.out(Easing.ease),
        }),
        withTiming(-homeDiceConfig.waveAmplitude * 2, {
          duration: homeDiceConfig.pressRippleDuration / 2,
          easing: Easing.in(Easing.ease),
        }),
        withTiming(0, {
          duration: homeDiceConfig.pressRippleDuration / 4,
          easing: Easing.out(Easing.ease),
        })
      );
      
      diceSkewY.value = withSequence(
        withTiming(-homeDiceConfig.waveAmplitude * 2, {
          duration: homeDiceConfig.pressRippleDuration / 2,
          easing: Easing.out(Easing.ease),
        }),
        withTiming(homeDiceConfig.waveAmplitude * 2, {
          duration: homeDiceConfig.pressRippleDuration / 2,
          easing: Easing.in(Easing.ease),
        }),
        withTiming(0, {
          duration: homeDiceConfig.pressRippleDuration / 4,
          easing: Easing.out(Easing.ease),
        })
      );
    }
    
    // Quick rotation
    diceRotateZ.value = withTiming(diceRotateZ.value + homeDiceConfig.pressRotationAmount, {
      duration: homeDiceConfig.pressRotationDuration,
      easing: Easing.out(Easing.cubic),
    });
    
    // Clear any existing press timeouts
    if (pressTimeout1Ref.current) {
      clearTimeout(pressTimeout1Ref.current);
    }
    if (pressTimeout2Ref.current) {
      clearTimeout(pressTimeout2Ref.current);
    }
    
    // Change value during first ripple
    pressTimeout1Ref.current = setTimeout(() => {
    changeDiceValue();
      pressTimeout1Ref.current = null;
    }, homeDiceConfig.pressRippleDuration * 0.3);

    // Return dice scale to normal and resume idle
    pressTimeout2Ref.current = setTimeout(() => {
      diceScale.value = withSpring(1.0, {
        damping: homeDiceConfig.returnToNormal.damping,
        stiffness: homeDiceConfig.returnToNormal.stiffness,
      });
      pressTimeout2Ref.current = null;
    }, homeDiceConfig.pressRippleDuration);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={reduceAnimations}
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
      android_ripple={reduceAnimations ? undefined : {
        color: 'rgba(255, 255, 255, 0.2)',
        borderless: true,
        radius: size / 2,
      }}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !reduceAnimations && styles.pressablePressed,
        reduceAnimations && styles.pressableDisabled,
      ]}>
      <View style={[styles.rippleContainer, { width: size * 3, height: size * 3 }]}>
        {/* Ripple layers */}
        <Animated.View style={[styles.ripple, { width: size, height: size }, ripple1Style]} />
        <Animated.View style={[styles.ripple, { width: size, height: size }, ripple2Style]} />
        <Animated.View style={[styles.ripple, { width: size, height: size }, ripple3Style]} />
        
        {/* Dice in center */}
        <Animated.View style={[styles.diceContainer, { width: size, height: size }, diceAnimatedStyle]}>
          <Dice value={diceValue} size={size} animated={isAnimating} variant="transparent" />
      </Animated.View>
      </View>
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
  pressableDisabled: {
    opacity: 1,
  },
  rippleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  ripple: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: homeDiceConfig.rippleStyle.borderRadius,
    borderWidth: homeDiceConfig.rippleStyle.borderWidth,
    borderColor: homeDiceConfig.rippleStyle.borderColor,
    backgroundColor: homeDiceConfig.rippleStyle.backgroundColor,
  },
  diceContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
});

