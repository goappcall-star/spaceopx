import { supabase } from "@/integrations/supabase/client";
import type { Attachment } from "@/types";

export const ATTACHMENT_BUCKET = "attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/json",
];

export function validateFile(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_BYTES) return "Arquivo maior que 10 MB.";
  if (!ALLOWED_MIME.includes(file.type)) return "Tipo de arquivo não permitido.";
  return null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

export const uploadsService = {
  /** Path is `${serverId}/${channelId}/${uuid}-${name}` — storage RLS reads serverId. */
  async upload(serverId: string, channelId: string, file: File): Promise<Attachment> {
    const invalid = validateFile(file);
    if (invalid) throw new Error(invalid);

    const path = `${serverId}/${channelId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    return {
      path,
      name: file.name,
      size: file.size,
      mime: file.type,
      kind: file.type.startsWith("image/") ? "image" : "file",
    };
  },

  /** Bucket is private: every read goes through a short-lived signed URL. */
  async signedUrl(path: string, expiresIn = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error) return null;
    return data.signedUrl;
  },
};
