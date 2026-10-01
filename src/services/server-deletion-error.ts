export function serverDeletionErrorMessage(error: unknown): string {
  const details =
    error && typeof error === "object" ? (error as { code?: string; message?: string }) : {};
  if (details.code === "23503") {
    return "O banco bloqueou a exclusão porque existem registros vinculados ao servidor. Entre em contato com o suporte.";
  }
  if (details.code === "42501" || details.code === "PGRST116") {
    return "O servidor não está disponível para exclusão. Atualize a página e confirme que você é o proprietário.";
  }
  if (details.code === "PGRST301" || details.code === "PGRST303") {
    return "Sua sessão expirou. Entre novamente e tente excluir o servidor.";
  }
  return "Não foi possível excluir o servidor. Tente novamente. Se o problema continuar, entre em contato com o suporte.";
}
