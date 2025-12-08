# Tap In - Developer Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Core Systems](#core-systems)
4. [State Management](#state-management)
5. [Room System](#room-system)
6. [Game Integration](#game-integration)
7. [Setup & Execution](#setup--execution)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

## Architecture Overview

Tap In is a multi-game party platform built with React Native Expo. It provides a unified infrastructure for hosting multiple mini-games with real-time multiplayer support via Supabase Realtime.

### Key Technologies

- **React Native Expo**: Cross-platform mobile framework
- **Supabase Realtime**: WebSocket-based real-time synchronization
- **Zustand**: Lightweight state management with persistence
- **React Native Reanimated**: High-performance animations
- **Expo Router**: File-based routing system

### Architecture Pattern

The platform follows a **host-guest** pattern:

- **Host**: Creates the room, manages game state, broadcasts updates
- **Guest**: Joins existing room, receives state updates, displays results

Both players run identical client code, but the host has additional responsibilities for game orchestration.

## Project Structure

```
tap-in/
├── app/
│   ├── _layout.tsx              # Root layout with store hydration
│   └── (tabs)/
│       ├── _layout.tsx          # Tab navigation
│       ├── index.tsx            # Home screen - neutral platform UI
│       ├── lobby.tsx            # Room lobby - game selection
│       └── game.tsx             # Game container (delegates to selected game)
├── games/                       # Game modules (independent, self-contained)
│   ├── _shared/                 # Shared game utilities
│   ├── dice-rush/               # Dice Rush game
│   │   ├── components/          # Game-specific components
│   │   │   ├── betting-panel.tsx
│   │   │   ├── betting-timer.tsx
│   │   │   ├── dice-2d.tsx
│   │   │   ├── player-info.tsx
│   │   │   └── results-overlay.tsx
│   │   ├── lib/
│   │   │   ├── game-config.ts   # Runtime configuration
│   │   │   ├── game-constants.ts # Default values
│   │   │   ├── game-logic.ts    # Game rules
│   │   │   └── game-state.ts    # Zustand store
│   │   └── index.ts             # Game export
│   └── edge/                    # Edge game (in development)
├── components/
│   ├── home/                    # Home screen components (obsolete - to be removed)
│   ├── tap-in/                  # Platform-level components
│   │   └── gradient-background.tsx  # Neutral background
│   └── ui/
│       └── theme-menu.tsx       # Theme selector (obsolete)
├── lib/
│   ├── supabase.ts              # Supabase client initialization
│   ├── logger.ts                # Centralized logging utility
│   ├── stores/                  # Zustand stores
│   │   ├── index.ts             # Store exports
│   │   ├── theme-store.ts       # Theme management (deprecated)
│   │   └── room-store.ts        # Room state management
│   ├── room/                    # Room system (unified)
│   │   ├── room-types.ts        # Type definitions
│   │   ├── room-context.tsx     # React Context (legacy)
│   │   ├── room-manager.ts      # Room lifecycle management
│   │   └── supabase-rooms.ts    # Supabase integration
│   └── theme-context.tsx        # Theme context (deprecated)
├── constants/
│   ├── app-info.ts              # App metadata (version, title)
│   └── theme.ts                 # Theme definitions (deprecated)
├── hooks/
│   ├── use-color-scheme.ts      # System color scheme detection
│   └── use-theme-color.ts       # Theme color utilities (deprecated)
├── supabase/
│   ├── config.toml              # Supabase CLI configuration
│   └── migrations/              # Database migrations
└── documentation/
    ├── DEVELOPER_GUIDE.md       # This file
    ├── QUICK_START.md           # Quick setup guide
    └── GAME_GUIDE.md            # Player-facing game rules
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
- Database integration for room persistence (optional)

### 2. Centralized Logger (`lib/logger.ts`)

Provides structured logging throughout the application.

**Features:**

- Automatic debug log filtering in production
- Contextual logging with component/module names
- Consistent log formatting
- Error tracking

**Usage:**

```typescript
import { logger } from '@/lib/logger';

logger.debug('RoomManager', 'Room message received', message);
logger.error('GameState', 'Failed to process bet', error);
```

### 3. App Information (`constants/app-info.ts`)

Centralized location for app metadata.

**Properties:**

- `VERSION: string` - App version number (e.g., "1.0.0")
- `TITLE: string` - App title (e.g., "TAP IN")
- `SUBTITLE: string` - App subtitle
- `VERSION_LABEL: string` - Version label prefix (e.g., "Early Access")

**Functions:**

- `getVersionString(): string` - Returns formatted version string

**Updating Version:**

When releasing a new version, update the `VERSION` property in `constants/app-info.ts`. The version will automatically update throughout the app.

## State Management

Tap In uses **Zustand** for state management with AsyncStorage persistence.

### Room Store (`lib/stores/room-store.ts`)

Manages room state and player connections.

**State Selectors:**

```typescript
useRoom()           // RoomWithPlayers | null
useRoomLoading()    // boolean
useRoomError()      // string | null
useIsHost()         // boolean
useCurrentPlayer()  // RoomPlayer | null
```

**Actions:**

```typescript
useRoomActions()    // { createRoom, joinRoom, leaveRoom, setPlayerStatus, ... }
```

**Key Features:**

- Automatic state persistence
- Optimized re-renders via selector pattern
- Type-safe actions and state access

### Theme Store (`lib/stores/theme-store.ts`) - DEPRECATED

**Note:** The theme system is being phased out in favor of a fixed neutral design. This store will be removed in future versions.

## Room System

The unified room system is located in `lib/room/` and provides infrastructure for all games.

### Room Manager (`lib/room/room-manager.ts`)

Singleton class managing room lifecycle and real-time communication.

**Key Methods:**

- `createRoom(playerName)`: Creates new room, generates 6-digit code
- `joinRoom(code, playerName)`: Joins existing room, validates host presence
- `leaveRoom()`: Cleanup and disconnect
- `subscribeToMessages(callback)`: Listen for room messages
- `broadcastMessage(type, payload)`: Send message to all players

**Room Validation:**

- `joinRoom()` validates that a room exists before allowing join
- Waits for channel subscription (up to 5 seconds)
- Checks for active host presence (up to 3 seconds)
- Returns `false` if room doesn't exist or host not found

**Error Handling:**

- Automatic retry mechanism for connection errors
- Exponential backoff (1s, 2s, 4s max)
- Maximum 3 retry attempts before giving up
- Connection error state triggers UI prompts

### Room Types (`lib/room/room-types.ts`)

Type definitions for room system:

```typescript
interface Room {
  code: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  selectedGames: string[];
  currentGame?: string;
}

interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

interface RoomWithPlayers extends Room {
  players: RoomPlayer[];
}
```

### Supabase Rooms (`lib/room/supabase-rooms.ts`)

Supabase integration layer for room persistence (optional feature).

**Functions:**

- `createRoomInDB(room)`: Persist room to database
- `getRoomFromDB(code)`: Fetch room from database
- `updateRoomInDB(code, updates)`: Update room state
- `deleteRoomFromDB(code)`: Remove room from database

**Note:** Room persistence is optional. The platform can operate purely with Realtime channels without database storage.

## Game Integration

Games are self-contained modules in the `games/` directory. Each game exports a standard interface for the platform to integrate.

### Game Structure

```
games/your-game/
├── components/          # Game-specific UI components
├── lib/
│   ├── game-state.ts   # Zustand store for game state
│   ├── game-logic.ts   # Game rules and calculations
│   ├── game-config.ts  # Runtime configuration
│   └── game-constants.ts # Default values
├── screens/            # Full-screen game views (optional)
└── index.ts            # Game export
```

### Game Export Interface

Each game must export a standard interface in `index.ts`:

```typescript
export interface GameModule {
  id: string;              // Unique game identifier
  name: string;            // Display name
  description: string;     // Short description
  minPlayers: number;      // Minimum players
  maxPlayers: number;      // Maximum players
  GameComponent: React.FC; // Main game component
}

export const DiceRushGame: GameModule = {
  id: 'dice-rush',
  name: 'Dice Rush',
  description: 'Fast-paced dice betting game',
  minPlayers: 2,
  maxPlayers: 2,
  GameComponent: DiceRushScreen,
};
```

### Game State Management

Each game manages its own state using Zustand:

```typescript
// games/your-game/lib/game-state.ts
import { create } from 'zustand';

interface YourGameState {
  // Game-specific state
  round: number;
  score: number;
  
  // Actions
  startGame: () => void;
  endGame: () => void;
  reset: () => void;
}

export const useYourGameState = create<YourGameState>((set) => ({
  round: 0,
  score: 0,
  
  startGame: () => set({ round: 1 }),
  endGame: () => {/* ... */},
  reset: () => set({ round: 0, score: 0 }),
}));
```

### Communication with Room System

Games receive room state and communicate via the room store:

```typescript
import { useRoom, useRoomActions } from '@/lib/stores';
import { roomManager } from '@/lib/room/room-manager';

function YourGameComponent() {
  const room = useRoom();
  const { updateGameState } = useRoomActions();
  
  // Listen for game messages
  useEffect(() => {
    const unsubscribe = roomManager.subscribeToMessages((msg) => {
      if (msg.type === 'game-action') {
        // Handle game message
      }
    });
    
    return unsubscribe;
  }, []);
  
  // Send game message
  const sendAction = (action: string) => {
    roomManager.broadcastMessage('game-action', { action });
  };
  
  return <View>{/* Game UI */}</View>;
}
```

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
   # Client-side variables (exposed to the app)
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

   **Important:**
   - Use `EXPO_PUBLIC_` prefix (required for Expo)
   - Use **anonymous key**, not service role key (security)
   - Never commit `.env` to git (should be in `.gitignore`)

### Step 3: Set Up Database (Optional)

If using database-backed rooms:

```bash
# Link to your Supabase project
npm run db:link

# Push migrations
npm run db:push

# Check status
npm run db:status
```

### Step 4: Start Development Server

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

### Step 5: Run on Device/Emulator

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

### Step 6: Test Multiplayer

1. **Device 1 (Host):**
   - Open app
   - Enter your name in modal
   - Tap "CREATE ROOM"
   - Note the 6-digit room code

2. **Device 2 (Guest):**
   - Open app
   - Enter room code
   - Tap "JOIN ROOM"
   - Enter your name in modal

3. **Both devices:**
   - Select a game in lobby
   - Mark ready
   - Host starts the game

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

# Database commands (if using Supabase DB)
npm run db:link    # Link to Supabase project
npm run db:push    # Push migrations
npm run db:reset   # Reset database
npm run db:status  # Check migration status
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
        "bundleIdentifier": "com.yourcompany.tapin"
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
- [ ] Test all games work correctly
- [ ] Verify room creation/joining works
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
    "name": "Tap In",
    "slug": "tap-in",
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
      "bundleIdentifier": "com.yourcompany.tapin",
      "buildNumber": "1.0.0"
    },
    "android": {
      "package": "com.yourcompany.tapin",
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

#### 3. Build Fails

**Symptoms:** EAS build errors

**Solutions:**

- Check `eas.json` configuration
- Verify environment variables are set
- Check Expo account has build credits
- Review build logs in Expo dashboard

#### 4. App Crashes on Launch

**Symptoms:** App closes immediately

**Solutions:**

- Check console for error messages
- Verify all dependencies installed
- Clear Metro bundler cache: `npx expo start -c`
- Reinstall node_modules: `rm -rf node_modules && npm install`

#### 5. Module Resolution Errors

**Symptoms:** "Unable to resolve module" errors

**Solutions:**

- Verify `babel.config.js` has correct aliases
- Check `babel-plugin-module-resolver` is installed
- Restart Metro bundler with cache clear: `npx expo start -c`

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
- Use Zustand selectors to prevent unnecessary re-renders

### Network Issues

If experiencing lag:

- Check Supabase project region (should match users)
- Verify network connection quality
- Consider adding connection status indicator
- Implement retry logic for failed messages

## Best Practices

### Code Organization

1. **Game Isolation**: Keep games self-contained in `games/` directory
2. **Shared Logic**: Place shared utilities in `games/_shared/`
3. **Type Safety**: Define types in separate `.ts` files
4. **Component Separation**: Split UI components from logic

### State Management

1. **Use Zustand Selectors**: Prevent unnecessary re-renders
   ```typescript
   // Good
   const room = useRoom();
   const isHost = useIsHost();
   
   // Bad (causes re-render on any room state change)
   const { room, isHost } = useRoomStore();
   ```

2. **Keep Game State Separate**: Each game manages its own Zustand store
3. **Persist Only Necessary Data**: Don't persist ephemeral state

### Room Communication

1. **Validate Messages**: Always validate received messages
2. **Handle Disconnections**: Implement graceful error handling
3. **Debounce Updates**: Avoid flooding the channel with messages
4. **Use Typed Messages**: Define message interfaces

### Testing

1. **Test on Real Devices**: Simulators don't reflect real network conditions
2. **Test Edge Cases**: Connection drops, timeouts, rapid actions
3. **Multi-Device Testing**: Always test with 2+ devices
4. **Performance Testing**: Monitor frame rates during animations

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

## Support

For issues or questions:

1. Check this documentation
2. Review [QUICK_START.md](./QUICK_START.md) for setup issues
3. Check [GAME_GUIDE.md](./GAME_GUIDE.md) for gameplay questions
4. Review Expo/Supabase documentation
5. Contact project maintainer

