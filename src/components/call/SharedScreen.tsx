import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VideoTile, type TileData } from "@/components/voice/VideoTile";
import { VideoSurface } from "@/components/voice/VideoSurface";

export function SharedScreen({ tile }: { tile: TileData }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="relative min-h-0 min-w-0 flex-1">
        <VideoTile tile={tile} className="h-full" large />
        <Button
          size="icon"
          variant="secondary"
          className="absolute top-2 right-2"
          aria-label="Ver compartilhamento em tela cheia"
          title="Tela cheia"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          className="flex h-dvh w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-black p-0 sm:max-w-none"
          aria-describedby={undefined}
        >
          <DialogTitle className="shrink-0 py-3 pr-12 pl-4 text-sm text-white">
            {tile.name} · Compartilhamento de tela
          </DialogTitle>
          <DialogDescription className="sr-only">
            Pressione Escape ou use o botão de fechar para voltar à conversa.
          </DialogDescription>
          <div className="min-h-0 flex-1">
            <VideoSurface stream={tile.stream} objectFit="contain" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
