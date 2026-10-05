import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ANIME_FRAME_THEMES } from "../../src/lib/anime-frame-themes";
import { ProfileFrameDecoration } from "../../src/components/gamer/ProfileCosmetics";
import { ProfileCosmeticPicker } from "../../src/components/settings/ProfileCosmeticPicker";
import { Avatar, AvatarFallback } from "../../src/components/ui/avatar";
import type { ProfileCosmeticId } from "../../src/lib/profile-cosmetics";
import "../../src/styles.css";
function Harness() {
  const [animated, setAnimated] = useState(true);
  const [frame, setFrame] = useState<ProfileCosmeticId>("crimson-flow");
  useEffect(() => {
    document.documentElement.dataset.frameAnimations = String(animated);
  }, [animated]);
  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <h1 className="text-2xl font-semibold">Coleção original LobbyX</h1>
        <button
          className="rounded-xl bg-primary text-primary-foreground px-4 py-2"
          onClick={() => setAnimated(!animated)}
        >
          Animações: {animated ? "ativadas" : "desativadas"}
        </button>
        <ProfileCosmeticPicker
          kind="frame"
          value={frame}
          onChange={setFrame}
          name="Nicooo"
          avatar=""
          banner=""
        />
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {ANIME_FRAME_THEMES.map((theme) => (
            <div key={theme.id} className="relative rounded-2xl bg-surface p-6 min-h-52">
              <ProfileFrameDecoration value={theme.id} />
              <Avatar frame={theme.id} className="mx-auto h-12 w-12">
                <AvatarFallback>LX</AvatarFallback>
              </Avatar>
              <h2 className="text-sm font-semibold mt-5">{theme.name}</h2>
              <p className="text-xs text-muted-foreground mt-2">{theme.description}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
