import "../../src/styles.css";
import { createRoot } from "react-dom/client";
import { CommunityEventsPreview } from "./preview";
const root = createRoot(document.getElementById("root")!);
root.render(<CommunityEventsPreview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
