# GTFO - Sunset Quality Predictions

A React Native app that predicts sunset quality and sends notifications for great sunsets.

## Development

```bash
# Start the development server
npm start

# Run Convex backend in development
npm run dev:convex
```

## Building & Deploying

### iOS TestFlight Build

Build locally and submit to TestFlight:

```bash
# Build locally (requires Xcode and EAS CLI)
eas build --platform ios --profile production --local --non-interactive

# Submit the latest build to TestFlight
eas submit --platform ios --latest
```

The build process:
1. Increments the build number automatically
2. Uses cached Apple credentials (must be logged in via `eas credentials` first)
3. Produces an `.ipa` file in the project root
4. Submit uploads to App Store Connect for TestFlight distribution

### First-time Setup

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo account
eas login

# Configure Apple credentials (one-time)
eas credentials
```

## Project Structure

- `app/` - Expo Router screens and layouts
- `components/` - Reusable React components
- `convex/` - Convex backend functions and schema
- `hooks/` - Custom React hooks
- `tasks/` - Background task definitions
