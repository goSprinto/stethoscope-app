import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";

const node = document.getElementById("root");

const root = createRoot(node);

root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
