import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { roomService } from '@/games/edge/lib/RoomService';
import { initializeAuth } from '@/games/edge/lib/auth';
import { COLORS } from '@/games/edge/constants/theme';
import { logger } from '@/lib/logger';

export default function HomeScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null);
  const codeInputRef = useRef<TextInput>(null);
  const nameInputRef = useRef<TextInput>(null);

  const validateName = (name: string): boolean => {
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed.length <= 8 && /^[a-zA-Z0-9\s]+$/.test(trimmed);
  };

  const promptForName = (action: 'create' | 'join') => {
    setPendingAction(action);
    setPlayerName('');
    setShowNameModal(true);
    // Focus name input after modal opens
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  };

  const handleNameSubmit = async () => {
    const trimmedName = playerName.trim();

    if (!validateName(trimmedName)) {
      Alert.alert(
        'Invalid Name',
        'Name must be 1-8 characters and contain only letters, numbers, and spaces.'
      );
      return;
    }

    setShowNameModal(false);

    if (pendingAction === 'create') {
      await handleCreateRoomWithName(trimmedName);
    } else if (pendingAction === 'join') {
      await handleJoinRoomWithName(trimmedName);
    }

    setPendingAction(null);
  };

  const handleCreateRoom = () => {
    promptForName('create');
  };

  const handleCreateRoomWithName = async (displayName: string) => {
    try {
      logger.info('RoomCreation', 'Starting room creation', { displayName });
      setCreatingRoom(true);

      logger.debug('RoomCreation', 'Initializing auth');
      await initializeAuth();
      logger.debug('RoomCreation', 'Auth initialized successfully');

      logger.debug('RoomCreation', 'Calling roomService.createRoom()');
      const room = await roomService.createRoom(displayName);
      logger.info('RoomCreation', 'Room created successfully', {
        roomId: room.id,
        roomCode: room.code,
      });

      const lobbyPath = `/room/${room.code}/lobby`;
      logger.info('RoomCreation', 'Navigating to lobby', { lobbyPath, roomCode: room.code });
      router.replace(lobbyPath);
    } catch (error) {
      logger.error('RoomCreation', 'Failed to create room', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create room'
      );
      setCreatingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    const trimmedCode = roomCode.trim();

    // If code is empty, just dismiss keyboard (no error)
    if (trimmedCode.length === 0) {
      return;
    }

    if (!/^\d{6}$/.test(trimmedCode)) {
      Alert.alert('Invalid Code', 'Room code must be exactly 6 digits');
      return;
    }

    // Check room exists before prompting for name
    try {
      setJoiningRoom(true);
      logger.debug('RoomJoin', 'Checking if room exists', { code: trimmedCode });
      const result = await roomService.checkRoomExists(trimmedCode);
      setJoiningRoom(false);

      if (!result.exists) {
        logger.warn('RoomJoin', 'Room check failed', {
          code: trimmedCode,
          error: result.error,
        });
        Alert.alert('Error', result.error || 'Room not found');
        return;
      }

      logger.info('RoomJoin', 'Room exists, prompting for name', { code: trimmedCode });
      // Room exists, now prompt for name
      promptForName('join');
    } catch (error) {
      setJoiningRoom(false);
      logger.error('RoomJoin', 'Error checking room existence', {
        code: trimmedCode,
        error: error instanceof Error ? error.message : String(error),
      });
      Alert.alert('Error', 'Failed to check room. Please try again.');
    }
  };

  const handleJoinRoomWithName = async (displayName: string) => {
    const trimmedCode = roomCode.trim();

    try {
      logger.info('RoomJoin', 'Starting room join', { code: trimmedCode, displayName });
      setJoiningRoom(true);

      logger.debug('RoomJoin', 'Initializing auth');
      await initializeAuth();
      logger.debug('RoomJoin', 'Auth initialized successfully');

      logger.debug('RoomJoin', 'Calling roomService.joinRoom()');
      const room = await roomService.joinRoom(trimmedCode, displayName);
      logger.info('RoomJoin', 'Room joined successfully', {
        roomId: room.id,
        roomCode: room.code,
      });

      const lobbyPath = `/room/${room.code}/lobby`;
      logger.info('RoomJoin', 'Navigating to lobby', { lobbyPath, roomCode: room.code });
      router.replace(lobbyPath);
    } catch (error) {
      logger.error('RoomJoin', 'Failed to join room', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to join room'
      );
      setJoiningRoom(false);
    }
  };

  const handleCodeChange = (text: string) => {
    // Only allow digits, max 6 characters
    const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, 6);
    setRoomCode(digitsOnly);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.content}>
        <Text style={styles.title}>EDGE</Text>
        <Text style={styles.subtitle}>1-Button Multiplayer Chicken Game</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, creatingRoom && styles.buttonDisabled]}
            onPress={handleCreateRoom}
            disabled={creatingRoom}
          >
            {creatingRoom ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.buttonText}>Create Room</Text>
            )}
          </TouchableOpacity>

          <View style={styles.codeInputContainer}>
            <TextInput
              ref={codeInputRef}
              style={styles.codeInput}
              value={roomCode}
              onChangeText={handleCodeChange}
              placeholder=""
              placeholderTextColor={COLORS.textSecondary}
              maxLength={6}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={handleJoinRoom}
              editable={!joiningRoom}
            />
            {roomCode.length === 0 && (
              <Text style={styles.codeInputPlaceholderOverlay}>
                Enter 6-digit code
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonSecondary,
              (joiningRoom || roomCode.length !== 6) && styles.buttonDisabled,
            ]}
            onPress={handleJoinRoom}
            disabled={joiningRoom || roomCode.length !== 6}
          >
            {joiningRoom ? (
              <ActivityIndicator color={COLORS.accent} />
            ) : (
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                Join Room
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Name Prompt Modal */}
      <Modal
        visible={showNameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowNameModal(false);
          setPendingAction(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <TextInput
              ref={nameInputRef}
              style={styles.nameInput}
              value={playerName}
              onChangeText={setPlayerName}
              placeholder="Your name"
              placeholderTextColor={COLORS.textSecondary}
              maxLength={8}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleNameSubmit}
            />

            <Text style={styles.nameHint}>
              {playerName.length}/8 characters
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowNameModal(false);
                  setPendingAction(null);
                  setPlayerName('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  (!validateName(playerName) || playerName.trim().length === 0) &&
                    styles.modalButtonDisabled,
                ]}
                onPress={handleNameSubmit}
                disabled={!validateName(playerName) || playerName.trim().length === 0}
              >
                <Text style={styles.modalButtonTextConfirm}>
                  {pendingAction === 'create' ? 'Create' : 'Join'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 64,
    fontWeight: 'bold',
    color: COLORS.accent,
    marginBottom: 10,
    letterSpacing: 4,
    textAlign: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 60,
    textAlign: 'center',
    width: '100%',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 16,
  },
  button: {
    backgroundColor: COLORS.accent,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  buttonText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  buttonTextSecondary: {
    color: COLORS.accent,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  codeInputContainer: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  codeInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 8,
    padding: 16,
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.accent,
    letterSpacing: 8,
    textAlign: 'center',
    width: '100%',
    minHeight: 70,
  },
  codeInputPlaceholderOverlay: {
    position: 'absolute',
    fontSize: 14,
    letterSpacing: 1,
    fontWeight: 'normal',
    color: COLORS.textSecondary,
    textAlign: 'center',
    width: '100%',
    pointerEvents: 'none',
    top: '50%',
    marginTop: -7,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.accent,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  nameInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  nameHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
  },
  modalButtonConfirm: {
    backgroundColor: COLORS.accent,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonTextCancel: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
