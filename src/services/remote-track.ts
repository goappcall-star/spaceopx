/** Reserved video receivers start muted, before anyone enables their camera or screen. */
export function shouldExposeRemoteTrack(
  kind: "mic" | "camera" | "screen",
  track: Pick<MediaStreamTrack, "muted" | "readyState">,
) {
  return track.readyState === "live" && (kind === "mic" || !track.muted);
}
