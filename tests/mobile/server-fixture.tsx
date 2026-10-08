// Test-only module supplies both the permission hook and offline section fixtures.
// eslint-disable-next-line react-refresh/only-export-components
export function useServerAbilities() {
  return { can: () => true, isOwner: false };
}
export function SettingsProfile() {
  return <p>Perfil do servidor disponível</p>;
}
export function SettingsAccess() {
  return <p>Acesso disponível</p>;
}
export function SettingsMembers() {
  return <p>Membros disponíveis</p>;
}
export function SettingsRoles() {
  return <p>Cargos disponíveis</p>;
}
export function SettingsInvites() {
  return <p>Convites disponíveis</p>;
}
export function SettingsBans() {
  return <p>Banimentos disponíveis</p>;
}
export function SettingsAudit() {
  return <p>Auditoria disponível</p>;
}
export function DeleteServerButton() {
  return null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return {
    profile: {
      display_name: "Perfil de teste",
      username: "teste",
      avatar_url: null,
      avatar_frame: "default",
    },
  };
}
