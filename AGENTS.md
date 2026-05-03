# Repository Agent Instructions

This repository is an Expo/React Native app for a private, S3-backed photo sharing experience. Keep changes focused on the mobile app and avoid introducing backend services unless explicitly requested.

## Project Structure

- `App.tsx` wires app-level providers and renders `HomeView`.
- `components/` contains the user-facing screens and UI components.
- `data-access/` contains persistence, S3 access, and notification code.
- `utils.ts` contains shared helpers.
- `assets/` contains Expo icons and splash assets.

## Commands

- Install dependencies with `npm install`.
- Start the Expo dev server with `npm run start`.
- Run platform targets with `npm run ios`, `npm run android`, or `npm run web`.
- Run linting with `npm run lint`.

## Environment

- The app depends on Expo configuration plus S3-related environment variables from `.env`, `.env.local`, or `eas.json`.
- Do not commit secrets, bucket credentials, generated local Expo state, or machine-specific files.
- Treat S3 and push notification behavior as integration surfaces; avoid making real external calls from unit-level checks.

## Code Style

- Use TypeScript with strict mode.
- Prefer function components and hooks.
- Keep data access logic in `data-access/`; do not spread S3, AsyncStorage, or notification details through UI components.
- Prefer React Query for app state that is fetched, cached, or invalidated.
- Follow the existing formatting style: double quotes, semicolons, and compact component files.

## Testing And Verification

- Before handing off code changes, run `npm run lint` when practical.
- For UI changes, verify the relevant Expo target manually or with simulator/browser tooling when available.
- Keep tests and checks focused on public behavior and state, not internal implementation details.
