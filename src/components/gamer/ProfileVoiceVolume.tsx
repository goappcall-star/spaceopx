import { Slider } from "@/components/ui/slider";
import { useOptionalVoice } from "@/hooks/use-voice";
import { useAuth } from "@/hooks/use-auth";

export function ProfileVoiceVolume({ userId }: { userId: string }) {
  const voice = useOptionalVoice();
  const { user } = useAuth();
  if (
    !voice?.activeChannelId ||
    user?.id === userId ||
    !voice.participantsByChannel[voice.activeChannelId]?.some((p) => p.user_id === userId)
  )
    return null;
  const volume = voice.volumes[userId] ?? 100;
  return (
    <section className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="flex justify-between text-xs">
        <span>Volume do usuário</span>
        <span>{volume}%</span>
      </div>
      <Slider
        aria-label="Volume do usuário"
        min={0}
        max={200}
        step={5}
        value={[volume]}
        onValueChange={([value]) => voice.setUserVolume(userId, value ?? 100)}
      />
    </section>
  );
}
