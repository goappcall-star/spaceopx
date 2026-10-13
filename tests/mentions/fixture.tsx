import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MessageComposer } from "@/components/chat/MessageComposer";
import type { MemberWithProfile } from "@/types";
import "@/styles.css";
const members = [
  { user_id: "local-nico", profile: { username: "nico", display_name: "Nicolas" } },
  { user_id: "local-ruan", profile: { username: "ruan", display_name: "Ruan" } },
] as MemberWithProfile[];
function Preview() {
  const [sent, setSent] = useState(0);
  return <main className="bg-background text-foreground min-h-screen p-12">
    <h1 className="mb-3 text-2xl font-bold">Menções · Teste local</h1>
    <p className="text-muted-foreground mb-48">Digite @ni ou @tod. Enter completa; setas navegam; Escape fecha; Shift+Enter cria uma nova linha.</p>
    <div className="max-w-3xl rounded-xl border border-border overflow-visible">
      <MessageComposer serverId="local" channelId="local" channelName="teste-local" members={members} disabled={false}
        replyTo={null} onCancelReply={()=>{}} onTyping={()=>{}} onSend={async()=>{setSent(n=>n+1);}} />
    </div>
    <p className="text-muted-foreground mt-4" role="status">Envios locais: {sent}</p>
    <p className="text-muted-foreground mt-2 text-xs">Sem mensagens reais ou conexão com o banco de produção.</p>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
