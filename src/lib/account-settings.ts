export interface AccountIdentitySource {
  email?: string;
  email_confirmed_at?: string;
  created_at?: string;
  identities?: { provider: string }[];
}
export function accountLoginMethods(user: AccountIdentitySource | null) {
  const providers = new Set(user?.identities?.map((identity) => identity.provider) ?? []);
  return [
    {
      id: "email",
      label: "E-mail",
      connected: providers.has("email"),
      description: providers.has("email")
        ? "Seu e-mail está vinculado à conta."
        : "Nenhuma identidade de e-mail vinculada.",
    },
    {
      id: "google",
      label: "Google",
      connected: providers.has("google"),
      description: providers.has("google")
        ? "Sua conta Google está vinculada ao LobbyX."
        : "Login suportado. Vincular uma conta Google por esta página ainda não está disponível.",
    },
  ];
}
export function accountDate(value: string | undefined) {
  if (!value) return "Não disponível";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Não disponível"
    : new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(
        date,
      );
}
