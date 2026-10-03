import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DownloadWindows({ compact = false }: { compact?: boolean }) {
  if (typeof window !== "undefined" && window.location.protocol === "lobbyx:") return null;
  if (compact) {
    return (
      <a
        href="https://github.com/goappcall-star/spaceopx/releases/latest/download/LobbyX-Setup-x64.exe"
        aria-label="Baixar LobbyX para Windows 64 bits"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        <Download className="h-3.5 w-3.5" />
        Baixar app para Windows
      </a>
    );
  }
  return (
    <Button asChild variant="outline" size="lg">
      <a
        href="https://github.com/goappcall-star/spaceopx/releases/latest/download/LobbyX-Setup-x64.exe"
        aria-label="Baixar LobbyX para Windows 64 bits"
      >
        <Download className="mr-2 h-4 w-4" />
        Baixar para Windows
      </a>
    </Button>
  );
}
