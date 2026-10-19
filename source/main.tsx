import React from "react";
import {createRoot} from "react-dom/client";
import ReaderApp from "./reader-app";
import "./reader.css";
createRoot(document.getElementById("root")!).render(<ReaderApp/>);
