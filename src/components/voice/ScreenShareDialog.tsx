import { ScreenShareSettings } from "./ScreenShareSettings";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVoice } from "@/hooks/use-voice";
import { useCall } from "@/hooks/use-call";
import { useVisualQuality } from "@/hooks/use-visual-quality";
import {
  DEFAULT_SCREEN_OPTIONS,
  normalizeScreenOptions,
  type ScreenShareOptions,
  type ScreenShareController,
} from "@/services/screen-share";
import {
  openScreenSharePanel,
  screenPanelTarget,
  subscribeScreenPanel,
} from "@/services/screen-share-panel";

const KEY = "lobbyx:screen-share-v2";
function savedOptions(performanceMode: boolean): ScreenShareOptions {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return normalizeScreenOptions(JSON.parse(saved));
  } catch {
    /* Private browsing. */
  }
  return performanceMode
    ? { resolution: 720, fps: 30, mode: "performance", audio: true }
    : { ...DEFAULT_SCREEN_OPTIONS };
}
export function ScreenShareDialog() {
  const target = useSyncExternalStore(subscribeScreenPanel, screenPanelTarget, () => null);
  const voice = useVoice(),
    call = useCall();
  const quality = useVisualQuality();
  const [options, setOptions] = useState<ScreenShareOptions>(DEFAULT_SCREEN_OPTIONS);
  const [busy, setBusy] = useState(false);
  const current = target === "call" ? call : voice;
  const controller = current.getScreenShareController();
  useEffect(() => {
    if (target && !controller) {
      openScreenSharePanel(null);
      return;
    }
    if (target)
      setOptions(
        controller?.getSnapshot().active
          ? controller.getSnapshot().requested
          : savedOptions(quality !== "normal"),
      );
  }, [target, controller, quality]);
  const confirm = async () => {
    if (!controller) return;
    setBusy(true);
    try {
      if (controller.getSnapshot().active) await controller.update(options);
      else await current.toggleScreenShare(options);
      if (controller.getSnapshot().active) {
        try {
          localStorage.setItem(KEY, JSON.stringify(options));
        } catch {
          /* Session works without storage. */
        }
        openScreenSharePanel(null);
      }
    } catch {
      toast.error(
        "Não foi possível aplicar essa qualidade. A chamada e a transmissão atual foram preservadas.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !busy) openScreenSharePanel(null);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar tela</DialogTitle>
          <DialogDescription>Escolha a qualidade e acompanhe a transmissão.</DialogDescription>
        </DialogHeader>
        <ScreenShareSettings
          active={current.screenOn}
          busy={busy}
          options={options}
          onOptions={setOptions}
          performanceMode={quality !== "normal"}
          controller={controller}
          onConfirm={() => void confirm()}
          onStop={() => {
            void current.toggleScreenShare();
            openScreenSharePanel(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
