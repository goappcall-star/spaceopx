import type { UserStatus } from "@/types";

export const PROFILE_STATUSES: UserStatus[] = ["online", "idle", "dnd", "offline"];

export function isUserStatus(value: unknown): value is UserStatus {
  return PROFILE_STATUSES.some((status) => status === value);
}

export function validateProfileStatus(value: unknown): asserts value is UserStatus {
  if (!isUserStatus(value)) {
    throw new Error("Selecione um status válido antes de salvar o perfil.");
  }
}

export function profileSaveErrorMessage(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  if (message.includes("username_is_permanent"))
    return "Seu username é permanente e não pode ser alterado.";
  if (/profiles_status_check|Selecione um status válido/.test(message))
    return "Selecione um status válido antes de salvar o perfil.";
  if (/avatar_frame|profile_frame|nameplate|schema cache/.test(message))
    return "As molduras ainda precisam ser ativadas no servidor. Tente novamente após a atualização.";
  return "Não foi possível salvar o perfil.";
}
