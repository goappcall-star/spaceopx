import { createRoot } from "react-dom/client";
import { Preview } from "./preview";
import "./preview.css";
const root = createRoot(document.getElementById("root")!);
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
