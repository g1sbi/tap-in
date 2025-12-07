import Background from '@/components/home/background';
import GameTitle from '@/components/home/game-title';
import HomeDice from '@/components/home/home-dice';
import ThemeMenu from '@/components/ui/theme-menu';
import { getVersionString } from '@/constants/app-info';
import { useColors } from '@/lib/stores';
import { logger } from '@/lib/logger';
import { unifiedRoomManager } from '@/lib/room/room-manager';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [roomCodeError, setRoomCodeError] = useState<string | null>(null);
  const [showGameModal, setShowGameModal] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const colors = useColors();

  /**
   * Sanitizes room code input by removing non-numeric characters and limiting to 6 digits.
   */
  const sanitizeRoomCode = (input: string): string => {
    return input.replace(/[^0-9]/g, '').slice(0, 6);
  };

  /**
   * Handles room code input changes with real-time sanitization.
   */
  const handleRoomCodeChange = (text: string) => {
    const sanitized = sanitizeRoomCode(text);
    setRoomCode(sanitized);
    if (roomCodeError) {
      setRoomCodeError(null);
    }
  };

  /**
   * Validates room code when input loses focus.
   */
  const handleRoomCodeBlur = () => {
    setIsInputFocused(false);
    if (roomCode.length > 0 && roomCode.length !== 6) {
      setRoomCodeError('Room code must be 6 digits');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      setRoomCodeError(null);
    }
  };

  const handleCreateRoom = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name Required', 'Please enter your display name');
      return;
    }

    try {
      setIsCreating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const room = await unifiedRoomManager.createRoom({
        displayName: displayName.trim(),
        maxPlayers: 8,
      });
      logger.info('HomeScreen', 'Room created', { roomId: room.id, code: room.code });
      router.push('/lobby');
    } catch (error) {
      logger.error('HomeScreen', 'Failed to create room', error);
      Alert.alert('Error', 'Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (roomCode.length === 0) {
      return;
    }
    
    if (roomCode.length !== 6) {
      setRoomCodeError('Room code must be 6 digits');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Code', 'Please enter a 6-digit room code');
      return;
    }

    if (!displayName.trim()) {
      Alert.alert('Name Required', 'Please enter your display name');
      return;
    }
    
    setRoomCodeError(null);

    try {
      setIsJoining(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const room = await unifiedRoomManager.joinRoom({
        code: roomCode,
        displayName: displayName.trim(),
      });
      logger.info('HomeScreen', 'Joined room', { roomId: room.id, code: room.code });
      router.push('/lobby');
    } catch (error) {
      logger.error('HomeScreen', 'Exception during join', error);
      const message = error instanceof Error ? error.message : 'Failed to join room. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleChooseGame = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowGameModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Background />
      <ThemeMenu />
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
            <TextInput
              style={styles.nameInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="#666"
              maxLength={20}
              autoCapitalize="words"
            />

            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: colors.primary, shadowColor: colors.primary }]} 
              onPress={handleCreateRoom}
              disabled={isCreating || isJoining}>
              {isCreating ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#000000" />
                  <Text style={[styles.primaryButtonText, { marginLeft: 8 }]}>CREATING...</Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>CREATE ROOM</Text>
              )}
            </TouchableOpacity>

            <View style={styles.joinSection}>
              <TextInput
                style={[styles.codeInput, roomCodeError && styles.codeInputError]}
                value={roomCode}
                onChangeText={handleRoomCodeChange}
                onFocus={() => setIsInputFocused(true)}
                onBlur={handleRoomCodeBlur}
                placeholder="Enter 6-digit code"
                placeholderTextColor="#666"
                maxLength={6}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={isJoining ? undefined : handleJoinRoom}
                editable={!isJoining && !isCreating}
              />
              {roomCodeError && (
                <Text style={styles.errorText}>{roomCodeError}</Text>
              )}
              <TouchableOpacity 
                style={[
                  styles.joinButton, 
                  { borderColor: colors.secondary, shadowColor: colors.secondary },
                  (isJoining || isCreating) && styles.joinButtonDisabled
                ]} 
                onPress={handleJoinRoom}
                disabled={isJoining || isCreating}
              >
                {isJoining ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.secondary} />
                    <Text style={[styles.joinButtonText, { marginLeft: 8, color: colors.secondary }]}>JOINING...</Text>
                  </View>
                ) : (
                  <Text style={[styles.joinButtonText, { color: colors.secondary }]}>JOIN ROOM</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.chooseGameButton, { borderColor: colors.primary }]} 
              onPress={handleChooseGame}>
              <Text style={[styles.chooseGameButtonText, { color: colors.primary }]}>CHOOSE GAME</Text>
            </TouchableOpacity>

            <Text style={styles.version}>{getVersionString()}</Text>
          </View>

          <Modal
            visible={showGameModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowGameModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Choose a Game</Text>
                <Text style={styles.modalSubtitle}>Coming soon: Game selection</Text>
                <TouchableOpacity
                  style={[styles.modalCloseButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowGameModal(false)}>
                  <Text style={styles.modalCloseButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
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
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
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
  nameInput: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
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
  codeInputError: {
    borderColor: '#FF0000',
    borderWidth: 2,
    shadowColor: '#FF0000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  errorText: {
    color: '#FF0000',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  joinButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  joinButtonDisabled: {
    opacity: 0.5,
    borderColor: '#666',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chooseGameButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  chooseGameButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalCloseButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
