export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export function validateImage(file: File): string | null {
  if (file.size < 1) return "A imagem está vazia.";
  if (!ALLOWED_IMAGE_MIME.includes(file.type)) return "Envie uma imagem PNG, JPG, WEBP ou GIF.";
  if (file.size > MAX_IMAGE_BYTES) return "Imagem maior que 4 MB.";
  return null;
}
