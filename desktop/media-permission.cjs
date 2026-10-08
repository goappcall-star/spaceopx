// Electron 44.4.5 reports getDisplayMedia as `media` with mediaTypes: [].
// Only call this after validating the requesting WebContents and main frame.
// Granting this preliminary request still requires the display-media handler
// to validate the frame and obtain an explicit selection from the screen picker.
exports.classifyMediaRequest = (permission, details) => {
  if (permission === "display-capture") return "display";
  if (permission !== "media" || !Array.isArray(details?.mediaTypes)) return "deny";
  if (details.mediaTypes.length === 0) return "display";
  return details.mediaTypes.every((type) => type === "audio" || type === "video")
    ? "device"
    : "deny";
};
