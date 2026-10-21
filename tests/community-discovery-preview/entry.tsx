import { createRoot } from "react-dom/client";
import { DiscoveryPreview } from "./preview";
const root = createRoot(document.getElementById("root")!);
root.render(<DiscoveryPreview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
