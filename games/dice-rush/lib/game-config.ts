/**
 * Game Configuration System
 * 
 * Centralized configuration manager for game parameters.
 * This is the single source of truth for all game configuration values.
 * 
 * IMPORTANTE: Per modificare i valori di configurazione, usa il file:
 * @see lib/config-overrides.ts
 * 
 * Questo file gestisce l'accesso ai valori di configurazione e fornisce
 * metodi per modificarli a runtime. Tutti i valori di default vengono
 * caricati da game-constants.ts.
 * 
 * Il file config-overrides.ts viene importato all'avvio dell'app in _layout.tsx
 * e permette di sovrascrivere i valori di default per testing o personalizzazione.
 */

import { BET_AMOUNTS, BONUS_POINTS, GAME_CONSTANTS } from './game-constants';

type GameConstantsKeys = keyof typeof GAME_CONSTANTS;
type BonusPointsKeys = keyof typeof BONUS_POINTS;
type BetAmountsKeys = keyof typeof BET_AMOUNTS;

class GameConfig {
  private config = { ...GAME_CONSTANTS };
  private bonuses = { ...BONUS_POINTS };
  private betAmounts = { ...BET_AMOUNTS };

  // Getter methods per GAME_CONSTANTS
  get INITIAL_SCORE() { return this.config.INITIAL_SCORE; }
  get WINNING_SCORE() { return this.config.WINNING_SCORE; }
  get MIN_SCORE() { return this.config.MIN_SCORE; }
  get MAX_ROUNDS() { return this.config.MAX_ROUNDS; }
  get NORMAL_TIMER_DURATION() { return this.config.NORMAL_TIMER_DURATION; }
  get RUSH_TIMER_DURATION() { return this.config.RUSH_TIMER_DURATION; }
  get RUSH_ROUND_CHANCE() { return this.config.RUSH_ROUND_CHANCE; }
  get DICE_MIN() { return this.config.DICE_MIN; }
  get DICE_MAX() { return this.config.DICE_MAX; }
  get ROOM_CODE_LENGTH() { return this.config.ROOM_CODE_LENGTH; }
  get ROOM_CODE_MIN() { return this.config.ROOM_CODE_MIN; }
  get ROOM_CODE_MAX() { return this.config.ROOM_CODE_MAX; }
  get TIMEOUT_PENALTY() { return this.config.TIMEOUT_PENALTY; }
  get RESULTS_DISPLAY_DURATION() { return this.config.RESULTS_DISPLAY_DURATION; }
  get COUNTDOWN_DURATION() { return this.config.COUNTDOWN_DURATION; }
  get NEW_ROUND_DELAY() { return this.config.NEW_ROUND_DELAY; }
  get GAME_OVER_DELAY() { return this.config.GAME_OVER_DELAY; }
  get START_GAME_DELAY() { return this.config.START_GAME_DELAY; }

  // Getter methods per BONUS_POINTS
  get MIRROR_BONUS() { return this.bonuses.MIRROR; }
  get CONTRARIAN_BONUS() { return this.bonuses.CONTRARIAN; }
  get SPEED_BONUS() { return this.bonuses.SPEED; }

  // Getter methods per BET_AMOUNTS
  get SMALL_BET() { return this.betAmounts.SMALL; }
  get MEDIUM_BET() { return this.betAmounts.MEDIUM; }
  get HALF_PERCENTAGE() { return this.betAmounts.HALF_PERCENTAGE; }

  /**
   * Modifica un valore di configurazione
   * @param key - Chiave della configurazione da modificare
   * @param value - Nuovo valore
   */
  set(key: GameConstantsKeys, value: number): void {
    if (key in this.config) {
      (this.config as any)[key] = value;
    }
  }

  /**
   * Modifica un valore di bonus
   * @param key - Chiave del bonus da modificare
   * @param value - Nuovo valore
   */
  setBonus(key: BonusPointsKeys, value: number): void {
    if (key in this.bonuses) {
      (this.bonuses as any)[key] = value;
    }
  }

  /**
   * Modifica un valore di bet amount
   * @param key - Chiave del bet amount da modificare
   * @param value - Nuovo valore
   */
  setBetAmount(key: BetAmountsKeys, value: number): void {
    if (key in this.betAmounts) {
      (this.betAmounts as any)[key] = value;
    }
  }

  /**
   * Resetta tutti i valori ai default
   */
  reset(): void {
    this.config = { ...GAME_CONSTANTS };
    this.bonuses = { ...BONUS_POINTS };
    this.betAmounts = { ...BET_AMOUNTS };
  }

  /**
   * Ottiene tutti i valori di configurazione
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Ottiene tutti i valori di bonus
   */
  getBonuses() {
    return { ...this.bonuses };
  }

  /**
   * Ottiene tutti i valori di bet amounts
   */
  getBetAmounts() {
    return { ...this.betAmounts };
  }
}

export const gameConfig = new GameConfig();

