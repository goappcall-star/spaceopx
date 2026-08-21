import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Headphones } from "lucide-react";

import { AudioSettingsPanel } from "@/components/settings/AudioSettingsPanel";
import { Button } from "@/components/ui/button";

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
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link to="/app">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>

        <header className="mb-8 flex items-center gap-3">
          <span className="border-primary/40 bg-primary/10 text-primary glow-soft flex h-11 w-11 items-center justify-center rounded-xl border">
            <Headphones className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Voz e áudio</h1>
            <p className="text-muted-foreground text-sm">
              Suas preferências ficam salvas na sua conta e valem para canais de voz e chamadas.
            </p>
          </div>
        </header>

        <AudioSettingsPanel />
      </div>
    </div>
  );
}
