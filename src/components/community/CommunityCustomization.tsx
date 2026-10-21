import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCommunityExperience } from "@/hooks/use-community-experience";
import { communityExperienceService } from "@/services/community-experience";
import { communityErrorMessage } from "@/services/communities";
import { serverImagesService } from "@/services/server-images";
import type { CommunityExperience } from "@/types/community-experience";
import type { Channel, Role } from "@/types";
import { CommunityCustomizationForm } from "./CommunityCustomizationForm";
export { CommunityCustomizationForm } from "./CommunityCustomizationForm";
export function CommunityCustomization({
  serverId,
  userId,
  channels,
  roles,
  canUpload,
}: {
  serverId: string;
  userId: string;
  channels: Channel[];
  roles: Role[];
  canUpload: boolean;
}) {
  const query = useCommunityExperience(serverId, userId),
    client = useQueryClient();
  const [initial, setInitial] = useState<CommunityExperience | null>(null);
  if (!initial)
    return (
      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="font-semibold">Página inicial e onboarding</h3>
        <p className="text-xs text-muted-foreground">
          Configure apresentação, avisos, atalhos e etapas de boas-vindas.
        </p>
        {query.isError && (
          <p role="alert" className="text-sm text-destructive">
            {communityErrorMessage(query.error)}
          </p>
        )}
        <Button
          variant="outline"
          disabled={!query.data?.can_manage || query.isFetching || query.isError}
          onClick={() => query.data && setInitial(query.data)}
        >
          Personalizar experiência
        </Button>
        {query.isError && (
          <Button variant="ghost" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        )}
      </section>
    );
  return (
    <CommunityCustomizationForm
      initial={initial}
      channels={channels}
      roles={roles}
      conflict={
        query.isError ||
        query.isPaused ||
        !query.data?.can_manage ||
        query.data.revision !== initial.revision
      }
      onCancel={() => setInitial(null)}
      onUpload={canUpload ? (f) => serverImagesService.upload(serverId, "banner", f) : undefined}
      onSave={async (config) => {
        try {
          await communityExperienceService.save(serverId, config, initial.revision);
          toast.success("Home e boas-vindas salvas.");
          void client.invalidateQueries({ queryKey: ["community-experience", userId, serverId] });
        } catch (e) {
          void query.refetch();
          throw Error(communityErrorMessage(e));
        }
      }}
    />
  );
}
