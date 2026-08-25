import { supabase } from "@/integrations/supabase/client";

export const MAX_SERVER_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB (GIF banners)
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const SIGNED_URL_TTL = 60 * 60 * 24 * 365;

export type ServerImageKind = "icon" | "banner";

export function validateServerImage(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return "Envie uma imagem PNG, JPG, WEBP ou GIF.";
  if (file.size > MAX_SERVER_IMAGE_BYTES) return "Imagem maior que 8 MB.";
  return null;
}

function extensionFor(mime: string) {
  return mime === "image/png"
    ? "png"
    : mime === "image/webp"
      ? "webp"
      : mime === "image/gif"
        ? "gif"
        : "jpg";
}

export const serverImagesService = {
  /**
   * Bucket `server-assets` is private and its storage RLS keys off the first
   * path segment (`${serverId}/...`), so only members with `manage_server`
   * can write. The stored value is a long-lived signed URL.
   */
  async upload(serverId: string, kind: ServerImageKind, file: File): Promise<string> {
    const invalid = validateServerImage(file);
    if (invalid) throw new Error(invalid);

    const path = `${serverId}/${kind}-${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const { error } = await supabase.storage
      .from("server-assets")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    const { data, error: signError } = await supabase.storage
      .from("server-assets")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signError || !data) throw signError ?? new Error("Falha ao gerar URL da imagem.");
    return data.signedUrl;
  },
};
