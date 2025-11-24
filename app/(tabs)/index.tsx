import BackgroundParticles from '@/components/home/background-particles';
import GameTitle from '@/components/home/game-title';
import HomeDice from '@/components/home/home-dice';
import { getVersionString } from '@/constants/app-info';
import { gameConfig } from '@/lib/game-config';
import { useGameState } from '@/lib/game-state';
import { logger } from '@/lib/logger';
import { roomManager } from '@/lib/room-manager';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { actions, playerId } = useGameState();

  const handleHostGame = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const code = await roomManager.createRoom();
      actions.setRoom(code, 'host', playerId);
      router.push('/lobby');
    } catch (error) {
      logger.error('HomeScreen', 'Failed to create room', error);
      Alert.alert('Error', 'Failed to create room. Please try again.');
    }
  };

  const handleJoinGame = async () => {
    if (roomCode.length === 0) {
      return;
    }
    
    if (roomCode.length !== gameConfig.ROOM_CODE_LENGTH) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit room code');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const success = await roomManager.joinRoom(roomCode);
      
      if (success) {
        actions.setRoom(roomCode, 'guest', playerId);
        router.push('/lobby');
      } else {
        Alert.alert('Error', 'Failed to join room. Please check the code and try again.');
      }
    } catch (error) {
      logger.error('HomeScreen', 'Exception during join', error);
      Alert.alert('Error', 'Failed to join room. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackgroundParticles />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={styles.content}>
          <View style={styles.header}>
            <GameTitle />
          </View>

          {!isInputFocused && (
            <View style={styles.diceContainer}>
              <HomeDice size={170} />
            </View>
          )}

          <View style={[styles.actions, isInputFocused && styles.actionsFocused]}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleHostGame}>
              <Text style={styles.primaryButtonText}>HOST GAME</Text>
            </TouchableOpacity>

            <View style={styles.joinSection}>
              <TextInput
                style={styles.codeInput}
                value={roomCode}
                onChangeText={setRoomCode}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder="Enter 6-digit code"
                placeholderTextColor="#666"
                maxLength={gameConfig.ROOM_CODE_LENGTH}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleJoinGame}
              />
              <TouchableOpacity style={styles.joinButton} onPress={handleJoinGame}>
                <Text style={styles.joinButtonText}>JOIN GAME</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.version}>{getVersionString()}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    gap: 6,
    flex: 0.25,
    justifyContent: 'center',
  },
  version: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  diceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0.35,
  },
  actions: {
    width: '100%',
    gap: 16,
    flex: 0.4,
    justifyContent: 'flex-end',
  },
  actionsFocused: {
    flex: 0.8, // More space when keyboard is open
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#00D4FF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
    // Neon Glow
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  joinSection: {
    gap: 10,
  },
  codeInput: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 3,
    // Subtle glow
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  joinButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF00FF',
    // Magenta Glow
    shadowColor: '#FF00FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  joinButtonText: {
    color: '#FF00FF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});
