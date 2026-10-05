import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ConfirmActionDialog } from "../../src/components/app/ConfirmActionDialog";
import "../../src/styles.css";
function Harness() {
  const [open, setOpen] = useState(true);
  const [deleted, setDeleted] = useState(false);
  return (
    <main className="bg-background text-foreground min-h-screen p-8">
      <h1>Teste de confirmação — sem dados reais</h1>
      <button onClick={() => setOpen(true)}>Excluir categoria</button>
      <output>{deleted ? "Confirmado" : "Nada excluído"}</output>
      {open && (
        <ConfirmActionDialog
          title="Excluir categoria Jogos?"
          description="Seus canais serão mantidos e aparecerão em “Sem categoria”."
          onClose={() => setOpen(false)}
          onConfirm={async () => {
            setDeleted(true);
            return true;
          }}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
