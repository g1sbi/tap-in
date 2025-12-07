import { APP_INFO } from '@/constants/app-info';
import { useColors } from '@/lib/stores';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function GameTitle() {
  const colors = useColors();
  // Convert hex to rgba for shadow
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.tapText}>TAP</Text>
        <Text style={[styles.inText, { color: colors.primary, textShadowColor: hexToRgba(colors.primary, 0.4) }]}>IN</Text>
      </View>
      
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeText}>{APP_INFO.SUBTITLE}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  tapText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    // Subtle shadow for lift
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 4,
  },
  inText: {
    fontSize: 42,
    fontWeight: '300', // Thin style
    fontStyle: 'italic',
    letterSpacing: 0,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  badgeContainer: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  badgeText: {
    fontSize: 12,
    color: '#CCCCCC',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'none',
  },
});
