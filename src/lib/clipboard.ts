interface Writer {
  writeText: (text: string) => Promise<unknown>;
}
export async function copyText(
  text: string,
  adapters: { desktop?: Writer | undefined; web?: Writer | undefined } = {
    desktop: typeof window === "undefined" ? undefined : window.lobbyxDesktop?.clipboard,
    web: typeof navigator === "undefined" ? undefined : navigator.clipboard,
  },
): Promise<void> {
  const writer = adapters.desktop ?? adapters.web;
  if (!writer) throw Error("Área de transferência indisponível.");
  await writer.writeText(text);
}
