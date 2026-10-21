import { createRoot } from "react-dom/client";
import { UnifiedPreview } from "./preview";
const root = createRoot(document.getElementById("root")!);
root.render(<UnifiedPreview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
