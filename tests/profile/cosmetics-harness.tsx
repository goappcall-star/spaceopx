import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProfileCosmeticPicker } from "../../src/components/settings/ProfileCosmeticPicker";
import { ProfileFrameDecoration } from "../../src/components/gamer/ProfileCosmetics";
import { nameplateStyle } from "../../src/lib/profile-cosmetics";
import type { ProfileCosmeticId } from "../../src/lib/profile-cosmetics";
import "../../src/styles.css";
function Harness() {
  const [frame, setFrame] = useState<ProfileCosmeticId>("aurora");
  const [plate, setPlate] = useState<ProfileCosmeticId>("cosmic");
  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-xl font-semibold">Personalização do perfil</h1>
        <ProfileCosmeticPicker
          kind="nameplate"
          value={plate}
          onChange={setPlate}
          name="Nicooo"
          avatar=""
          banner=""
        />
        <ProfileCosmeticPicker
          kind="frame"
          value={frame}
          onChange={setFrame}
          name="Nicooo"
          avatar=""
          banner=""
        />
        <output>
          Placa: {plate}; Moldura: {frame}
        </output>
        <div className="relative rounded-2xl bg-surface p-8">
          <ProfileFrameDecoration value={frame} />
          <p className="rounded-lg p-4" style={nameplateStyle(plate)}>
            Nicooo
          </p>
        </div>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
