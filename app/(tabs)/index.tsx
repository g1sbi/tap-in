import GradientBackground from '@/components/tap-in/gradient-background';
import { getVersionString } from '@/constants/app-info';
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
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameModalAction, setNameModalAction] = useState<'create' | 'join'>('create');
  const [displayName, setDisplayName] = useState('');

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

  const handleCreateRoomClick = () => {
    setNameModalAction('create');
    setShowNameModal(true);
  };

  const handleJoinRoomClick = () => {
    if (roomCode.length === 0) {
      Alert.alert('Room Code Required', 'Please enter a 6-digit room code');
      return;
    }
    
    if (roomCode.length !== 6) {
      setRoomCodeError('Room code must be 6 digits');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Code', 'Please enter a 6-digit room code');
      return;
    }

    setRoomCodeError(null);
    setNameModalAction('join');
    setShowNameModal(true);
  };

  const handleNameSubmit = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name Required', 'Please enter your display name');
      return;
    }

    setShowNameModal(false);

    if (nameModalAction === 'create') {
      try {
        setIsCreating(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const room = await unifiedRoomManager.createRoom({
          displayName: displayName.trim(),
          maxPlayers: 8,
        });
        logger.info('HomeScreen', 'Room created', { roomId: room.id, code: room.code });
        setDisplayName('');
        router.push('/lobby');
      } catch (error) {
        logger.error('HomeScreen', 'Failed to create room', error);
        Alert.alert('Error', 'Failed to create room. Please try again.');
      } finally {
        setIsCreating(false);
      }
    } else {
      try {
        setIsJoining(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const room = await unifiedRoomManager.joinRoom({
          code: roomCode,
          displayName: displayName.trim(),
        });
        logger.info('HomeScreen', 'Joined room', { roomId: room.id, code: room.code });
        setDisplayName('');
        setRoomCode('');
        router.push('/lobby');
      } catch (error) {
        logger.error('HomeScreen', 'Exception during join', error);
        const message = error instanceof Error ? error.message : 'Failed to join room. Please try again.';
        Alert.alert('Error', message);
      } finally {
        setIsJoining(false);
      }
    }
  };

  const handleChooseGame = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowGameModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <GradientBackground />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>TAP IN</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.createButton} 
              onPress={handleCreateRoomClick}
              disabled={isCreating || isJoining}>
              {isCreating ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#000000" />
                  <Text style={[styles.createButtonText, { marginLeft: 8 }]}>CREATING...</Text>
                </View>
              ) : (
                <Text style={styles.createButtonText}>CREATE ROOM</Text>
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
                onSubmitEditing={isJoining ? undefined : handleJoinRoomClick}
                editable={!isJoining && !isCreating}
              />
              {roomCodeError && (
                <Text style={styles.errorText}>{roomCodeError}</Text>
              )}
              <TouchableOpacity 
                style={[
                  styles.joinButton,
                  (isJoining || isCreating) && styles.joinButtonDisabled
                ]} 
                onPress={handleJoinRoomClick}
                disabled={isJoining || isCreating}
              >
                {isJoining ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={[styles.joinButtonText, { marginLeft: 8 }]}>JOINING...</Text>
                  </View>
                ) : (
                  <Text style={styles.joinButtonText}>JOIN ROOM</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.separator} />

            <TouchableOpacity 
              style={styles.chooseGameButton} 
              onPress={handleChooseGame}>
              <Text style={styles.chooseGameButtonText}>CHOOSE GAME</Text>
            </TouchableOpacity>

            <Text style={styles.version}>{getVersionString()}</Text>
          </View>

          <Modal
            visible={showNameModal}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setShowNameModal(false);
              setDisplayName('');
            }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Enter Your Name</Text>
                <TextInput
                  style={styles.nameInput}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your name"
                  placeholderTextColor="#666"
                  maxLength={20}
                  autoCapitalize="words"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleNameSubmit}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => {
                      setShowNameModal(false);
                      setDisplayName('');
                    }}>
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirmButton}
                    onPress={handleNameSubmit}>
                    <Text style={styles.modalConfirmButtonText}>
                      {nameModalAction === 'create' ? 'Create' : 'Join'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

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
                  style={styles.modalCloseButton}
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
    backgroundColor: '#0A0A0A',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    flex: 0.2,
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: '#FFFFFF',
    opacity: 0.3,
  },
  version: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  actions: {
    width: '100%',
    gap: 16,
    flex: 0.5,
    justifyContent: 'flex-end',
  },
  createButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  joinSection: {
    gap: 10,
  },
  codeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 3,
  },
  codeInputError: {
    borderColor: '#FF4444',
    borderWidth: 2,
  },
  errorText: {
    color: '#FF4444',
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
    borderColor: '#FFFFFF',
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#FFFFFF',
  },
  joinButtonDisabled: {
    opacity: 0.5,
    borderColor: '#666',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 8,
  },
  chooseGameButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  chooseGameButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#FFFFFF',
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
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
    textAlign: 'center',
  },
  nameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#666',
  },
  modalCancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
