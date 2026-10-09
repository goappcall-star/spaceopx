export function boundedText(value, label, max, min = 0) {
  if (typeof value !== "string") throw new Error(`${label}: valor inválido.`);
  const clean = value.trim();
  if (
    [...clean].length < min ||
    [...clean].length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(clean)
  )
    throw new Error(`${label}: use ${min} a ${max} caracteres válidos.`);
  return clean;
}

export function safeImageUrl(value) {
  if (value == null || value === "") return null;
  const clean = boundedText(value, "URL da imagem", 8192, 1);
  let url;
  try {
    url = new URL(clean);
  } catch {
    throw new Error("URL da imagem inválida.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("A imagem precisa usar uma URL HTTPS sem credenciais.");
  return clean;
}

export function validEmail(value) {
  const email = boundedText(value, "E-mail", 254, 3);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  return email;
}

export function validPassword(value, minimum = 8) {
  // Preserve intentional whitespace in passwords.
  if (typeof value !== "string" || value.length < minimum || value.length > 128)
    throw new Error(`A senha precisa ter entre ${minimum} e 128 caracteres.`);
  return value;
}

export function validUsername(value) {
  const name = boundedText(value, "Username", 32, 3).toLowerCase();
  if (!/^[a-z0-9_.]{3,32}$/.test(name)) throw new Error("Username inválido.");
  return name;
}

const MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/json",
]);
export function validateMessage(content, attachments = [], mentions = []) {
  const text = boundedText(content, "Mensagem", 4000);
  if (!Array.isArray(attachments) || attachments.length > 10)
    throw new Error("Use no máximo 10 anexos.");
  for (const file of attachments) {
    if (
      !file ||
      typeof file !== "object" ||
      !MIME.has(file.mime) ||
      !["image", "file"].includes(file.kind) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 1 ||
      file.size > 10 * 1024 * 1024
    )
      throw new Error("Anexo inválido.");
    boundedText(file.name, "Nome do anexo", 255, 1);
    const path = boundedText(file.path, "Caminho do anexo", 512, 1);
    if (path.includes("..") || /[\\:\u0000]/.test(path) || path.startsWith("/"))
      throw new Error("Caminho do anexo inválido.");
  }
  if (!text && attachments.length === 0)
    throw new Error("Escreva uma mensagem ou adicione um anexo.");
  if (
    !Array.isArray(mentions) ||
    mentions.length > 50 ||
    mentions.some((id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id))
  )
    throw new Error("Menções inválidas.");
  return text;
}

export function validReaction(value) {
  return boundedText(value, "Reação", 32, 1);
}
