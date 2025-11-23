# Higher Lower Dice - Simultaneous Multiplayer Betting Game

A real-time multiplayer dice betting game built with React Native Expo and Supabase Realtime.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up Supabase (see Setup section below)

# 3. Start the app
npx expo start
```

## Features

- **Simultaneous Betting**: Both players bet at the same time on each round
- **Real-time Multiplayer**: Peer-to-peer gameplay using Supabase Realtime
- **10-Second Rounds**: Fast-paced betting with countdown timer
- **Special Bonuses**: Mirror bonus, contrarian bonus, and speed bonus
- **Rush Rounds**: 33% chance each round (5-second timer) with visual indicators
- **Win Conditions**: First to 300 points, opponent to 0, or most points after 20 rounds

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a free Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from the project settings (Project Settings → API)
3. Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important:** 
- Use `EXPO_PUBLIC_` prefix (required for Expo)
- Never commit `.env` to git
- Restart Expo server after creating/modifying `.env`

### 3. Start the App

```bash
# Start development server
npx expo start

# Then choose your platform:
# - Press 'i' for iOS simulator
# - Press 'a' for Android emulator
# - Press 'w' for web browser
# - Scan QR code with Expo Go app on your phone
```

## How to Play

1. **Host a Game**: Tap "HOST GAME" to create a room and get a 6-digit code
2. **Join a Game**: Enter the 6-digit code and tap "JOIN GAME"
3. **Bet**: Choose your bet amount (10, 25, 50%, or ALL IN) and make your prediction:
   - **Normal rounds** (dice 2-5): Predict HIGHER or LOWER
   - **Edge cases** (dice 1 or 6): Choose 4 OR HIGHER or 3 OR LOWER (50/50 odds, no push)
4. **Win**: Accumulate points by correctly predicting the next dice roll
5. **Special Bonuses**:
   - **Mirror Bonus**: +10 points if both players bet the same direction and win
   - **Contrarian Bonus**: +5 points if only you win (opponent loses)
   - **Speed Bonus**: +2 points for betting first

## Game Rules

- Both players start with 100 points
- Each round shows the current dice value
- Players have 10 seconds (5 seconds on rush rounds) to bet
- Rush rounds occur randomly (33% chance) with orange timer, "RUSH ROUND" badge, and flash animation
- **Timeout Penalty**: If a player doesn't bet before the timer expires, they receive a "PASSED" status and lose 10 points
- Correct prediction: +bet amount
- Wrong prediction: -bet amount
- Push (same number): bet returned, no change
  - **Note**: Pushes only occur in normal rounds (dice 2-5)
  - Edge case rounds (dice 1 or 6) have no pushes - always win or loss
- **Visual Indicators**:
  - 👑 Crown icon appears next to the score of the player currently winning
  - HOST badge appears on the player who created the room
- Game ends when:
  - A player reaches 300 points
  - A player reaches 0 points
  - 20 rounds are completed (highest score wins)

## Deployment

### Development

```bash
# Run on device/emulator
npx expo start
```

### Production Build (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure build
eas build:configure

# Build for production
eas build --platform all --profile production
```

### Web Deployment

```bash
# Build web bundle
npx expo export:web

# Deploy to Vercel/Netlify/etc.
```

See [DOCS.md](./DOCS.md) for detailed deployment instructions.

## Documentation

📚 **Full documentation available in [DOCS.md](./DOCS.md)**

The documentation includes:
- Architecture overview
- Code structure and API reference
- Component documentation
- Game flow explanation
- Detailed setup instructions
- Deployment guides (EAS Build, Web, etc.)
- Troubleshooting guide

## Recent Improvements

- **Timer Synchronization**: Presence-based timer sync using Supabase Presence for accurate multiplayer timing
- **Clock Skew Immunity**: Local time tracking prevents timer desynchronization from device clock differences
- **Rush Round Enhancement**: Random 33% chance with prominent visual indicators (orange timer, badge, flash animation)

## Tech Stack

- **React Native** with Expo
- **Supabase Realtime** for peer-to-peer communication
- **Zustand** for state management
- **React Native Reanimated** for animations
- **Expo Haptics** for tactile feedback

## Project Structure

```
├── app/
│   └── (tabs)/
│       ├── index.tsx      # Home screen (create/join)
│       ├── lobby.tsx      # Waiting room
│       └── game.tsx       # Main game screen
├── components/
│   └── game/              # Game components
│       ├── dice.tsx
│       ├── betting-timer.tsx
│       ├── betting-panel.tsx
│       ├── player-info.tsx
│       └── results-overlay.tsx
└── lib/
    ├── supabase.ts        # Supabase client
    ├── room-manager.ts    # Room management
    ├── game-logic.ts      # Game rules
    └── game-state.ts      # State management
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license here]
