import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  return exports;
}
const model = load("src/lib/call-dock.ts");
test("Call target selection falls back after disconnect and never turns an incoming ring into an active call", () => {
  assert.equal(model.resolveCallDockTarget(false, "incoming", "call"), null);
  assert.equal(model.resolveCallDockTarget(true, "ended", "call"), "voice");
  assert.equal(model.resolveCallDockTarget(false, "active", "voice"), "call");
  assert.equal(model.resolveCallDockTarget(false, "ended", "call"), null);
});
function fixture() {
  const events = [];
  let preferred = "call",
    browsing = "server-a";
  const self = { id: "me", display_name: "Me", avatar_url: null };
  const voice = {
    activeChannelId: null,
    activeServerId: null,
    connectionState: "disconnected",
    participantsByChannel: { room: [{ user_id: "me" }, { user_id: "other" }] },
    remoteMedia: {},
    screenOn: false,
    muted: false,
    deafened: false,
    cameraOn: false,
    cameraPermission: "granted",
    pttActive: true,
    toggleMute: () => {
      voice.muted = !voice.muted;
      events.push("voice-mute");
    },
    toggleDeafen: () => {
      voice.deafened = !voice.deafened;
      events.push("deafen");
    },
    toggleCamera: () => events.push("voice-camera"),
    toggleScreenShare: () => {
      voice.screenOn = false;
      events.push("voice-stop");
    },
    leave: () => {
      voice.activeChannelId = null;
      voice.connectionState = "disconnected";
      events.push("voice-leave");
    },
  };
  const call = {
    status: "idle",
    peer: { id: "other", display_name: "Other" },
    groupConversationId: null,
    participants: [],
    groupMedia: {},
    remote: null,
    screenOn: false,
    muted: false,
    cameraOn: false,
    toggleMute: () => {
      call.muted = !call.muted;
      events.push("call-mute");
    },
    toggleCamera: () => events.push("call-camera"),
    toggleScreenShare: () => events.push("call-stop"),
    hangUp: () => {
      call.status = "ended";
      events.push("call-end");
    },
  };
  const viewing = {
    voicePaused: false,
    callPaused: false,
    setVoicePaused: (value) => {
      viewing.voicePaused = value;
    },
    setCallPaused: (value) => {
      viewing.callPaused = value;
    },
  };
  const jsx = (type, props) => ({ type, props });
  const imports = {
    react: { useState: () => [preferred, (value) => (preferred = value)] },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "lucide-react": {
      Square: "square",
      LogOut: "logout",
      PhoneOff: "phone",
      SlidersHorizontal: "sliders",
    },
    sonner: { toast: { error: () => {} } },
    "@tanstack/react-router": { useNavigate: () => async () => events.push("navigate") },
    "@/hooks/use-auth": { useAuth: () => ({ profile: self }) },
    "@/hooks/use-voice": { useVoice: () => voice },
    "@/hooks/use-call": { useCall: () => call },
    "@/hooks/use-audio-settings": {
      useAudioSettings: () => ({ settings: { inputMode: "open" } }),
      keyLabel: (key) => key,
    },
    "@/hooks/use-servers": {
      useMyServers: () => ({
        data: [
          { id: "server-a", name: "Server A" },
          { id: "server-b", name: "Server B" },
        ],
      }),
      useServerChannels: (id) => {
        events.push("channels:" + id);
        return { data: [{ id: "room", name: "Actual room" }] };
      },
      useServerMembers: () => ({
        data: [
          { user_id: "me", profile: self },
          { user_id: "other", profile: { display_name: "Other" } },
        ],
      }),
    },
    "@/components/app/UserBar": { UserBar: "profile" },
    "@/components/voice/AudioOutputControl": {
      AudioInputControl: "input",
      AudioOutputControl: "output",
    },
    "@/components/voice/VoiceIcon": { VoiceIcon: "icon" },
    "@/components/voice/NoiseSuppressionToggle": { NoiseSuppressionToggle: "noise" },
    "@/components/ui/tooltip": {
      Tooltip: "tooltip",
      TooltipTrigger: "trigger",
      TooltipContent: "hint",
    },
    "@/components/ui/dropdown-menu": {
      DropdownMenu: "menu",
      DropdownMenuTrigger: "trigger",
      DropdownMenuContent: "items",
      DropdownMenuItem: "item",
      DropdownMenuLabel: "label",
    },
    "@/lib/call-dock": model,
    "@/services/voice": { supportsCamera: () => true, supportsScreenShare: () => true },
    "@/services/screen-share-panel": {
      openScreenSharePanel: (target) => events.push("screen-panel:" + target),
    },
    "@/services/social": { conversationsService: { openDirect: async () => "conversation" } },
    "./SessionCommunications": {
      useSessionServer: () => ({
        setVoiceReturn: (room) => events.push(room),
        setConversationReturn: (id) => events.push("conversation:" + id),
      }),
    },
    "./ScreenViewingProvider": { useScreenViewing: () => viewing },
    "./CallDockView": { CallDockView: "dock" },
  };
  const { SessionCallDock: component, IdleSessionProfile } = load(
    "src/components/call/SessionCallDock.tsx",
    imports,
  );
  return {
    voice,
    call,
    viewing,
    events,
    render: () => component()?.props ?? null,
    renderProfile: () => IdleSessionProfile(),
    browse: (next) => (browsing = next),
    currentPage: () => browsing,
  };
}
function nodes(tree) {
  if (!tree) return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function action(tree, label) {
  const result = nodes(tree.controls).find(
    (node) => node.props?.label === label || node.props?.["aria-label"] === label,
  );
  assert.ok(result, label);
  return result.props;
}
test("Idle and incoming calls retain profile audio without exposing session controls", () => {
  const f = fixture();
  assert.equal(f.render(), null);
  assert.equal(f.renderProfile().props.expanded, true);
  f.call.status = "incoming";
  assert.equal(f.render(), null);
  assert.ok(f.renderProfile());
});

test("Dock visibility follows session state, including connection without a channel and stale channel after disconnect", () => {
  const f = fixture();
  for (const state of ["connecting", "connected", "reconnecting"]) {
    f.voice.connectionState = state;
    assert.ok(f.render(), state);
    assert.equal(f.renderProfile(), null, state);
  }
  f.voice.activeChannelId = "stale-room";
  for (const state of ["disconnected", "error"]) {
    f.voice.connectionState = state;
    assert.equal(f.render(), null, state);
    assert.ok(f.renderProfile(), state);
  }
  for (const status of ["outgoing", "connecting", "active", "waiting", "reconnecting"]) {
    f.call.status = status;
    assert.ok(f.render(), status);
    assert.equal(f.renderProfile(), null, status);
  }
  for (const status of ["idle", "ended", "incoming"]) {
    f.call.status = status;
    assert.equal(f.render(), null, status);
    assert.ok(f.renderProfile(), status);
  }
});
test("Navigation cannot switch the dock away from the actual connected server; return uses that session", async () => {
  const f = fixture();
  Object.assign(f.voice, {
    activeChannelId: "room",
    activeServerId: "server-a",
    connectionState: "connected",
  });
  let dock = f.render();
  f.browse("server-b");
  dock = f.render();
  assert.equal(f.currentPage(), "server-b");
  assert.equal(dock.info.name, "Actual room");
  assert.equal(dock.info.context, "Server A");
  assert.equal(dock.info.participants.length, 2);
  assert.equal(dock.profile.props.hideAudio, true);
  await dock.info.onReturn();
  await Promise.resolve();
  assert.ok(f.events.some((event) => event.channelId === "room" && event.serverId === "server-a"));
  assert.ok(f.events.includes("channels:server-a"));
});
test("Microphone/camera and stop screen use current voice callbacks; stopping preserves the call", () => {
  const f = fixture();
  Object.assign(f.voice, {
    activeChannelId: "room",
    activeServerId: "server-a",
    connectionState: "connected",
    screenOn: true,
  });
  let dock = f.render();
  assert.equal(dock.info.transmitting, true);
  action(dock, "Silenciar microfone").onToggle();
  action(dock, "Ligar câmera").onClick();
  action(dock, "Parar transmissão").onClick();
  assert.equal(f.voice.activeChannelId, "room");
  assert.deepEqual(
    f.events.filter((e) => typeof e === "string" && !e.startsWith("channels:")),
    ["voice-mute", "voice-camera", "voice-stop"],
  );
  dock = f.render();
  assert.equal(dock.info.transmitting, false);
  assert.equal(
    nodes(dock.controls).some((n) => n.props?.label === "Parar transmissão"),
    false,
  );
});
test("Leaving remote screen playback preserves voice and provides a return action", () => {
  const f = fixture();
  Object.assign(f.voice, {
    activeChannelId: "room",
    activeServerId: "server-a",
    connectionState: "connected",
    remoteMedia: { other: { screen: {} } },
  });
  let dock = f.render();
  action(dock, "Sair da transmissão").onClick();
  assert.equal(f.voice.activeChannelId, "room");
  dock = f.render();
  assert.equal(dock.info.watching, false);
  assert.equal(dock.info.paused, true);
  action(dock, "Voltar à transmissão").onClick();
  assert.equal(f.render().info.watching, true);
});
test("Reconnect preserves the dock and disables capture; disconnect restores the normal profile", () => {
  const f = fixture();
  Object.assign(f.voice, {
    activeChannelId: "room",
    activeServerId: "server-a",
    connectionState: "reconnecting",
  });
  let dock = f.render();
  assert.equal(dock.info.state, "Reconectando…");
  assert.equal(action(dock, "Compartilhar tela").disabled, true);
  action(dock, "Desconectar da voz").onClick();
  dock = f.render();
  assert.equal(dock, null);
  assert.ok(f.renderProfile());
});
test("Private/group calls report confirmed participants and use their own mute/end callbacks", () => {
  const f = fixture();
  f.call.status = "active";
  let dock = f.render();
  assert.equal(dock.info.participants.length, 2);
  action(dock, "Silenciar microfone").onToggle();
  assert.equal(f.call.muted, true);
  assert.equal(f.voice.muted, false);
  f.call.groupConversationId = "group";
  f.call.participants = [
    { id: "me", display_name: "Me" },
    { id: "one", display_name: "One" },
    { id: "one", display_name: "One" },
  ];
  dock = f.render();
  assert.equal(dock.info.participants.length, 2);
  action(dock, "Encerrar chamada").onClick();
  assert.equal(f.render(), null);
  assert.ok(f.renderProfile());
});
test("The single dock can select either existing session without disconnecting the other", () => {
  const f = fixture();
  Object.assign(f.voice, {
    activeChannelId: "room",
    activeServerId: "server-a",
    connectionState: "connected",
  });
  f.call.status = "active";
  let dock = f.render();
  assert.equal(dock.info.context, "Chamada privada");
  const menuItem = nodes(dock.sessions).find(
    (n) => n.type === "item" && n.props.children === "Actual room",
  );
  menuItem.props.onSelect();
  dock = f.render();
  assert.equal(dock.info.context, "Server A");
  assert.equal(f.call.status, "active");
  assert.equal(f.voice.activeChannelId, "room");
});
