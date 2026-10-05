import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemberActions } from "../../src/components/app/MemberActions";
import { member, server } from "./member-fixture";
import type { MemberWithProfile, Server } from "../../src/types";
import "../../src/styles.css";
function Harness() {
  const [manager, setManager] = useState(true);
  return (
    <main className="bg-background text-foreground min-h-screen p-8">
      <h1>Teste de menu — sem dados reais</h1>
      <label>
        <input type="checkbox" checked={manager} onChange={(e) => setManager(e.target.checked)} />{" "}
        Permissão de moderador
      </label>
      <div className="mt-6 w-64 rounded-xl border p-4">
        <MemberActions
          member={member as MemberWithProfile}
          server={server as Server}
          canManageRoles={manager}
          canManageMembers={manager}
          canKick={manager}
          canBan={manager}
          onAliasChange={() => {}}
          onInvite={() => {}}
          onStartDirect={() => {}}
        >
          <button>Amigo</button>
        </MemberActions>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <Harness />
  </QueryClientProvider>,
);
