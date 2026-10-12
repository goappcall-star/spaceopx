export function voiceChannelAction(
  connectedId: string | null,
  selectedId: string | null,
  targetId: string,
  channels: { id: string; type: string }[],
) {
  if (connectedId === targetId) return { kind: "open" as const, selection: targetId };
  const viewingVoice = channels.some(
    (channel) => channel.id === selectedId && channel.type === "voice",
  );
  return {
    kind: "join" as const,
    selection: viewingVoice
      ? (channels.find((channel) => channel.type !== "voice")?.id ?? null)
      : selectedId,
  };
}
