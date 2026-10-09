// Private topics cannot communicate with the public topics used by older desktops.
// Enable only after hosted interoperability tests and a coordinated client rollout.
export function realtimeChannelOptions(options, enabled) {
  return { ...options, config: { ...options?.config, private: enabled === "true" } };
}
