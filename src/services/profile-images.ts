import { supabase } from "@/integrations/supabase/client";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_IMAGE_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

export type ImageBucket = "avatars" | "banners";

export function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_MIME.includes(file.type)) return "Envie uma imagem PNG, JPG, WEBP ou GIF.";
  if (file.size > MAX_IMAGE_BYTES) return "Imagem maior que 4 MB.";
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

export const profileImagesService = {
  /**
   * Buckets are private: the path is always `${userId}/...` (storage RLS checks
   * ownership) and the stored URL is a long-lived signed URL.
   */
  async upload(bucket: ImageBucket, userId: string, file: File): Promise<string> {
    const invalid = validateImage(file);
    if (invalid) throw new Error(invalid);

    const path = `${userId}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    const { data, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signError || !data) throw signError ?? new Error("Falha ao gerar URL da imagem.");
    return data.signedUrl;
  },
};
