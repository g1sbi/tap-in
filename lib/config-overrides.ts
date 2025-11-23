/**
 * Configuration Overrides
 * 
 * Questo file è il punto centrale per modificare i valori di configurazione del gioco.
 * Modifica i valori qui per il testing o per personalizzare il gioco.
 * 
 * IMPORTANTE: Questo file viene importato all'avvio dell'app in app/_layout.tsx
 * 
 * Esempi di override:
 * 
 * // Per testing veloce
 * gameConfig.set('WINNING_SCORE', 150);
 * gameConfig.set('INITIAL_SCORE', 50);
 * gameConfig.set('NORMAL_TIMER_DURATION', 5);
 * 
 * // Per modificare i bonus
 * gameConfig.setBonus('MIRROR', 15);
 * gameConfig.setBonus('CONTRARIAN', 10);
 * 
 * // Per modificare gli importi delle scommesse
 * gameConfig.setBetAmount('SMALL', 5);
 * gameConfig.setBetAmount('MEDIUM', 20);
 */

import { gameConfig } from './game-config';

// ============================================
// CONFIGURAZIONE GIOCO
// ============================================
// Modifica i valori qui sotto per personalizzare il gioco

// gameConfig.set('WINNING_SCORE', 300);        // Punti necessari per vincere
// gameConfig.set('INITIAL_SCORE', 100);        // Punti iniziali
// gameConfig.set('MAX_ROUNDS', 20);            // Numero massimo di round
// gameConfig.set('NORMAL_TIMER_DURATION', 10); // Durata timer normale (secondi)
// gameConfig.set('RUSH_TIMER_DURATION', 5);    // Durata timer rush round (secondi)
// gameConfig.set('RUSH_ROUND_CHANCE', 0.33);   // Probabilità rush round (0-1)
// gameConfig.set('TIMEOUT_PENALTY', 10);       // Penalità per timeout

// ============================================
// BONUS POINTS
// ============================================
// gameConfig.setBonus('MIRROR', 10);           // Bonus quando entrambi vincono con stessa predizione
// gameConfig.setBonus('CONTRARIAN', 5);        // Bonus quando solo tu vinci
// gameConfig.setBonus('SPEED', 2);             // Bonus per chi scommette per primo

// ============================================
// BET AMOUNTS
// ============================================
// gameConfig.setBetAmount('SMALL', 10);        // Scommessa piccola
// gameConfig.setBetAmount('MEDIUM', 25);       // Scommessa media
// gameConfig.setBetAmount('HALF_PERCENTAGE', 0.5); // Percentuale per "50%"

// ============================================
// TIMING & DELAYS
// ============================================
// gameConfig.set('RESULTS_DISPLAY_DURATION', 4000); // Durata display risultati (ms)
// gameConfig.set('COUNTDOWN_DURATION', 3000);       // Durata countdown iniziale (ms)
// gameConfig.set('DICE_ROLL_DELAY', 800);           // Delay animazione dado (ms)
// gameConfig.set('NEW_ROUND_DELAY', 6000);          // Delay tra round (ms)
// gameConfig.set('START_GAME_DELAY', 3000);         // Delay avvio gioco (ms)

// ============================================
// NOTA: Tutti i valori sono commentati di default.
// Decommenta e modifica solo i valori che vuoi cambiare.
// ============================================

