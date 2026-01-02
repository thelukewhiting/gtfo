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
