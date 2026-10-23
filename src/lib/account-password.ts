import { validPassword } from "@/lib/input-validation.mjs";
export interface PasswordChange {
  current: string;
  next: string;
  confirm: string;
}
export function validatePasswordChange(value: PasswordChange) {
  validPassword(value.current, 1);
  validPassword(value.next);
  if (value.next !== value.confirm) throw new Error("As novas senhas não coincidem.");
  if (value.current === value.next) throw new Error("A nova senha deve ser diferente da atual.");
}
export function passwordChangeError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "preview_only") return "Prévia local: nenhuma senha real foi alterada.";
  if (["invalid_credentials", "current_password_mismatch"].includes(code ?? ""))
    return "Senha atual incorreta.";
  if (["weak_password", "same_password"].includes(code ?? ""))
    return "Use uma senha mais forte e diferente da atual, com pelo menos 8 caracteres.";
  if (["over_request_rate_limit", "over_email_send_rate_limit"].includes(code ?? ""))
    return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (
    ["reauthentication_needed", "reauthentication_not_valid", "insufficient_aal"].includes(
      code ?? "",
    )
  )
    return "Confirme sua identidade entrando novamente na conta antes de alterar a senha.";
  return "Não foi possível alterar a senha. Confira sua conexão e tente novamente.";
}
