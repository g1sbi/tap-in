import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { roomManager } from '@/lib/room-manager';
import { useGameState } from '@/lib/game-state';

export default function LobbyScreen() {
  const router = useRouter();
  const { roomCode, opponentId, playerRole, actions } = useGameState();
  const [countdown, setCountdown] = useState<number | null>(null);
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.1, { duration: 1000, reduceMotion: false }),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (opponentId && countdown === null) {
      setCountdown(3);
    }
  }, [opponentId]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            return null;
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else if (countdown === null && opponentId) {
      router.push('/game');
    }
  }, [countdown, opponentId]);

  const handleLeave = async () => {
    Alert.alert(
      'Leave Room?',
      'Are you sure you want to leave?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await roomManager.leaveRoom();
            actions.reset();
            router.push('/');
          },
        },
      ]
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Waiting Room</Text>
        </View>

        <View style={styles.roomCodeSection}>
          <Text style={styles.label}>Room Code</Text>
          <Text style={styles.roomCode}>{roomCode}</Text>
          <Text style={styles.hint}>Share this code with your opponent</Text>
        </View>

        <View style={styles.statusSection}>
          <View style={styles.playerStatus}>
            <View style={styles.statusIndicator} />
            <Text style={styles.statusText}>You ({playerRole})</Text>
          </View>

          {opponentId ? (
            <Animated.View style={[styles.playerStatus, animatedStyle]}>
              <View style={[styles.statusIndicator, styles.statusIndicatorActive]} />
              <Text style={[styles.statusText, styles.statusTextActive]}>
                Opponent Connected!
              </Text>
            </Animated.View>
          ) : (
            <View style={styles.playerStatus}>
              <View style={styles.statusIndicator} />
              <Text style={styles.statusText}>Waiting for opponent...</Text>
            </View>
          )}
        </View>

        {countdown !== null && countdown > 0 && (
          <View style={styles.countdownContainer}>
            <Text style={styles.countdown}>{countdown}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.leaveButton} onPress={handleLeave}>
          <Text style={styles.leaveButtonText}>Leave Room</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 32,
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
    color: '#00D4FF',
    letterSpacing: 8,
  },
  hint: {
    fontSize: 14,
    color: '#666',
  },
  statusSection: {
    width: '100%',
    gap: 16,
  },
  playerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#666',
  },
  statusIndicatorActive: {
    backgroundColor: '#00FF88',
  },
  statusText: {
    fontSize: 16,
    color: '#888',
  },
  statusTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: {
    fontSize: 96,
    fontWeight: 'bold',
    color: '#00D4FF',
  },
  leaveButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
  },
  leaveButtonText: {
    color: '#FF4458',
    fontSize: 16,
    fontWeight: '600',
  },
});

