import { useGameState } from '@/lib/game-state';
import { roomManager } from '@/lib/room-manager';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const { actions } = useGameState();

  const handleHostGame = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const code = await roomManager.createRoom();
      actions.setRoom(code, 'host', useGameState.getState().playerId);
      router.push('/lobby');
    } catch (error) {
      Alert.alert('Error', 'Failed to create room. Please try again.');
      console.error(error);
    }
  };

  const handleJoinGame = async () => {
    console.log(`[UI] handleJoinGame called | Room code: ${roomCode} | Length: ${roomCode.length}`);
    
    if (roomCode.length !== 6) {
      console.log(`[UI] Invalid room code length: ${roomCode.length}`);
      Alert.alert('Invalid Code', 'Please enter a 6-digit room code');
      return;
    }

    try {
      console.log(`[UI] Attempting to join room: ${roomCode}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const success = await roomManager.joinRoom(roomCode);
      console.log(`[UI] joinRoom returned: ${success}`);
      
      if (success) {
        console.log(`[UI] Join successful, setting room state and navigating to lobby`);
        actions.setRoom(roomCode, 'guest', useGameState.getState().playerId);
        console.log(`[UI] Navigating to /lobby`);
        router.push('/lobby');
      } else {
        console.error(`[UI] Join failed, showing error alert`);
        Alert.alert('Error', 'Failed to join room. Please check the code and try again.');
      }
    } catch (error) {
      console.error(`[UI] Exception during join:`, error);
      Alert.alert('Error', 'Failed to join room. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Higher Lower Dice</Text>
            <Text style={styles.subtitle}>Simultaneous Multiplayer Betting</Text>
          </View>

          <View style={styles.diceContainer}>
            <View style={styles.dicePlaceholder}>
              <Text style={styles.diceEmoji}>🎲</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleHostGame}>
              <Text style={styles.primaryButtonText}>HOST GAME</Text>
            </TouchableOpacity>

            <View style={styles.joinSection}>
              <TextInput
                style={styles.codeInput}
                value={roomCode}
                onChangeText={setRoomCode}
                placeholder="Enter 6-digit code"
                placeholderTextColor="#666"
                maxLength={6}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleJoinGame}
              />
              <TouchableOpacity style={styles.joinButton} onPress={handleJoinGame}>
                <Text style={styles.joinButtonText}>JOIN GAME</Text>
              </TouchableOpacity>
            </View>
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
    flex: 0.3,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  diceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0.4,
  },
  dicePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceEmoji: {
    fontSize: 56,
  },
  actions: {
    width: '100%',
    gap: 16,
    flex: 0.3,
    justifyContent: 'flex-end',
  },
  primaryButton: {
    backgroundColor: '#00D4FF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  joinSection: {
    gap: 10,
  },
  codeInput: {
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 3,
  },
  joinButton: {
    backgroundColor: '#FF00FF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});
