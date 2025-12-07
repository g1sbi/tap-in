import Background from '@/components/home/background';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, useRoomStore } from '@/lib/stores';
import type { PlayerStatus } from '@/lib/room/room-types';
import { gameConfig as diceRushConfig } from '@/games/dice-rush';
import { gameConfig as edgeConfig } from '@/games/edge';

const AVAILABLE_GAMES = [diceRushConfig, edgeConfig];

export default function LobbyScreen() {
  const colors = useColors();
  const router = useRouter();
  const { room, loading, error, isHost, currentPlayer, setPlayerStatus, setRoomStatus, setSelectedGames: updateSelectedGames, leaveRoom, initialize } = useRoomStore();
  const [showGameModal, setShowGameModal] = useState(false);
  const [localSelectedGames, setLocalSelectedGames] = useState<string[]>([]);

  const pulse = useSharedValue(1);

  // Initialize room store subscriptions
  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.1, { duration: 1000, reduceMotion: false }),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (room) {
      setLocalSelectedGames(room.selectedGames);
    }
  }, [room]);

  const handleLeave = useCallback(async () => {
    Alert.alert(
      'Leave Room?',
      'Are you sure you want to leave?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveRoom();
              router.push('/');
            } catch (err) {
              Alert.alert('Error', 'Failed to leave room');
            }
          },
        },
      ]
    );
  }, [leaveRoom, router]);

  const handleToggleReady = useCallback(async () => {
    try {
      const currentStatus = currentPlayer?.status || 'waiting';
      const newStatus: PlayerStatus = currentStatus === 'ready' ? 'waiting' : 'ready';
      await setPlayerStatus(newStatus);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      Alert.alert('Error', 'Failed to update status');
    }
  }, [currentPlayer, setPlayerStatus]);

  const handleStartGame = useCallback(async () => {
    if (!room || !isHost) return;

    const allReady = room.players.every((p) => p.status === 'ready' || p.isHost);
    if (!allReady) {
      Alert.alert('Not Ready', 'All players must be ready to start');
      return;
    }

    if (localSelectedGames.length === 0) {
      Alert.alert('No Game Selected', 'Please select at least one game');
      return;
    }

    try {
      await setRoomStatus('game-active');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      // Navigate to game screen (will be implemented in future phase)
      router.push('/game');
    } catch (err) {
      Alert.alert('Error', 'Failed to start game');
    }
  }, [room, isHost, localSelectedGames, setRoomStatus, router]);

  const handleToggleGame = async (gameId: string) => {
    if (!isHost) return;
    
    const newSelectedGames = localSelectedGames.includes(gameId)
      ? localSelectedGames.filter((id) => id !== gameId)
      : [...localSelectedGames, gameId];
    
    try {
      await updateSelectedGames(newSelectedGames);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      Alert.alert('Error', 'Failed to update game selection');
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Background />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading room...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !room) {
    return (
      <SafeAreaView style={styles.container}>
        <Background />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Room not found'}</Text>
          <TouchableOpacity style={styles.leaveButton} onPress={handleLeave}>
            <Text style={styles.leaveButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const allReady = room.players.every((p) => p.status === 'ready' || p.isHost);
  const canStart = isHost && allReady && localSelectedGames.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <Background />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Lobby</Text>
          </View>

          <View style={styles.roomCodeSection}>
            <Text style={styles.label}>Room Code</Text>
            <Text style={[styles.roomCode, { color: colors.primary }]}>{room.code}</Text>
            <Text style={styles.hint}>Share this code with friends</Text>
          </View>

          {isHost && (
            <View style={styles.gameSelectionSection}>
              <TouchableOpacity
                style={[styles.gameSelectButton, { borderColor: colors.primary }]}
                onPress={() => setShowGameModal(true)}>
                <Text style={[styles.gameSelectButtonText, { color: colors.primary }]}>
                  {localSelectedGames.length > 0
                    ? `Games: ${localSelectedGames.length} selected`
                    : 'Select Games'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.playersSection}>
            <Text style={styles.sectionTitle}>
              Players ({room.players.length}/{room.maxPlayers})
            </Text>
            {room.players.map((player) => (
              <View key={player.id} style={styles.playerCard}>
                <View style={styles.playerInfo}>
                  <View
                    style={[
                      styles.statusIndicator,
                      player.status === 'ready' && styles.statusIndicatorReady,
                      player.status === 'in-game' && styles.statusIndicatorInGame,
                    ]}
                  />
                  <Text style={styles.playerName}>
                    {player.displayName}
                    {player.isHost && ' 👑'}
                  </Text>
                </View>
                <Text style={styles.playerStatusText}>
                  {player.status === 'ready' ? 'Ready' : player.status === 'waiting' ? 'Waiting' : player.status}
                </Text>
              </View>
            ))}
          </View>

          {!isHost && (
            <TouchableOpacity
              style={[
                styles.readyButton,
                currentPlayer?.status === 'ready'
                  ? { backgroundColor: colors.primary }
                  : { borderColor: colors.primary, borderWidth: 2 },
              ]}
              onPress={handleToggleReady}>
              <Text
                style={[
                  styles.readyButtonText,
                  currentPlayer?.status === 'ready' && { color: '#000000' },
                ]}>
                {currentPlayer?.status === 'ready' ? 'READY ✓' : 'READY UP'}
              </Text>
            </TouchableOpacity>
          )}

          {isHost && (
            <TouchableOpacity
              style={[styles.startButton, canStart && { backgroundColor: colors.primary }]}
              onPress={handleStartGame}
              disabled={!canStart}>
              <Text
                style={[
                  styles.startButtonText,
                  canStart && { color: '#000000' },
                ]}>
                START GAME
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.leaveButton} onPress={handleLeave}>
            <Text style={styles.leaveButtonText}>Leave Room</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showGameModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Games</Text>
            <ScrollView style={styles.gameList}>
              {AVAILABLE_GAMES.map((game) => (
                <TouchableOpacity
                  key={game.id}
                  style={[
                    styles.gameItem,
                    localSelectedGames.includes(game.id) && { backgroundColor: colors.primary + '20' },
                  ]}
                  onPress={() => handleToggleGame(game.id)}>
                  <Text style={styles.gameIcon}>{game.icon}</Text>
                  <View style={styles.gameInfo}>
                    <Text style={styles.gameName}>{game.displayName}</Text>
                    <Text style={styles.gameDescription}>{game.description}</Text>
                    <Text style={styles.gamePlayers}>
                      {game.minPlayers}-{game.maxPlayers} players
                    </Text>
                  </View>
                  {localSelectedGames.includes(game.id) && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowGameModal(false)}>
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    color: '#FF0000',
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  roomCodeSection: {
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 16,
    color: '#888',
  },
  roomCode: {
    fontSize: 64,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  hint: {
    fontSize: 14,
    color: '#666',
  },
  gameSelectionSection: {
    width: '100%',
  },
  gameSelectButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  gameSelectButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  playersSection: {
    width: '100%',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  playerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#666',
  },
  statusIndicatorReady: {
    backgroundColor: '#00FF88',
  },
  statusIndicatorInGame: {
    backgroundColor: '#FFAA00',
  },
  playerName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  playerStatusText: {
    fontSize: 14,
    color: '#888',
  },
  readyButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  readyButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  startButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#333',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#888',
  },
  leaveButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#FF4458',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  gameList: {
    maxHeight: 400,
    marginBottom: 16,
  },
  gameItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  gameIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  gameDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  gamePlayers: {
    fontSize: 12,
    color: '#666',
  },
  checkmark: {
    fontSize: 24,
    color: '#00FF88',
    fontWeight: 'bold',
  },
  modalCloseButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
