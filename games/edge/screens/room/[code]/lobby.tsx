import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRoom } from '@/games/edge/hooks/useRoom';
import { getCurrentUserId } from '@/games/edge/lib/auth';
import { COLORS } from '@/games/edge/constants/theme';
import { Player } from '@/games/edge/types';
import { logger } from '@/lib/logger';

export default function LobbyScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  
  // Handle case where code might be an array (Expo Router quirk)
  const roomCode = Array.isArray(code) ? code[0] : code;
  
  logger.info('Lobby', 'Lobby screen mounted', {
    codeFromParams: code,
    roomCode,
    codeType: typeof code,
    codeIsArray: Array.isArray(code),
  });

  const { room, loading, error, leaveRoom, kickPlayer, startGame } = useRoom(
    roomCode || null
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    logger.debug('Lobby', 'Room state changed', {
      hasRoom: !!room,
      roomId: room?.id,
      roomCode: room?.code,
      loading,
      error,
    });
  }, [room, loading, error]);

  useEffect(() => {
    getCurrentUserId().then((userId) => {
      logger.debug('Lobby', 'Current user ID fetched', { userId });
      setCurrentUserId(userId);
    });
  }, []);

  const handleShare = async () => {
    if (!roomCode) return;

    try {
      await Share.share({
        message: `Join my EDGE game! Room code: ${roomCode}`,
        title: 'Join EDGE Game',
      });
    } catch (error) {
      // Share cancelled or failed
    }
  };

  const handleLeave = async () => {
    if (!roomCode) return;

    Alert.alert('Leave Room', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsLeaving(true);
            await leaveRoom();
            router.replace('/');
          } catch (error) {
            Alert.alert(
              'Error',
              error instanceof Error ? error.message : 'Failed to leave room'
            );
          } finally {
            setIsLeaving(false);
          }
        },
      },
    ]);
  };

  const handleKickPlayer = (playerId: string, playerName: string) => {
    Alert.alert('Kick Player', `Remove ${playerName} from the room?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Kick',
        style: 'destructive',
        onPress: async () => {
          try {
            await kickPlayer(playerId);
          } catch (error) {
            Alert.alert(
              'Error',
              error instanceof Error ? error.message : 'Failed to kick player'
            );
          }
        },
      },
    ]);
  };

  const handleStartGame = async () => {
    if (!room || room.players.length < 2) {
      Alert.alert('Not Enough Players', 'Need at least 2 players to start');
      return;
    }

    try {
      await startGame();
      // TODO: Navigate to game screen when implemented
      Alert.alert('Game Starting', 'Game screen coming soon!');
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to start game'
      );
    }
  };

  const isHost = room?.host_id === currentUserId;

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading room...</Text>
      </View>
    );
  }

  if (error || !room) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'Room not found'}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const needsScrolling = contentHeight > containerHeight && containerHeight > 0;

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      scrollEnabled={needsScrolling}
      showsVerticalScrollIndicator={needsScrolling}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
      onContentSizeChange={(width, height) => setContentHeight(height)}
    >
      <View style={styles.header}>
        <Text style={styles.roomCodeLabel}>Room Code</Text>
        <Text style={styles.roomCode}>{roomCode?.padStart(6, '0')}</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.playersSection}>
        <Text style={styles.sectionTitle}>
          Players ({room.players.length}/{room.max_players})
        </Text>

        {room.players.map((player: Player) => {
          const isCurrentPlayer = player.user_id === currentUserId;
          return (
            <View
              key={player.id}
              style={[
                styles.playerCard,
                isCurrentPlayer && styles.playerCardCurrent,
              ]}
            >
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>
                  {player.display_name}
                  {player.is_host && ' 👑'}
                </Text>
                {isCurrentPlayer && (
                  <Text style={styles.playerBadge}>You</Text>
                )}
              </View>
              {isHost && !player.is_host && (
                <TouchableOpacity
                  style={styles.kickButton}
                  onPress={() => handleKickPlayer(player.id, player.display_name)}
                >
                  <Text style={styles.kickButtonText}>Kick</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {isHost && (
        <TouchableOpacity
          style={[
            styles.startButton,
            room.players.length < 2 && styles.startButtonDisabled,
          ]}
          onPress={handleStartGame}
          disabled={room.players.length < 2}
        >
          <Text style={styles.startButtonText}>Start Game</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.leaveButton}
        onPress={handleLeave}
        disabled={isLeaving}
      >
        {isLeaving ? (
          <ActivityIndicator color={COLORS.warning} />
        ) : (
          <Text style={styles.leaveButtonText}>Leave Room</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 24,
    paddingTop: 100, // Add extra top padding to compensate for removed header
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  roomCodeLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
    letterSpacing: 1,
  },
  roomCode: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.accent,
    letterSpacing: 8,
    marginBottom: 16,
  },
  shareButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 4,
  },
  shareButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  playersSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  playerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  playerCardCurrent: {
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerName: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  playerBadge: {
    fontSize: 12,
    color: COLORS.accent,
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kickButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.warning,
    borderRadius: 4,
  },
  kickButtonText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  leaveButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: COLORS.warning,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  errorText: {
    color: COLORS.warning,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: COLORS.accent,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

