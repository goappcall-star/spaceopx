import { UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommunitySection, CommunityEmpty, CommunityNotice, CommunityActions } from "./CommunityUI";
import type { JoinRequest } from "@/types/community-discovery";

export function CommunityJoinRequestsView({
  items,
  loading,
  busy,
  error,
  hasMore,
  onReview,
  onFirst,
  onNext,
}: {
  items: JoinRequest[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  hasMore: boolean;
  onReview: (request: JoinRequest, approve: boolean) => void;
  onFirst: () => void;
  onNext: () => void;
}) {
  return (
    <section className="community-ui">
      <CommunitySection
        title="Solicitações de entrada"
        description="Proprietário e gestores explicitamente delegados podem analisar. Aprovar não dispensa regras e boas-vindas obrigatórias."
      >
        {error ? (
          <CommunityNotice tone="error">{error}</CommunityNotice>
        ) : loading ? (
          <p role="status" className="p-4 text-sm text-muted-foreground">
            Carregando solicitações…
          </p>
        ) : !items.length ? (
          <CommunityEmpty
            icon={UsersRound}
            title="Nenhuma solicitação pendente nesta página"
            description="Quando alguém pedir para participar, você poderá revisar a entrada por aqui."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((r) => (
              <li key={r.user_id} className="flex flex-wrap items-center gap-3 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-xs text-primary">
                  {r.display_name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold">{r.display_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Solicitação em {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onReview(r, false)}
                  >
                    Rejeitar
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => onReview(r, true)}>
                    Aprovar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <CommunityActions>
          <Button variant="ghost" size="sm" onClick={onFirst}>
            Atualizar início
          </Button>
          {hasMore && (
            <Button size="sm" variant="outline" onClick={onNext}>
              Próximas solicitações
            </Button>
          )}
        </CommunityActions>
      </CommunitySection>
    </section>
  );
}
