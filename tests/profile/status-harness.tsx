import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ProfileStatusSelect } from "../../src/components/settings/ProfileStatusSelect";
import { validateProfileStatus } from "../../src/lib/profile-status";
import type { UserStatus } from "../../src/types";
import "../../src/styles.css";

function Harness() {
  const [status, setStatus] = useState<UserStatus>("online");
  const [result, setResult] = useState("Aguardando salvar");
  // Reproduce a non-default profile arriving after the form/select mounts.
  useEffect(() => {
    const timer = setTimeout(() => setStatus("dnd"), 100);
    return () => clearTimeout(timer);
  }, []);
  return (
    <main className="bg-background text-foreground min-h-screen p-8">
      <h1>Teste de status assíncrono — sem banco</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          validateProfileStatus(status);
          setResult(`Payload válido: ${status}`);
        }}
      >
        <label htmlFor="status">Status online</label>
        <ProfileStatusSelect value={status} onChange={setStatus} />
        <button type="submit">Salvar perfil</button>
      </form>
      <output>{result}</output>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
