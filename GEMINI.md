# Gemini Code Intelligence File

This file provides context for AI agents to understand and interact with the Scholomance V10 codebase.

## Project Overview

Scholomance V10 is a single-page application with a "ritual-themed" user interface. It is built with a modern web stack, featuring a React frontend and a Fastify backend.

-   **Frontend**: A React application built with Vite. It uses React Router for navigation and features lazy-loaded pages for "Watch", "Listen", and "Read" flows. State management is handled through React Context providers and custom hooks. Styling is dynamic, with a theme system that reacts to user progression.
-   **Backend**: A Node.js server built with Fastify, located in the `codex/server` directory. It provides a basic API and is set up with session-based authentication using Redis, rate limiting, and other security measures.
-   **Architecture**: The application follows a client-server architecture. The frontend is the primary user interface, and the backend provides supporting API services. The project is well-documented with several architecture and security markdown files.

## Building and Running

### Frontend

The frontend is a Vite application. Key commands can be found in `package.json`.

-   **Install Dependencies**: `npm install`
-   **Run Development Server**: `npm run dev`
-   **Build for Production**: `npm run build`
-   **Run Tests**: `npm run test` (uses Vitest)
-   **Preview Production Build**: `npm run preview`

### Backend

The backend is a Fastify server.

-   **Install Dependencies**: Run `npm install` in the root directory. The backend shares the root `package.json`.
-   **Run Server**: `node codex/server/index.js`
    -   *Note*: The server requires a running Redis instance. Ensure Redis is available at the URL specified in `codex/server/.env` (`REDIS_URL`).

## Development Conventions

### Code Structure

-   `src`: Contains all frontend React code.
    -   `pages`: Top-level components for each main route (Watch, Listen, Read).
    -   `components`: Reusable UI components.
    -   `hooks`: Custom React hooks and Context providers for state management (e.g., `useCurrentSong`, `useProgression`).
    -   `lib`: Core application logic, like the phoneme and reference engines.
    -   `data`: Static data for schools, music library, and progression.
-   `codex/server`: Contains the Fastify backend server.
-   `tests`: Contains unit, accessibility, and visual regression tests.

### State Management

-   State is primarily managed using React's Context API.
-   Custom hooks in the `src/hooks/` directory encapsulate state logic (e.g., `useScrolls` for managing user-created text).
-   User progression and created "scrolls" are persisted in `localStorage`.

### Styling

-   Global styles and CSS variables are defined in `src/index.css`.
-   A dynamic theming system uses CSS variables to change the UI based on the user's selected "school".
-   School-specific styles are generated via `node scripts/generate-school-styles.js`.

### Testing

-   **Unit & Component Testing**: Vitest is used for unit and component testing. Configuration is in `vite.config.js`, and test setup is in `tests/setup.js`.
-   **Visual Regression Testing**: Playwright is used for visual snapshot testing. The configuration is in `playwright.config.js`.
    -   To update snapshots: `npx playwright test --update-snapshots`
    -   To run tests: `npx playwright test`
-   **Accessibility Testing**: `jest-axe` is used within Vitest tests to ensure accessibility standards.

### Security

-   The `SECURITY_ARCHITECTURE.md` file provides a detailed overview of the security posture.
-   The backend includes session-based authentication, rate limiting, and a basic authorization pattern.
-   The frontend uses React's built-in XSS protection and avoids `dangerouslySetInnerHTML`.
-   Future development should prioritize moving sensitive operations and API keys to the server-side, as outlined in the security documentation.
