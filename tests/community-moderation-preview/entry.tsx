import "../../src/styles.css";
import { createRoot } from "react-dom/client";
import { ModerationPreview } from "./preview";
const root = createRoot(document.getElementById("root")!);
root.render(<ModerationPreview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
