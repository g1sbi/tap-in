import { getHomeBackgroundConfig } from '@/lib/home-background-config';
import { useTheme, useReduceAnimations } from '@/lib/stores';
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Generate random properties for particles using config
function generateParticles(config: ReturnType<typeof getHomeBackgroundConfig>['particles']) {
  const [minSize, maxSize] = config.sizeRange;
  const [minSpeed, maxSpeed] = config.speedRange;
  
  return Array.from({ length: config.count }).map((_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height,
    size: Math.random() * (maxSize - minSize) + minSize,
    duration: Math.random() * (maxSpeed - minSpeed) + minSpeed,
  delay: Math.random() * 2000,
    color: config.colors[Math.floor(Math.random() * config.colors.length)],
}));
}

interface ParticleConfig {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

const Particle = ({ config, isAnimating = false, maxOpacity, enableGlow, direction, reduceAnimations = false }: { config: ParticleConfig; isAnimating?: boolean; maxOpacity: number; enableGlow: boolean; direction: 'up' | 'down' | 'random'; reduceAnimations?: boolean }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const isAnimatingShared = useSharedValue(isAnimating);

  // Update shared value when isAnimating changes
  useEffect(() => {
    isAnimatingShared.value = isAnimating;
  }, [isAnimating]);

  useEffect(() => {
    // Stop animations if reduceAnimations is enabled
    if (reduceAnimations) {
      translateY.value = 0;
      opacity.value = maxOpacity * 0.3; // Static opacity
      return;
    }

    const movement = direction === 'up' ? -100 : 
                    direction === 'down' ? 100 :
                    Math.random() > 0.5 ? -100 : 100;
    
    // Vertical movement - start animation once
    translateY.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(movement, {
          duration: config.duration,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );

    // Opacity fade in/out - use full opacity initially
    opacity.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(maxOpacity, { duration: config.duration * 0.2 }),
          withTiming(maxOpacity, { duration: config.duration * 0.6 }),
          withTiming(0, { duration: config.duration * 0.2 })
        ),
        -1,
        false
      )
    );
  }, [maxOpacity, reduceAnimations]); // Regenerate when maxOpacity or reduceAnimations changes

  // Adjust opacity based on isAnimating state without recreating animations
  const style = useAnimatedStyle(() => {
    const baseOpacity = opacity.value;
    const finalOpacity = isAnimatingShared.value ? baseOpacity * 0.5 : baseOpacity;
    
    return {
    transform: [
      { translateX: config.x },
      { translateY: config.y + translateY.value },
    ],
      opacity: finalOpacity,
    };
  });


  // Disable glow during animation for better performance
  const glowStyle = (enableGlow && !isAnimating) ? {
    shadowColor: config.color,
    shadowRadius: config.size * 2,
    shadowOpacity: 0.8,
  } : {};

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
          ...glowStyle,
        },
      ]}
      renderToHardwareTextureAndroid={true}
    />
  );
};

interface BackgroundParticlesProps {
  isAnimating?: boolean; // When true, reduce effects for performance
}

export default function BackgroundParticles({ isAnimating = false }: BackgroundParticlesProps) {
  const theme = useTheme();
  const reduceAnimations = useReduceAnimations();
  const config = getHomeBackgroundConfig(theme);
  const particlesConfig = config.particles;
  
  // Adjust config based on reduceAnimations setting
  const adjustedConfig = useMemo(() => {
    if (reduceAnimations) {
      return {
        ...particlesConfig,
        count: Math.floor(particlesConfig.count * 0.5), // Reduce by 50%
        enableGlow: false, // Disable glow effects
      };
    }
    return particlesConfig;
  }, [particlesConfig, reduceAnimations]);
  
  // Regenerate particles when theme or reduceAnimations changes
  const particles = useMemo(
    () => generateParticles(adjustedConfig),
    [theme, reduceAnimations]
  );
  
  // Reduce visible particles during animation for performance
  const visibleParticles = isAnimating 
    ? particles.filter((_, i) => i % 2 === 0) // Show every other particle
    : particles;
  
  // Disable glow when animations are reduced
  const effectiveEnableGlow = reduceAnimations ? false : adjustedConfig.enableGlow;

  return (
    <View 
      style={StyleSheet.absoluteFill} 
      pointerEvents="none"
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}>
      {visibleParticles.map((p) => (
        <Particle 
          key={p.id} 
          config={p} 
          isAnimating={isAnimating}
          maxOpacity={adjustedConfig.maxOpacity}
          enableGlow={effectiveEnableGlow}
          direction={adjustedConfig.direction}
          reduceAnimations={reduceAnimations}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
  },
});

