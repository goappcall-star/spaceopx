import { CommunityEvents } from "./CommunityEvents";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CommunityHome } from "./CommunityHome";
import { CommunityOnboarding } from "./CommunityOnboarding";
import { useVoice } from "@/hooks/use-voice";
import { hasPermission } from "@/lib/permissions";
import { useServerRoles } from "@/hooks/use-server-admin";
import { communityExperienceService } from "@/services/community-experience";
import { communityErrorMessage } from "@/services/communities";
import type { CommunityExperience } from "@/types/community-experience";
import type { Server, Channel, MemberWithProfile } from "@/types";
export function CommunityWorkspace({
  server,
  data,
  channels,
  userId,
  me,
  onChannel,
  onSettings,
  unavailable,
}: {
  server: Server;
  data: CommunityExperience;
  channels: Channel[];
  userId: string;
  me: MemberWithProfile | undefined;
  onChannel: (id: string) => void;
  onSettings: () => void;
  unavailable: boolean;
}) {
  const { participantsByChannel } = useVoice(),
    client = useQueryClient();
  const { data: roles = [] } = useServerRoles(server.id);
  const [onboarding, setOnboarding] = useState<CommunityExperience | null>(() =>
    data.screened && !data.progress?.completed_revision ? data : null,
  );
  const visible = hasPermission(me, "view_channel") ? channels : [];
  return (
    <>
      {data.experience.home_enabled ? (
        <CommunityHome
          events={
            <CommunityEvents
              key={`${userId}:${server.id}`}
              serverId={server.id}
              userId={userId}
              channels={visible}
              onChannel={onChannel}
            />
          }
          server={server}
          data={data}
          channels={visible}
          participants={participantsByChannel}
          onChannel={onChannel}
          onOnboarding={() => setOnboarding(data)}
          onSettings={data.can_manage ? onSettings : undefined}
        />
      ) : (
        <section className="flex-1 overflow-y-auto p-8">
          <h1 className="text-2xl font-semibold">Boas-vindas · {server.name}</h1>
          <p className="my-4 text-sm text-muted-foreground">
            A página inicial está desativada. As boas-vindas continuam disponíveis.
          </p>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => setOnboarding(data)}
          >
            Revisar boas-vindas
          </button>
          <div className="mt-8 rounded-xl border border-border p-5">
            <h2 className="mb-4 font-semibold">Eventos da comunidade</h2>
            <CommunityEvents
              key={`${userId}:${server.id}`}
              serverId={server.id}
              userId={userId}
              channels={visible}
              onChannel={onChannel}
            />
          </div>
        </section>
      )}
      {onboarding && (
        <CommunityOnboarding
          data={onboarding}
          channels={visible}
          roles={roles}
          conflict={
            unavailable ||
            onboarding.revision !== data.revision ||
            onboarding.rules_revision !== data.rules_revision
          }
          onClose={() => setOnboarding(null)}
          onSave={async (input) => {
            try {
              await communityExperienceService.onboard(onboarding, input);
              void client.invalidateQueries({
                queryKey: ["community-experience", userId, server.id],
              });
              void client.invalidateQueries({ queryKey: ["members", server.id] });
            } catch (e) {
              throw Error(
                /community_rules_required/.test(String((e as Error)?.message))
                  ? "Aceite as regras atuais para concluir."
                  : communityErrorMessage(e),
              );
            }
          }}
        />
      )}
    </>
  );
}
