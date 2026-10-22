export const MAX_EVENT_COVER_BYTES = 4 * 1024 * 1024;

export function validateEventCover(file: Pick<File, "size" | "type">): string | null {
  if (file.size < 1) return "A imagem está vazia.";
  if (!["image/png", "image/jpeg"].includes(file.type))
    return "Escolha uma imagem PNG, JPG ou JPEG.";
  if (file.size > MAX_EVENT_COVER_BYTES) return "Escolha uma imagem de até 4 MB.";
  return null;
}

export async function verifyEventCover(file: File): Promise<void> {
  const invalid = validateEventCover(file);
  if (invalid) throw Error(invalid);
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  const valid =
    file.type === "image/png"
      ? png.every((n, i) => bytes[i] === n)
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw Error("O conteúdo do arquivo não corresponde a uma imagem PNG ou JPEG.");
}
