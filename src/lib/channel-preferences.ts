import type { ServerPreferences } from "@/hooks/use-server-preferences";
import type { Channel } from "@/types";
export function isCategoryMuted(preferences: ServerPreferences, id: string, now = Date.now()) {
  const until = preferences.mutedCategories?.[id];
  return until === -1 || (until ?? 0) > now;
}
export function isChannelMuted(preferences: ServerPreferences, channel: Channel, now = Date.now()) {
  return (
    preferences.mutedChannels.includes(channel.id) ||
    !!(channel.category_id && isCategoryMuted(preferences, channel.category_id, now))
  );
}
export function shouldNotifyChannel(
  preferences: ServerPreferences,
  channel: Channel,
  userId: string,
  mentions: string[] = [],
  now = Date.now(),
) {
  if (
    preferences.mutedUntil === -1 ||
    (preferences.mutedUntil ?? 0) > now ||
    isChannelMuted(preferences, channel, now)
  )
    return false;
  const mode =
    preferences.channelNotifications?.[channel.id] ??
    (channel.category_id ? preferences.categoryNotifications?.[channel.category_id] : undefined) ??
    preferences.notifications;
  return mode === "all" || (mode === "mentions" && mentions.includes(userId));
}
