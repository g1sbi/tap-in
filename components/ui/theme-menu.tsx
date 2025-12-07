import Dice from '@/games/dice-rush/components/dice-2d';
import { useThemeStore } from '@/lib/stores';
import type { ColorPaletteName } from '@/lib/home-background-config';
import { colorPalettes } from '@/lib/home-background-config';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const THEME_ALIASES: Record<ColorPaletteName, string> = {
  'cyan-magenta': 'Rush',
  'red-orange': 'Vulkan',
  'yellow-gold': 'Danger',
  'green-emerald': 'Emerald',
  'blue-purple': 'Galaxy',
  'black-white': 'Noir',
  'pink-rose': 'Shock',
  'neon-cyber': 'Neon',
};

const DICE_ICON_SIZE = 40;

type TabType = 'theme' | 'graphics';

export default function ThemeMenu() {
  const { theme, setTheme, reduceAnimations, setReduceAnimations } = useThemeStore();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('theme');
  const scale = useSharedValue(1);

  const handleDicePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsModalVisible(true);
  };

  const handleThemeSelect = async (selectedTheme: ColorPaletteName) => {
    if (selectedTheme === theme) {
      setIsModalVisible(false);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setTheme(selectedTheme);
    setIsModalVisible(false);
  };

  const handleCloseModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsModalVisible(false);
    setActiveTab('theme'); // Reset to theme tab when closing
  };

  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const handleReduceAnimationsChange = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setReduceAnimations(value);
  };

  const diceAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handleDicePressIn = () => {
    scale.value = withSpring(0.9);
  };

  const handleDicePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <>
      <Pressable
        onPress={handleDicePress}
        onPressIn={handleDicePressIn}
        onPressOut={handleDicePressOut}
        style={styles.diceButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Animated.View style={diceAnimatedStyle}>
          <Dice value={5} size={DICE_ICON_SIZE} variant="solid" />
        </Animated.View>
      </Pressable>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseModal}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Tab Buttons */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'theme' && styles.tabActive]}
                onPress={() => handleTabChange('theme')}>
                <Text style={[styles.tabText, activeTab === 'theme' && styles.tabTextActive]}>
                  Theme
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'graphics' && styles.tabActive]}
                onPress={() => handleTabChange('graphics')}>
                <Text style={[styles.tabText, activeTab === 'graphics' && styles.tabTextActive]}>
                  Graphics
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content - Fixed height container */}
            <View style={styles.tabContentContainer}>
              {activeTab === 'theme' && (
                <ScrollView 
                  style={styles.themeScrollView}
                  contentContainerStyle={styles.themeList}
                  showsVerticalScrollIndicator={true}>
                  {(Object.keys(colorPalettes) as ColorPaletteName[]).map((themeKey) => {
                    const palette = colorPalettes[themeKey];
                    const alias = THEME_ALIASES[themeKey];
                    const isActive = theme === themeKey;

                    return (
                      <TouchableOpacity
                        key={themeKey}
                        style={[
                          styles.themeCard,
                          isActive && styles.themeCardActive,
                          { borderColor: palette.primary },
                        ]}
                        onPress={() => handleThemeSelect(themeKey)}>
                        <Text
                          style={[
                            styles.themeName,
                            isActive && { color: palette.primary },
                          ]}>
                          {alias}
                        </Text>
                        {isActive && (
                          <View style={[styles.activeIndicator, { backgroundColor: palette.primary }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {activeTab === 'graphics' && (
                <View style={styles.graphicsContent}>
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingTitle}>Reduce Animations</Text>
                      <Text style={styles.settingDescription}>
                        Reduces decorative animations for better performance
                      </Text>
                    </View>
                    <Switch
                      value={reduceAnimations}
                      onValueChange={handleReduceAnimationsChange}
                      trackColor={{ false: '#333', true: '#00D4FF' }}
                      thumbColor={reduceAnimations ? '#FFFFFF' : '#CCCCCC'}
                      ios_backgroundColor="#333"
                    />
                  </View>
                </View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  diceButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    minHeight: 500, // Fixed minimum height to prevent shrinking
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#333',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  themeScrollView: {
    flex: 1,
  },
  themeList: {
    gap: 8,
    paddingRight: 12, // Add padding to prevent scrollbar overlap
  },
  themeCard: {
    width: '100%',
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  themeCardActive: {
    borderWidth: 2,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  themeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#1A1A1A',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabContentContainer: {
    height: 320, // Fixed height based on theme grid (2 rows of cards + gaps)
    justifyContent: 'flex-start',
  },
  graphicsContent: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
});

