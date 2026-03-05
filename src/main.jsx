import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./lib/config/zod.config.js";
import App from "./App.jsx";
import "./index.css";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import RouteErrorPage from "./components/shared/RouteErrorPage.jsx";
import { ThemeProvider } from "./hooks/useTheme.jsx";
import { lazyWithRetry } from "./lib/lazyWithRetry.js";

const WatchPage = lazyWithRetry(() => import("./pages/Watch/WatchPage.jsx"), "watch-page");
const ListenPage = lazyWithRetry(() => import("./pages/Listen/ListenPage"), "listen-page");
const ReadPage = lazyWithRetry(() => import("./pages/Read/ReadPage.jsx"), "read-page");
const AuthPage = lazyWithRetry(() => import("./pages/Auth/AuthPage.jsx"), "auth-page");
const CollabPage = lazyWithRetry(() => import("./pages/Collab/CollabPage.jsx"), "collab-page");
const ProfilePage = lazyWithRetry(() => import("./pages/Profile/ProfilePage.jsx"), "profile-page");

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <RouteErrorPage />,
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
    <ThemeProvider>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);
