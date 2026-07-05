import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// React Flow base CSS first, then our overrides — our rules must win the cascade.
import "@xyflow/react/dist/style.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
