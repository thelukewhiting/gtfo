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

In the Convex dashboard, add the SunsetWX API key:
- Go to Settings > Environment Variables
- Add `SUNSETWX_API_KEY` with your API key

### 4. Get SunsetWX API access

Email team@sunsetwx.com to request access to the Sunburst API.

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
│   iOS App       │────▶│   Convex        │────▶│  SunsetWX API   │
│   (Expo)        │     │   Backend       │     │  (Sunburst)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       ▼
        └──────────────▶  Expo Push Notifications
```

## Features

- **Sunset quality predictions** - Based on cloud cover, humidity, and atmospheric conditions
- **Morning notifications (11am)** - After SunsetWX predictions update at 10am
- **1 hour reminders** - Configurable alert before sunset starts
- **Quality threshold** - Only get notified for Good or Great sunsets
- **Background location** - Predictions update as you travel

## Tech Stack

- React Native (Expo)
- Convex (backend)
- SunsetWX Sunburst API (sunset predictions)
- Expo Push Notifications
