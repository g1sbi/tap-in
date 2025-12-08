/**
 * Tap In Gradient Background
 * 
 * Simple static gradient background for the Tap In home screen.
 * No animations, no theme dependencies - neutral platform styling.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';

export default function GradientBackground() {
  return (
    <LinearGradient
      colors={['#0A0A0A', '#1A1A2E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    />
  );
}

const styles = StyleSheet.create({
  gradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
});

