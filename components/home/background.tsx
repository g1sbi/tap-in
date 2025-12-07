import { getHomeBackgroundConfig } from '@/lib/home-background-config';
import { useTheme } from '@/lib/stores';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import BackgroundGradientWaves from './background-gradient-waves';
import BackgroundParticles from './background-particles';

interface BackgroundProps {
  isAnimating?: boolean; // When true, background reduces complexity for performance
}

// Background selector component that renders the appropriate background
// based on the config
export default function Background({ isAnimating = false }: BackgroundProps) {
  const theme = useTheme();
  const config = getHomeBackgroundConfig(theme);
  const { backgroundType, backgroundColor } = config;

  return (
    <View 
      style={[styles.container, { backgroundColor }]}
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}>
      {backgroundType === 'particles' && <BackgroundParticles isAnimating={isAnimating} />}
      {backgroundType === 'gradient-waves' && <BackgroundGradientWaves isAnimating={isAnimating} />}
      {/* 'none' type just shows backgroundColor */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1, // Ensure background stays behind all content
  },
});

