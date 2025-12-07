import { getHomeBackgroundConfig } from '@/lib/home-background-config';
import { useTheme, useReduceAnimations } from '@/lib/stores';
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Path, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface WaveLayerProps {
  color: string;
  index: number;
  totalLayers: number;
  animationSpeed: number;
  amplitude: number;
  opacity: number;
  isAnimating?: boolean;
}

const WaveLayer = ({ color, index, totalLayers, animationSpeed, amplitude, opacity, isAnimating = false, reduceAnimations = false }: WaveLayerProps & { isAnimating?: boolean; reduceAnimations?: boolean }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scaleX = useSharedValue(1);

  useEffect(() => {
    // Stop animations if reduceAnimations is enabled or during dice reveal
    if (reduceAnimations || isAnimating) {
      translateX.value = 0;
      translateY.value = 0;
      scaleX.value = 1;
      return;
    }

    const speed = animationSpeed + (index * 1000);
    const direction = index % 2 === 0 ? 1 : -1;
    
    // Horizontal wave movement
    translateX.value = withRepeat(
      withTiming(width * 0.5 * direction, {
        duration: speed,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    // Vertical wave movement
    translateY.value = withRepeat(
      withTiming(height * 0.2 * amplitude * direction, {
        duration: speed * 1.5,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    // Scale for wave effect
    scaleX.value = withRepeat(
      withTiming(1.2 + (amplitude * 0.1), {
        duration: speed * 1.2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );
  }, [isAnimating, reduceAnimations]);

  const animatedStyle = useAnimatedStyle(() => {
    // Reduce opacity during animation for performance
    const baseOpacity = opacity * (1 - index * 0.06);
    const finalOpacity = isAnimating ? baseOpacity * 0.3 : baseOpacity;
    
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scaleX: scaleX.value },
      ],
      opacity: finalOpacity,
    };
  });

  // Create wave path using SVG - optimized with fewer segments for better performance
  const wavePath = useMemo(() => {
    // Reduce segments from 30 to 20 for better performance (still smooth enough)
    const segments = 20;
    const waveAmplitude = (amplitude * height) / totalLayers / 3;
    const frequency = 2 + (index * 0.3);
    const baseY = (height / totalLayers) * index;
    
    let path = `M 0 ${baseY}`;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = t * width;
      const y = baseY + waveAmplitude * Math.sin(t * frequency * Math.PI * 2);
      
      if (i === 0) {
        path += ` M ${x} ${y}`;
      } else {
        const prevT = (i - 1) / segments;
        const prevX = prevT * width;
        const prevY = baseY + waveAmplitude * Math.sin(prevT * frequency * Math.PI * 2);
        
        // Simplified control points calculation
        const cp1X = prevX + (x - prevX) / 3;
        const cp1Y = prevY;
        const cp2X = prevX + (x - prevX) * 2 / 3;
        const cp2Y = y;
        
        path += ` C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${x} ${y}`;
      }
    }
    
    path += ` L ${width} ${height} L 0 ${height} Z`;
    return path;
  }, [index, totalLayers, amplitude]);

  // Create gradient colors
  const gradientColors = [
    adjustColorBrightness(color, 0.15),
    color,
    adjustColorBrightness(color, -0.1),
  ];

  const layerOpacity = opacity * (1 - index * 0.06);

  return (
    <Animated.View 
      style={[StyleSheet.absoluteFill, animatedStyle]} 
      pointerEvents="none"
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
            {gradientColors.map((gradColor, i) => (
              <Stop
                key={i}
                offset={`${(i / (gradientColors.length - 1)) * 100}%`}
                stopColor={gradColor}
                stopOpacity={layerOpacity}
              />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Path
          d={wavePath}
          fill={`url(#gradient-${index})`}
          opacity={layerOpacity}
        />
      </Svg>
    </Animated.View>
  );
};

// Helper function to adjust color brightness
function adjustColorBrightness(color: string, factor: number): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  const newR = Math.max(0, Math.min(255, Math.round(r + (255 - r) * factor)));
  const newG = Math.max(0, Math.min(255, Math.round(g + (255 - g) * factor)));
  const newB = Math.max(0, Math.min(255, Math.round(b + (255 - b) * factor)));
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

interface BackgroundGradientWavesProps {
  isAnimating?: boolean; // When true, reduce effects for performance
}

export default function BackgroundGradientWaves({ isAnimating = false }: BackgroundGradientWavesProps) {
  const theme = useTheme();
  const reduceAnimations = useReduceAnimations();
  const bgConfig = getHomeBackgroundConfig(theme);
  const config = bgConfig.gradientWaves;
  const { layerCount, colors, animationSpeed, amplitude, opacity } = config;

  // Adjust layer count based on reduceAnimations setting
  const effectiveLayerCount = reduceAnimations 
    ? Math.floor(layerCount * 0.5) // Reduce by 50%
    : layerCount;

  // Distribute colors across layers
  const layerColors = useMemo(() => {
    return Array.from({ length: effectiveLayerCount }).map((_, i) => {
      const colorIndex = Math.floor((i / effectiveLayerCount) * colors.length);
      return colors[Math.min(colorIndex, colors.length - 1)];
    });
  }, [effectiveLayerCount, colors]);

  // Reduce visible layers during animation for performance
  const visibleLayers = isAnimating 
    ? layerColors.filter((_, i) => i % 2 === 0) // Show every other layer
    : layerColors;

  return (
    <>
      {visibleLayers.map((color, originalIndex) => {
        // Map back to original index for proper animation speeds
        const index = isAnimating ? originalIndex * 2 : originalIndex;
        return (
          <WaveLayer
            key={index}
            color={color}
            index={index}
            totalLayers={effectiveLayerCount}
            animationSpeed={animationSpeed}
            amplitude={amplitude}
            opacity={opacity}
            isAnimating={isAnimating}
            reduceAnimations={reduceAnimations}
          />
        );
      })}
    </>
  );
}
