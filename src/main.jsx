import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, useRouteError } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { ThemeProvider } from "./hooks/useTheme.jsx";
import { ProgressionProvider } from "./hooks/useProgression.jsx";

// Retry dynamic imports to handle stale asset hashes after deployments.
// When a new build is deployed, old chunk/CSS filenames become invalid.
// This retries once with a full page reload to pick up the new manifest.
function lazyWithRetry(importFn) {
  return lazy(() =>
    importFn().catch((error) => {
      const hasReloaded = sessionStorage.getItem("retry-lazy-refreshed");
      if (!hasReloaded) {
        sessionStorage.setItem("retry-lazy-refreshed", "true");
        window.location.reload();
        return new Promise(() => {}); // never resolves — page is reloading
      }
      sessionStorage.removeItem("retry-lazy-refreshed");
      throw error;
    })
  );
}

const WatchPage = lazyWithRetry(() => import("./pages/Watch/WatchPage.jsx"));
const ListenPage = lazyWithRetry(() => import("./pages/Listen/ListenPage"));
const ReadPage = lazyWithRetry(() => import("./pages/Read/ReadPage.jsx"));
const AuthPage = lazyWithRetry(() => import("./pages/Auth/AuthPage.jsx"));
const CollabPage = lazyWithRetry(() => import("./pages/Collab/CollabPage.jsx"));
const ProfilePage = lazyWithRetry(() => import("./pages/Profile/ProfilePage.jsx"));

function RouteErrorFallback() {
  const error = useRouteError();
  return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <h1>Page failed to load</h1>
      <p>This can happen after a site update. Try refreshing the page.</p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: "16px",
          padding: "8px 20px",
          cursor: "pointer",
        }}
      >
        Refresh
      </button>
      {!import.meta.env.PROD && error && (
        <pre style={{ marginTop: "20px", whiteSpace: "pre-wrap", textAlign: "left" }}>
          {error.message || String(error)}
        </pre>
      )}
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <WatchPage /> },
      { path: "watch", element: <WatchPage /> },
      { path: "listen", element: <ListenPage /> },
      { path: "read", element: <ReadPage /> },
      { path: "auth", element: <AuthPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "collab", element: <CollabPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ProgressionProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </ThemeProvider>
    </ProgressionProvider>
  </React.StrictMode>
);
