import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DownloadWindows({ compact = false }: { compact?: boolean }) {
  if (typeof window !== "undefined" && window.location.protocol === "lobbyx:") return null;
  return (
    <Button
      asChild
      variant="outline"
      size={compact ? "sm" : "lg"}
      className={compact ? "w-full" : undefined}
    >
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
