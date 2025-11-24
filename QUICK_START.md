# Quick Start Guide

Get the game running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Supabase account (free)

## Step-by-Step Setup

### 1. Install Dependencies (30 seconds)

```bash
npm install
```

**Note:** This will install all dependencies including:
- Core React Native and Expo packages
- Supabase client for real-time multiplayer
- All other required packages

If you're setting up on a new machine, this single command installs everything needed. No additional setup required.

### 2. Create Supabase Project (2 minutes)

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Name**: `dice-game` (or any name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
4. Click "Create new project"
5. Wait ~2 minutes for project to initialize

### 3. Get Supabase Credentials (30 seconds)

1. In your Supabase project, go to **Settings** (gear icon) → **API**
2. Find these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### 4. Create Environment File (30 seconds)

Create a file named `.env` in the project root:

```bash
# On Mac/Linux:
touch .env

# On Windows:
# Create new file named .env
```

Add these lines (replace with your actual values):

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:** 
- Use `EXPO_PUBLIC_` prefix exactly as shown
- No quotes around values
- No spaces around `=`

### 5. Start the App (1 minute)

```bash
npx expo start
```

You'll see:
- QR code in terminal
- Options to open on iOS/Android/Web

### 6. Run on Your Device

**Option A: Expo Go (Easiest)**
1. Install "Expo Go" app on your phone
2. Scan the QR code from terminal
3. App loads!

**Option B: Simulator/Emulator**
- Press `i` for iOS simulator (Mac only)
- Press `a` for Android emulator
- Press `w` for web browser

## Test Multiplayer

1. **Device 1**: Open app → Tap "HOST GAME" → Note the 6-digit code
2. **Device 2**: Open app → Enter code → Tap "JOIN GAME"
3. Both devices should connect and game starts!

## Troubleshooting

**"Supabase credentials not found" warning:**
- Check `.env` file exists in project root
- Verify variable names start with `EXPO_PUBLIC_`
- Restart Expo server: Stop (Ctrl+C) and run `npx expo start` again

**Can't connect to opponent:**
- Verify both devices use same Supabase project
- Check room code matches exactly
- Ensure both devices have internet connection

**App crashes on launch:**
- Clear cache: `npx expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## Next Steps

- Read [DOCS.md](./DOCS.md) for detailed documentation
- See [README.md](./README.md) for game rules and features
- Deploy to production using EAS Build (see DOCS.md)

## Need Help?

Check the full [DOCS.md](./DOCS.md) for:
- Architecture details
- Component documentation
- Deployment guides
- Advanced troubleshooting

