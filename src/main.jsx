import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { ThemeProvider } from "./hooks/useTheme.jsx";

const WatchPage = lazy(() => import("./pages/Watch/WatchPage.jsx"));
const ListenPage = lazy(() => import("./pages/Listen/ListenPage.jsx"));
const ReadPage = lazy(() => import("./pages/Read/ReadPage.jsx"));
const AuthPage = lazy(() => import("./pages/Auth/AuthPage.jsx"));
const CollabPage = lazy(() => import("./pages/Collab/CollabPage.jsx"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <WatchPage /> },
      { path: "watch", element: <WatchPage /> },
      { path: "listen", element: <ListenPage /> },
      { path: "read", element: <ReadPage /> },
      { path: "auth", element: <AuthPage /> },
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
