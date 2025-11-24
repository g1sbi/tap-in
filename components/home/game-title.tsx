import { APP_INFO } from '@/constants/app-info';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function GameTitle() {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.diceText}>DICE</Text>
        <Text style={styles.rushText}>RUSH</Text>
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
  diceText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    // Subtle shadow for lift
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 4,
  },
  rushText: {
    fontSize: 42,
    fontWeight: '300', // Thin style
    color: '#00D4FF', // Cyan accent
    fontStyle: 'italic', // Speed
    letterSpacing: 0,
    textShadowColor: 'rgba(0, 212, 255, 0.4)', // Glow matching the text
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
