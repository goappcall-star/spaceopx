import test from "node:test";
import assert from "node:assert/strict";
import { voiceChannelAction } from "../src/lib/voice-channel-navigation.ts";
const channels = [
  { id: "chat", type: "text" },
  { id: "voice-a", type: "voice" },
  { id: "voice-b", type: "voice" },
];
test("First voice entry joins without replacing the text conversation", () => {
  assert.deepEqual(voiceChannelAction(null, "chat", "voice-a", channels), {
    kind: "join",
    selection: "chat",
  });
});
test("Clicking the already connected channel opens its room without reconnecting", () => {
  assert.deepEqual(voiceChannelAction("voice-a", "chat", "voice-a", channels), {
    kind: "open",
    selection: "voice-a",
  });
});
test("Changing voice channel while viewing a room returns to text instead of opening the new room", () => {
  assert.deepEqual(voiceChannelAction("voice-a", "voice-a", "voice-b", channels), {
    kind: "join",
    selection: "chat",
  });
});
test("A server with only voice channels stays on its blank view on first entry", () => {
  assert.deepEqual(voiceChannelAction(null, null, "voice-a", channels.slice(1)), {
    kind: "join",
    selection: null,
  });
  assert.deepEqual(voiceChannelAction("voice-a", "voice-a", "voice-b", channels.slice(1)), {
    kind: "join",
    selection: null,
  });
});
