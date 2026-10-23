import type { ReactNode } from "react";
import {
  UserRound,
  KeyRound,
  Monitor,
  Mail,
  CalendarDays,
  Pencil,
  LogOut,
  TriangleAlert,
  CirclePause,
  Trash2,
  ShieldCheck,
  LockKeyhole,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { AvatarFrameId } from "@/lib/avatar-frames";
import type { accountLoginMethods } from "@/lib/account-settings";
import "./account-settings.css";

export interface AccountSettingsViewProps {
  passwordSection?: ReactNode;
  name: string;
  username: string;
  avatar: string | undefined;
  frame: AvatarFrameId | undefined;
  email: string | undefined;
  verified: boolean | null;
  created: string;
  methods: ReturnType<typeof accountLoginMethods>;
  platform: string;
  online: boolean;
  expires: string | null;
  busy: boolean;
  onProfile: () => void;
  onPrivacy: () => void;
  onSignOut: () => void;
}
export function AccountSettingsView(props: AccountSettingsViewProps) {
  return (
    <div className="account-page-content">
      <div className="account-page-grid">
        <div className="account-card-column">
          <section className="account-section">
            <header>
              <span className="account-heading-icon">
                <UserRound size={23} />
              </span>
              <div>
                <h2>Informações da conta</h2>
                <p>Seus dados de identificação no LobbyX.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="account-edit-profile"
                onClick={props.onProfile}
              >
                <Pencil size={16} />
                Editar perfil
              </Button>
            </header>
            <div className="account-identity">
              <Avatar frame={props.frame} className="account-avatar">
                <AvatarImage src={props.avatar} alt="Avatar atual" />
                <AvatarFallback>{props.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="account-identity-details">
                <h3>{props.name || "Sua conta"}</h3>
                <p className="account-username">@{props.username}</p>
                <dl>
                  <div>
                    <Mail size={19} />
                    <div>
                      <dt>E-mail</dt>
                      <dd>{props.email || "Não informado"}</dd>
                      {props.verified !== null && (
                        <span
                          className={props.verified ? "account-verified" : "account-unverified"}
                        >
                          {props.verified && <CheckCircle2 size={12} />}
                          {props.verified ? "E-mail verificado" : "E-mail não verificado"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <CalendarDays size={19} />
                    <div>
                      <dt>Membro desde</dt>
                      <dd>{props.created}</dd>
                    </div>
                  </div>
                </dl>
              </div>
            </div>
          </section>
          <section className="account-section">
            <header>
              <span className="account-heading-icon">
                <KeyRound size={23} />
              </span>
              <div>
                <h2>Métodos de login</h2>
                <p>Os métodos vinculados à sua conta.</p>
              </div>
            </header>
            <div className="account-login-list">
              {props.methods.map((method) => (
                <div className="account-login-row" key={method.id}>
                  <span className="account-method-icon">
                    {method.id === "google" ? (
                      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.51l3.35-2.59Z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.35 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
                        />
                      </svg>
                    ) : (
                      <Mail size={23} />
                    )}
                  </span>
                  <div>
                    <h3>{method.label}</h3>
                    <p>{method.description}</p>
                  </div>
                  <span
                    className={
                      method.connected ? "account-method-state connected" : "account-method-state"
                    }
                  >
                    {method.connected && <i />}
                    {method.connected ? "Conectado" : "Não vinculado"}
                  </span>
                </div>
              ))}
            </div>
            <p className="account-section-note">
              Conectar ou desconectar provedores por esta página ainda não está disponível.
            </p>
          </section>
          {props.passwordSection}
          <section className="account-section">
            <header>
              <span className="account-heading-icon">
                <Monitor size={23} />
              </span>
              <div>
                <h2>Sessão atual</h2>
                <p>Este é o aplicativo em que você está conectado.</p>
              </div>
            </header>
            <div className="account-session-row">
              <div className="account-session-device">
                <Monitor size={24} />
                <div>
                  <h3>{props.platform}</h3>
                  <p className={props.online ? "account-network-online" : ""}>
                    <i />
                    {props.online ? "Rede disponível" : "Sem conexão de rede"}
                  </p>
                  {props.expires && <small>Credencial da sessão válida até {props.expires}</small>}
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                disabled={props.busy}
                onClick={props.onSignOut}
              >
                <LogOut size={17} />
                {props.busy ? "Saindo…" : "Sair da conta"}
              </Button>
            </div>
          </section>
          <section className="account-section account-management">
            <header>
              <span className="account-heading-icon account-danger-icon">
                <TriangleAlert size={22} />
              </span>
              <div>
                <h2>Gerenciamento da conta</h2>
                <p>Opções avançadas para controlar sua conta.</p>
              </div>
            </header>
            <div className="account-management-actions">
              <Button type="button" variant="outline" disabled>
                <CirclePause size={16} />
                Desativar conta
              </Button>
              <Button type="button" variant="outline" disabled>
                <Trash2 size={16} />
                Excluir conta
              </Button>
            </div>
            <p className="account-section-note">
              Ainda indisponíveis: estes fluxos dependem de implementação segura no servidor. Nenhum
              dado será alterado.
            </p>
          </section>
        </div>
        <aside className="account-brand-panel" aria-label="LobbyX e atalhos">
          <div className="account-brand-art" aria-hidden="true">
            <div className="account-brand-wordmark">
              Lobby<span>X</span>
            </div>
            <p>
              Conectando pessoas
              <br />
              através do que
              <br />
              elas jogam.
            </p>
            <span className="account-brand-x">X</span>
          </div>
          <div className="account-shortcuts">
            <button type="button" onClick={props.onProfile}>
              <span>
                <UserRound size={22} />
              </span>
              <div>
                <strong>Personalize seu perfil</strong>
                <p>Deixe seu perfil com a sua cara.</p>
              </div>
              <ChevronRight size={17} />
            </button>
            <div className="account-security-pending">
              <span>
                <ShieldCheck size={22} />
              </span>
              <div>
                <strong>Mantenha sua conta segura</strong>
                <p>Gerencie sua senha em Minha conta.</p>
              </div>
            </div>
            <button type="button" onClick={props.onPrivacy}>
              <span>
                <LockKeyhole size={22} />
              </span>
              <div>
                <strong>Controle sua privacidade</strong>
                <p>Gerencie como você é visto.</p>
              </div>
              <ChevronRight size={17} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
