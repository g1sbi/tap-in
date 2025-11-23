# Higher Lower Dice - Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Core Systems](#core-systems)
4. [Component Documentation](#component-documentation)
5. [Game Flow](#game-flow)
6. [Setup & Execution](#setup--execution)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

## Architecture Overview

Higher Lower Dice is a real-time multiplayer game built with React Native Expo. It uses Supabase Realtime for peer-to-peer communication without requiring a custom backend server.

### Key Technologies

- **React Native Expo**: Cross-platform mobile framework
- **Supabase Realtime**: WebSocket-based real-time synchronization
- **Zustand**: Lightweight state management
- **React Native Reanimated**: High-performance animations
- **Expo Router**: File-based routing system

### Architecture Pattern

The game follows a **host-guest** pattern:
- **Host**: Creates the room, manages game state, rolls dice, broadcasts results
- **Guest**: Joins existing room, receives game state updates, displays results

Both players run identical client code, but the host has additional responsibilities for game orchestration.

## Project Structure

```
dAIce-game/
├── app/
│   ├── _layout.tsx              # Root layout with theme provider
│   └── (tabs)/
│       ├── _layout.tsx          # Tab navigation (hidden tabs for lobby/game)
│       ├── index.tsx            # Home screen - create/join game
│       ├── lobby.tsx            # Waiting room with room code
│       └── game.tsx             # Main game screen
├── components/
│   └── game/
│       ├── dice.tsx             # Animated 3D dice component
│       ├── betting-timer.tsx   # Countdown timer with visual pressure
│       ├── betting-panel.tsx   # Bet amount selection + prediction buttons
│       ├── player-info.tsx     # Points, streak, round display
│       └── results-overlay.tsx # Split-screen results animation
├── lib/
│   ├── supabase.ts             # Supabase client initialization
│   ├── game-state.ts           # Zustand store for game state
│   ├── game-logic.ts           # Game rules and calculations
│   └── room-manager.ts         # Room creation, joining, message handling
├── constants/
│   └── theme.ts                # Color scheme definitions
└── hooks/
    └── use-color-scheme.ts     # Theme detection hook
```

## Core Systems

### 1. Supabase Client (`lib/supabase.ts`)

Initializes the Supabase client with Realtime support.

```typescript
// Environment variables required:
// EXPO_PUBLIC_SUPABASE_URL
// EXPO_PUBLIC_SUPABASE_ANON_KEY
```

**Key Features:**
- Real-time channel subscriptions
- Broadcast messaging between players
- Presence tracking for player connection status
- Presence-based timer synchronization for accurate multiplayer timing

### 2. Game State (`lib/game-state.ts`)

Zustand store managing all game state.

**State Properties:**
- `roomCode`: Current room identifier
- `playerRole`: 'host' or 'guest'
- `playerId`: Unique player identifier
- `opponentId`: Opponent's player ID
- `currentDice`: Current dice value (1-6)
- `previousDice`: Previous round's dice value
- `round`: Current round number (1-20)
- `myScore`: Player's current points
- `opponentScore`: Opponent's current points
- `myBet`: Player's current bet
- `opponentBet`: Opponent's bet (amount hidden)
- `betLocked`: Whether player has locked in bet
- `timeRemaining`: Seconds left in betting phase
- `gamePhase`: Current phase ('LOBBY' | 'BETTING' | 'REVEALING' | 'RESULTS' | 'GAME_OVER')
- `isRushRound`: Whether current round is a rush round (5-second timer)
- `winStreak`: Consecutive wins
- `lastRoundResults`: Results from last round

**Actions:**
- `setRoom()`: Initialize room connection
- `startGame()`: Begin gameplay
- `lockBet()`: Lock in betting choice
- `setGamePhase()`: Transition between phases
- `setRushRound()`: Set rush round status
- `updateScores()`: Update point totals
- `reset()`: Clear all state

### 3. Game Logic (`lib/game-logic.ts`)

Pure functions for game rules and calculations.

**Key Functions:**

- `calculateRoundResult(oldDice, newDice, prediction)`: Determines win/loss/push
  - Supports 4 prediction types: `'higher'`, `'lower'`, `'4-or-higher'`, `'3-or-lower'`
  - Edge case predictions ('4-or-higher', '3-or-lower') never result in push - always win or loss
- `calculateBonuses(bets, oldDice, newDice)`: Calculates mirror, contrarian, speed bonuses
- `calculateRoundResults(oldDice, newDice, bets)`: Complete round calculation
- `checkWinConditions(scores, round)`: Checks for game end conditions

**Bonus System:**
- **Mirror Bonus**: +10 points if both players bet same direction and both win
- **Contrarian Bonus**: +5 points if only you win (opponent loses)
- **Speed Bonus**: +2 points for first player to lock bet
- **Note**: Bonus points are fixed values and do not scale with rounds

**Timeout/Pass System:**
- If a player doesn't place a bet before the timer expires, they receive a "PASSED" status
- Passed players lose 10 points (TIMEOUT_PENALTY)
- Passed players receive no bonuses
- The round still proceeds normally (dice is rolled)
- If both players pass, both lose 10 points and the round continues

**Win Conditions:**
- Player reaches 300 points
- Opponent reaches 0 points
- 20 rounds completed (highest score wins)

### 5. Game Constants (`lib/game-constants.ts`)

Centralized configuration values for game mechanics.

**Key Constants:**
- `INITIAL_SCORE: 100` - Starting points for both players
- `WINNING_SCORE: 300` - Points threshold to win instantly
- `MAX_ROUNDS: 20` - Maximum rounds per game
- `NORMAL_TIMER_DURATION: 10` - Standard betting phase duration (seconds)
- `RUSH_TIMER_DURATION: 5` - Rush round betting phase duration (seconds)
- `RUSH_ROUND_CHANCE: 0.33` - Probability of rush round per round (33%)
- `ROOM_CODE_LENGTH: 6` - Length of room code for joining games
- `TIMEOUT_PENALTY: 10` - Points lost when timer expires without bet

### 4. Room Manager (`lib/room-manager.ts`)

Singleton class managing room lifecycle and real-time communication.

**Key Methods:**

- `createRoom()`: Host creates new room, generates 6-digit code
- `joinRoom(code)`: Guest joins existing room
- `lockBet(amount, prediction)`: Submit bet, broadcast to opponent
- `leaveRoom()`: Cleanup and disconnect

**Message Types:**
- `start-game`: Host broadcasts initial dice value
- `bet-locked`: Player submits bet
- `dice-result`: Host broadcasts round results
- `new-round`: Host signals start of new round (includes `isRushRound` status)
- `timer-sync`: Host broadcasts timer synchronization data
- `game-over`: Game end with final scores

**Host Responsibilities:**
- Generate room code
- Roll dice (Math.random)
- Calculate results
- Broadcast game state updates
- Manage round timers
- Check win conditions

**Guest Responsibilities:**
- Join room via code
- Submit bets
- Receive and display updates
- Run local timer (synchronized with host)

## Component Documentation

### Dice Component (`components/game/dice.tsx`)

Animated 3D dice with dot patterns.

**Props:**
- `value`: Dice value (1-6)
- `size`: Size in pixels (default: 120)
- `animated`: Whether to play roll animation

**Features:**
- 3D rotation animation on value change
- Accurate dot positioning for all 6 faces
- Scale animation on roll
- Shadow and elevation for depth

### Betting Timer (`components/game/betting-timer.tsx`)

Countdown timer with increasing visual pressure.

**Props:**
- `seconds`: Time remaining
- `onExpire`: Callback when timer reaches 0
- `isRushRound`: Whether this is a rush round (5 seconds)

**Features:**
- Pulsing scale animation (accelerates as time decreases, faster on rush rounds)
- Color change: Orange for rush rounds, red at 3 seconds for normal rounds
- Haptic feedback at critical moments
- Larger font size for rush rounds (56px vs 48px)

### Player Info (`components/game/player-info.tsx`)

Displays player points, win streak, and round information.

**Props:**
- `points`: Current point total
- `winStreak`: Consecutive wins
- `round`: Current round number
- `isOpponent`: Whether this is the opponent's info
- `isWinning`: Whether this player is currently winning (shows crown icon)
- `isHost`: Whether this player is the host (shows HOST badge)

**Visual Indicators:**
- **Crown Icon (👑)**: Appears next to the score of the player with more points
- **HOST Badge**: Small badge in top-left corner showing who created the room
- Crown updates dynamically as scores change during the game
- Host badge remains fixed throughout the game

### Betting Panel (`components/game/betting-panel.tsx`)

UI for selecting bet amount and prediction.

**Props:**
- `maxAmount`: Maximum betable amount (player's current score)
- `onBet`: Callback with (amount, prediction)
- `disabled`: Whether betting is disabled
- `locked`: Whether bet is locked in
- `currentDice`: Current dice value (determines which buttons to show)

**Features:**
- Quick bet buttons: 10, 25, 50%, ALL IN
- **Normal Mode** (dice 2-5): HIGHER/LOWER prediction buttons
- **Edge Case Mode** (dice 1 or 6): 4 OR HIGHER / 3 OR LOWER buttons
- Visual feedback for selections
- Disabled state when locked or game phase changes
- Auto-reset selection when dice changes

### Player Info (`components/game/player-info.tsx`)

Displays player statistics.

**Props:**
- `points`: Current point total
- `winStreak`: Consecutive wins
- `round`: Current round number
- `totalRounds`: Total rounds (default: 20)
- `isOpponent`: Whether this is opponent's info

**Features:**
- Animated point counter (smooth transitions)
- Scale animation on point changes
- Round progress indicator
- Win streak display (only if > 0)

### Results Overlay (`components/game/results-overlay.tsx`)

Full-screen results display with animations.

**Props:**
- `dice`: New dice value
- `myResult`: Player's round result
- `myPointsChange`: Points gained/lost
- `myBonuses`: Bonus points earned
- `opponentResult`: Opponent's result
- `opponentPointsChange`: Opponent's points change
- `opponentBonuses`: Opponent's bonuses
- `onDismiss`: Callback when overlay dismisses

**Features:**
- Split-screen animation (opponent top, player bottom)
- Sequential reveal (opponent → dice → player)
- Color-coded results (green=win, red=loss, yellow=push)
- Auto-dismiss after 2 seconds

## Game Flow

### 1. Room Creation/Joining

```
Home Screen
├── Host: createRoom() → Generate code → Navigate to Lobby
└── Guest: joinRoom(code) → Validate code → Navigate to Lobby
```

**Lobby Phase:**
- Both players see room code
- Presence tracking detects when opponent joins
- 3-second countdown when both players ready
- Navigate to Game screen

### 2. Game Round Flow

```
BETTING Phase (10 seconds normal, 5 seconds rush)
├── Display current dice value
├── Rush rounds: Orange timer, "RUSH ROUND" badge, flash animation
├── Players select bet amount and prediction
├── Timer counts down
├── When both players bet → Immediate transition
└── If timer expires → Auto-forfeit (-10 points)

REVEALING Phase (0.5 seconds)
├── Host rolls new dice
├── Calculate results
└── Broadcast dice-result message

RESULTS Phase (3 seconds)
├── Display results overlay
├── Update scores
├── Apply bonuses
├── Check win conditions
└── Transition to next round or game over

GAME_OVER Phase
├── Display final scores
├── Show winner
└── Auto-return to home after 3 seconds
```

### 3. Message Flow

**Host → Guest:**
1. `start-game`: Initial dice value
2. `bet-locked`: Opponent's bet received
3. `dice-result`: Round results
4. `new-round`: Start next round
5. `game-over`: End game

**Guest → Host:**
1. `bet-locked`: Player's bet submission

**Bidirectional:**
- Presence updates (automatic via Supabase)

## Setup & Execution

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Expo CLI (installed globally or via npx)
- Supabase account (free tier sufficient)

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- React Native and Expo packages
- Supabase client
- Zustand state management
- React Native Reanimated
- Expo Haptics
- Other dependencies

### Step 2: Configure Supabase

1. **Create Supabase Project:**
   - Go to [supabase.com](https://supabase.com)
   - Sign up/login
   - Create new project
   - Wait for project initialization (~2 minutes)

2. **Get Credentials:**
   - Go to Project Settings → API
   - Copy "Project URL" (e.g., `https://xxxxx.supabase.co`)
   - Copy "anon public" key

3. **Create Environment File:**
   ```bash
   # Create .env file in project root
   touch .env
   ```

4. **Add Credentials:**
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

   **Important:** 
   - Use `EXPO_PUBLIC_` prefix (required for Expo)
   - Never commit `.env` to git (should be in `.gitignore`)

### Step 3: Start Development Server

```bash
# Start Expo development server
npx expo start

# Or use npm script
npm start
```

This will:
- Start Metro bundler
- Open Expo DevTools in browser
- Display QR code for mobile connection

### Step 4: Run on Device/Emulator

**Option A: Expo Go (Quick Testing)**
1. Install Expo Go app on your phone
2. Scan QR code from terminal
3. App loads on device

**Option B: iOS Simulator (Mac only)**
```bash
# Press 'i' in Expo CLI or:
npx expo start --ios
```

**Option C: Android Emulator**
```bash
# Press 'a' in Expo CLI or:
npx expo start --android
```

**Option D: Web Browser**
```bash
# Press 'w' in Expo CLI or:
npx expo start --web
```

### Step 5: Test Multiplayer

1. **Device 1 (Host):**
   - Open app
   - Tap "HOST GAME"
   - Note the 6-digit room code

2. **Device 2 (Guest):**
   - Open app
   - Enter room code
   - Tap "JOIN GAME"

3. **Both devices:**
   - Wait in lobby (should see opponent connect)
   - Game starts automatically after 3 seconds
   - Play rounds and verify synchronization

### Development Commands

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web

# Lint code
npm run lint
```

## Deployment

### Overview

Expo provides multiple deployment options:
1. **Expo Go** (development only)
2. **Development Build** (custom native code)
3. **Production Build** (EAS Build)
4. **Web Deployment** (static hosting)

### Option 1: EAS Build (Recommended for Production)

EAS (Expo Application Services) builds native apps for iOS and Android.

#### Prerequisites

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo account
eas login
```

#### Configure EAS

```bash
# Initialize EAS in project
eas build:configure
```

This creates `eas.json` configuration file.

#### Build for Production

**Android (APK/AAB):**
```bash
# Build APK (for direct installation)
eas build --platform android --profile production

# Build AAB (for Google Play Store)
eas build --platform android --profile production --type app-bundle
```

**iOS (IPA):**
```bash
# Build for App Store
eas build --platform ios --profile production

# Requires Apple Developer account ($99/year)
```

**Both Platforms:**
```bash
eas build --platform all --profile production
```

#### Build Profiles

Edit `eas.json` to configure build profiles:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "your_url",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your_key"
      },
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "bundleIdentifier": "com.yourcompany.daicegame"
      }
    },
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    }
  }
}
```

#### Submit to App Stores

**Google Play Store:**
```bash
eas build --platform android --profile production --type app-bundle
eas submit --platform android
```

**Apple App Store:**
```bash
eas build --platform ios --profile production
eas submit --platform ios
```

### Option 2: Web Deployment

Deploy as Progressive Web App (PWA) to static hosting.

#### Build Web Bundle

```bash
# Build optimized web bundle
npx expo export:web

# Or use EAS
eas build --platform web --profile production
```

#### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Or connect GitHub repo for auto-deploy
```

#### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

#### Deploy to GitHub Pages

1. Build web bundle: `npx expo export:web`
2. Push `web-build` folder to GitHub
3. Enable GitHub Pages in repo settings
4. Point to `web-build` directory

### Option 3: Development Build

For testing with custom native modules:

```bash
# Build development client
eas build --profile development --platform android
eas build --profile development --platform ios

# Install on device
# Then run: npx expo start --dev-client
```

### Environment Variables in Production

**EAS Build:**
Set in `eas.json`:
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "your_url",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your_key"
      }
    }
  }
}
```

**Or use EAS Secrets:**
```bash
# Set secrets
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your_url"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your_key"
```

### Pre-Deployment Checklist

- [ ] Test on both iOS and Android devices
- [ ] Verify Supabase credentials are set correctly
- [ ] Test multiplayer functionality end-to-end
- [ ] Check all game phases work correctly
- [ ] Verify win conditions trigger properly
- [ ] Test reconnection handling
- [ ] Optimize bundle size (remove unused dependencies)
- [ ] Update app.json with correct metadata
- [ ] Set up app icons and splash screens
- [ ] Configure app permissions (if needed)

### App Configuration (`app.json`)

Update `app.json` before deployment:

```json
{
  "expo": {
    "name": "Higher Lower Dice",
    "slug": "higher-lower-dice",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/images/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#000000"
    },
    "ios": {
      "bundleIdentifier": "com.yourcompany.daicegame",
      "buildNumber": "1.0.0"
    },
    "android": {
      "package": "com.yourcompany.daicegame",
      "versionCode": 1
    },
    "web": {
      "favicon": "./assets/images/favicon.png"
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Supabase Connection Failed

**Symptoms:** Room creation/joining fails

**Solutions:**
- Verify `.env` file exists and has correct variables
- Check Supabase project is active
- Ensure `EXPO_PUBLIC_` prefix is used
- Restart Expo server after changing `.env`

#### 2. Players Can't See Each Other

**Symptoms:** Stuck in lobby, opponent never appears

**Solutions:**
- Check both devices are using same Supabase project
- Verify room code matches exactly
- Check network connectivity
- Ensure Supabase Realtime is enabled in project settings

#### 3. Timer Not Syncing

**Symptoms:** Timers show different values

**Solutions:**
- Timer synchronization uses Supabase Presence for accurate sync
- Local time tracking prevents clock skew issues between devices
- Guest timers ignore network latency for perceived synchronization
- Both timers should appear synchronized within ~200ms
- If timers are still off, check network connection quality

#### 4. Build Fails

**Symptoms:** EAS build errors

**Solutions:**
- Check `eas.json` configuration
- Verify environment variables are set
- Check Expo account has build credits
- Review build logs in Expo dashboard

#### 5. App Crashes on Launch

**Symptoms:** App closes immediately

**Solutions:**
- Check console for error messages
- Verify all dependencies installed
- Clear Metro bundler cache: `npx expo start -c`
- Reinstall node_modules: `rm -rf node_modules && npm install`

#### 6. Dice Not Animating

**Symptoms:** Dice appears static

**Solutions:**
- Verify `react-native-reanimated` is installed
- Check Reanimated is imported in root: `import 'react-native-reanimated'`
- Ensure native code is rebuilt (development build)

### Debug Mode

Enable debug logging using the centralized logger:

```typescript
import { logger } from '@/lib/logger';

// Debug logging is automatically filtered in production
logger.debug('RoomManager', 'Room message received', message);
logger.debug('GameState', 'Current game state', useGameState.getState());
```

### Performance Optimization

- Use React DevTools Profiler to identify bottlenecks
- Optimize re-renders with React.memo where needed
- Use `useNativeDriver: true` for all animations
- Minimize state updates during animations

### Network Issues

If experiencing lag:
- Check Supabase project region (should match users)
- Verify network connection quality
- Consider adding connection status indicator
- Implement retry logic for failed messages

## Recent Architecture Improvements

### Timer Synchronization System

**Problem:** Timer desynchronization between host and guest devices due to network latency and clock skew.

**Solution:**
- **Presence-Based Sync**: Host updates Supabase Presence with `roundStartTime` and `timerDuration` for each round
- **Guest Sync**: Guest actively checks host's presence data and syncs timer when new round data is detected
- **Clock Skew Immunity**: Timer calculations use local `Date.now()` as reference point, making them immune to device clock differences
- **Perceived Synchronization**: Guest timers ignore network latency for initial display, ensuring both players see the same countdown

**Implementation Details:**
- `updatePresenceTimer()`: Host updates presence state with timer info
- `checkHostTimerUpdate()`: Guest checks and syncs with host's presence data
- `startTimerWithTimestamp()`: Starts timer using local time reference, accounting for elapsed time

### Rush Round System

**Enhancement:** Rush rounds now occur randomly (33% chance per round) with prominent visual indicators.

**Visual Indicators:**
- **Orange Timer**: Rush rounds display orange timer color instead of white/red
- **Rush Badge**: Animated "⚡ RUSH ROUND ⚡" badge appears above timer
- **Flash Animation**: Orange flash overlay (500ms) when rush round begins
- **Faster Pulse**: Timer pulse animation accelerates for rush rounds

**Implementation:**
- `RUSH_ROUND_CHANCE: 0.33` constant in `game-constants.ts`
- `isRushRound` state in `game-state.ts`
- Rush status broadcast in `new-round` messages
- Visual components in `game.tsx` and `betting-timer.tsx`

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

## Support

For issues or questions:
1. Check this documentation
2. Review Expo/Supabase documentation
3. Check GitHub issues (if applicable)
4. Contact project maintainer

