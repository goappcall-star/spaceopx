import { AccountPasswordEditor } from "@/components/settings/AccountPasswordEditor";
import { useState } from "react";
import { AccountSettingsView } from "@/components/settings/AccountSettingsView";
import { accountLoginMethods } from "@/lib/account-settings";
export function AccountPreview({
  onBack,
  onProfile,
}: {
  onBack: () => void;
  onProfile: () => void;
}) {
  const [notice, setNotice] = useState("");
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-10 lg:px-14">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            PRÉVIA LOCAL · CONTA FICTÍCIA · SEM AUTENTICAÇÃO
          </p>
          <h1 className="text-2xl font-semibold">Minha conta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gerencie suas informações de acesso e identificação da sua conta no LobbyX.
          </p>
        </div>
        <button type="button" className="text-xs text-primary underline" onClick={onBack}>
          Voltar à prévia
        </button>
      </div>
      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-border p-3 text-sm">
          {notice}
        </p>
      )}
      <AccountSettingsView
        name="Nicooo"
        username="nico"
        avatar="/lobbyx-logo.png"
        frame="royal"
        email="nico@example.invalid"
        verified={true}
        created="12 de mar. de 2023"
        methods={accountLoginMethods({ identities: [{ provider: "email" }] })}
        platform="LobbyX Desktop · exemplo fictício"
        online={true}
        expires={null}
        passwordSection={
          <AccountPasswordEditor
            onSubmit={async () => {
              throw { code: "preview_only" };
            }}
          />
        }
        busy={false}
        onProfile={onProfile}
        onPrivacy={() => setNotice("O atalho abre a aba Privacidade no aplicativo autenticado.")}
        onSignOut={() => setNotice("Prévia em memória: nenhuma sessão real foi encerrada.")}
      />
    </div>
  );
}
