# iOS App

This app lives in `apps/ios` and mirrors the current listener-facing functionality from `apps/web` without changing the existing API or web code.

## Stack

- Expo Router
- React Native + TypeScript
- TanStack Query for API data
- Zustand for auth session state
- `expo-audio` for playback
- `expo-file-system` + `expo-sharing` for export downloads

## API

The app uses the same backend as the web client in `apps/api`.

API resolution order:

1. `EXPO_PUBLIC_API_URL`
2. `http://127.0.0.1:8000` on iOS simulators during local development
3. `https://api.myndral.com` as the production fallback

## Brand System

Brand tokens are synced from `shared/brand`.

- Source files: `shared/brand/theme.ts` and `shared/brand/tokens.css`
- Generated file: `src/generated/brandTokens.ts`
- Sync command: `npm run sync:brand`

All app theme colors and theme labels flow through that generated file so brand-kit changes stay centralized in `shared/brand`.

## Commands

- `npm install`
- `npm run typecheck`
- `npm run start`
- `npm run ios`

## Current Scope

Implemented to match the currently working web experience:

- Login, registration, and free-plan onboarding
- Home, search, browse, library, and account tabs
- Artist, album, and playlist detail screens
- Audio playback with a mini player and full player
- Personal-use exports for tracks and albums

Backend functionality that is still not implemented on the web/API remains out of scope here as well.
