import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Prediction } from '@/lib/game-logic';

interface BettingPanelProps {
  maxAmount: number;
  onBet: (amount: number, prediction: Prediction) => void;
  disabled?: boolean;
  locked?: boolean;
}

export default function BettingPanel({ maxAmount, onBet, disabled = false, locked = false }: BettingPanelProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const quickBets = [
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50%', value: Math.floor(maxAmount * 0.5) },
    { label: 'ALL IN', value: maxAmount },
  ];

  const handleAmountSelect = (amount: number) => {
    if (locked || disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAmount(amount);
  };

  const handlePrediction = (prediction: Prediction) => {
    if (locked || disabled || selectedAmount === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onBet(selectedAmount, prediction);
  };

  return (
    <View style={styles.container}>
      <View style={styles.amountSection}>
        <Text style={styles.label}>Bet Amount</Text>
        <View style={styles.quickBets}>
          {quickBets.map((bet) => (
            <TouchableOpacity
              key={bet.label}
              style={[
                styles.betButton,
                selectedAmount === bet.value && styles.betButtonSelected,
                (locked || disabled) && styles.betButtonDisabled,
              ]}
              onPress={() => handleAmountSelect(bet.value)}
              disabled={locked || disabled}>
              <Text
                style={[
                  styles.betButtonText,
                  selectedAmount === bet.value && styles.betButtonTextSelected,
                ]}>
                {bet.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.predictionSection}>
        <Text style={styles.label}>Prediction</Text>
        <View style={styles.predictionButtons}>
          <TouchableOpacity
            style={[
              styles.predictionButton,
              styles.higherButton,
              (locked || disabled || selectedAmount === null) && styles.predictionButtonDisabled,
            ]}
            onPress={() => handlePrediction('higher')}
            disabled={locked || disabled || selectedAmount === null}>
            <Text style={styles.predictionButtonText}>HIGHER</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.predictionButton,
              styles.lowerButton,
              (locked || disabled || selectedAmount === null) && styles.predictionButtonDisabled,
            ]}
            onPress={() => handlePrediction('lower')}
            disabled={locked || disabled || selectedAmount === null}>
            <Text style={styles.predictionButtonText}>LOWER</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  amountSection: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  quickBets: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  betButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2A2A2A',
    borderWidth: 2,
    borderColor: '#3A3A3A',
  },
  betButtonSelected: {
    backgroundColor: '#00D4FF',
    borderColor: '#00D4FF',
  },
  betButtonDisabled: {
    opacity: 0.5,
  },
  betButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  betButtonTextSelected: {
    color: '#000000',
  },
  predictionSection: {
    gap: 8,
  },
  predictionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  predictionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  higherButton: {
    backgroundColor: '#00D4FF',
  },
  lowerButton: {
    backgroundColor: '#FF00FF',
  },
  predictionButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#2A2A2A',
  },
  predictionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});

