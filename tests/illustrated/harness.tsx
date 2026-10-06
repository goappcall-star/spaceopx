import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { PROFILE_COSMETICS, normalizeProfileCosmetic } from "../../src/lib/profile-cosmetics";
import { ProfileFrameDecoration } from "../../src/components/gamer/ProfileCosmetics";
import { ProfileCosmeticPicker } from "../../src/components/settings/ProfileCosmeticPicker";
import { VisualQualitySync } from "../../src/hooks/use-visual-quality";
import { normalizeAvatarFrame } from "../../src/lib/avatar-frames";
import "../../src/styles.css";
function App() {
  const [light, setLight] = useState(false);
  const [avatarFrame, setAvatarFrame] = useState(() =>
    normalizeAvatarFrame(localStorage.getItem("fixture-avatar-frame")),
  );
  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
  }, [light]);
  const [cardHeight, setCardHeight] = useState(520);
  const [animated, setAnimated] = useState(true);
  const [motionStats, setMotionStats] = useState("");
  const [selected, setSelected] = useState(() => localStorage.getItem("fixture-frame") ?? "ember");
  useEffect(() => {
    document.documentElement.dataset.pageHidden = String(document.hidden);
    const f = () => {
      document.documentElement.dataset.pageHidden = String(document.hidden);
    };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  const change = (v) => {
    setSelected(v);
    localStorage.setItem("fixture-frame", v);
  };
  const frames = PROFILE_COSMETICS.filter((x) => x.id !== "none");
  return (
    <main style={{ padding: 50, maxWidth: 1400, margin: "auto" }}>
      <VisualQualitySync />
      <label>
        <input type="checkbox" checked={light} onChange={(e) => setLight(e.target.checked)} />
        Tema claro
      </label>
      <h1 className="text-2xl">Encaixe das molduras LobbyX</h1>
      <label>
        Altura do perfil
        <select value={cardHeight} onChange={(e) => setCardHeight(Number(e.target.value))}>
          <option value="430">Compacto</option>
          <option value="520">Perfil padrão</option>
          <option value="680">Perfil alto</option>
        </select>
      </label>
      <label>
        <input type="checkbox" checked={animated} onChange={(e) => setAnimated(e.target.checked)} />{" "}
        Animações
      </label>
      <button
        onClick={() =>
          setMotionStats(
            JSON.stringify(
              Array.from(document.querySelectorAll(".lx-illustrated-frame")).map((node) => ({
                theme: node.getAttribute("data-theme"),
                visible: node.getAttribute("data-visible"),
                running: node
                  .getAnimations({ subtree: true })
                  .filter((a) => a.playState === "running").length,
                paused: node
                  .getAnimations({ subtree: true })
                  .filter((a) => a.playState === "paused").length,
                stroke: getComputedStyle(node.querySelector(".lx-frame-trail")!).strokeDashoffset,
              })),
            ),
          )
        }
      >
        Medir animações
      </button>
      <button onClick={() => setMotionStats("")}>Limpar medidas</button>
      <pre style={{ whiteSpace: "pre-wrap" }}>{motionStats}</pre>
      <p>Escolha salva: {normalizeProfileCosmetic(selected)}</p>
      <ProfileCosmeticPicker
        kind="avatar"
        value={avatarFrame}
        onChange={(value) => {
          setAvatarFrame(value);
          localStorage.setItem("fixture-avatar-frame", value);
        }}
        name="Perfil real de teste"
        avatar=""
        banner=""
      />
      <ProfileCosmeticPicker
        kind="frame"
        value={selected}
        onChange={change}
        name="Perfil real de teste"
        avatar=""
        banner=""
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(280px,320px))",
          gap: 100,
          marginTop: 50,
        }}
      >
        {frames.map((item) => (
          <section key={item.id}>
            <h2 style={{ marginBottom: 80 }}>{item.name}</h2>
            <div className="relative bg-surface border rounded-2xl" style={{ height: cardHeight }}>
              <ProfileFrameDecoration value={item.id} animated={animated} />
              <div
                className="h-44 rounded-t-2xl"
                style={{ background: "linear-gradient(120deg,#254061,#704598)" }}
              />
              <div style={{ padding: 32 }}>
                <p className="text-xl font-bold">Dados reais do perfil</p>
                <p>@usuario_teste</p>
                <p className="my-4">Online · Personalização preservada</p>
                <p>As artes contêm somente a moldura.</p>
                <button className="border p-2 rounded my-4" onClick={() => change(item.id)}>
                  Usar {item.name}
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
