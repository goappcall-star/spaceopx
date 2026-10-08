import { SettingsShell } from "@/components/settings/SettingsShell";
import { createFileRoute } from "@tanstack/react-router";

import { AudioSettingsPanel } from "@/components/settings/AudioSettingsPanel";

export const Route = createFileRoute("/_authenticated/settings_/voice")({
  head: () => ({
    meta: [
      { title: "Voz e áudio — LobbyX" },
      {
        name: "description",
        content:
          "Configure microfone, saída de áudio, volumes e push to talk para chamadas e canais de voz no LobbyX.",
      },
      { property: "og:title", content: "Voz e áudio — LobbyX" },
      {
        property: "og:description",
        content: "Microfone, saída, volumes, push to talk e testes de áudio.",
      },
    ],
  }),
  component: VoiceSettingsPage,
});

function VoiceSettingsPage() {
  return (
    <SettingsShell active="voice">
      <div className="max-w-3xl">
        <AudioSettingsPanel />
      </div>
    </SettingsShell>
  );
}
