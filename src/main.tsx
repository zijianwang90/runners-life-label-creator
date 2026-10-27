import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/barlow-condensed/latin-900.css";
import App from "./App";
import { PrintRoot } from "./print/PrintRoot";
import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    {window.location.hash === "#print" ? <PrintRoot /> : <App />}
  </React.StrictMode>
);
