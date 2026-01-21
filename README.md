# GTFO - Sunset Notification App

Never miss a beautiful sunset again. GTFO monitors sunset predictions and notifies you when there's a particularly good one coming in your area.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Convex backend

```bash
npx convex dev
```

This will:
- Create a new Convex project (or connect to existing one)
- Generate TypeScript types
- Start the development server

### 3. Set environment variables

Create a `.env.local` file:

```bash
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

In the Convex dashboard, add the Sunsethue API key:
- Go to Settings > Environment Variables
- Add `SUNSETHUE_API_KEY` with your API key

### 4. Get Sunsethue API access

Sign up at https://sunsethue.com/dev-api to get your API key (free tier: 1,000 credits/day).

### 5. Run the app

```bash
# Terminal 1: Convex backend
npm run dev:convex

# Terminal 2: Expo app
npm start
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   iOS App       │────▶│   Convex        │────▶│  Sunsethue API  │
│   (Expo)        │     │   Backend       │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       ▼
        └──────────────▶  Expo Push Notifications
```

## Features

- **Sunset quality predictions** - Based on cloud cover and atmospheric conditions
- **Morning notifications (11am)** - After Sunsethue predictions update
- **1 hour reminders** - Configurable alert before sunset starts
- **Quality threshold** - Only get notified for Good or Great sunsets
- **Background location** - Predictions update as you travel

## Tech Stack

- React Native (Expo)
- Convex (backend)
- Sunsethue API (sunset predictions)
- Expo Push Notifications

## Building for TestFlight

### Prerequisites

- Xcode installed with command line tools
- Apple Developer account
- EAS CLI: `npm install -g eas-cli`
- Logged into EAS: `eas login`

### Build and Submit

```bash
# 1. Build locally for App Store/TestFlight (auto-increments build number)
eas build --platform ios --profile production --local

# 2. Submit to TestFlight
eas submit --platform ios --latest
```

The first time you run the build, EAS will prompt you to log into your Apple Developer account to generate/fetch signing credentials.

### Build Profiles (eas.json)

| Profile | Purpose | Distribution |
|---------|---------|--------------|
| `production` | App Store / TestFlight | App Store Connect |
| `preview` | Internal testing | Ad-hoc (registered devices) |
| `simulator` | iOS Simulator | N/A |

### Quick Reference

```bash
# Build for simulator testing
eas build --platform ios --profile simulator --local

# Build for internal testers (ad-hoc)
eas build --platform ios --profile preview --local

# Check current credentials
eas credentials --platform ios

# View build history
eas build:list
```

### Troubleshooting

- **Credentials issues**: Run `eas credentials --platform ios` to manage certificates/profiles
- **Build number conflicts**: The `production` profile auto-increments; check App Store Connect for current build number
- **Pod install fails**: Run `cd ios && pod install --repo-update`
