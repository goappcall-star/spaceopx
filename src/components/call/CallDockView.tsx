import type { ReactNode } from "react";
import { Users, ChevronDown, AudioLines } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DockParticipant } from "@/lib/call-dock";
import "./call-dock.css";

export interface CallDockInfo {
  name: string;
  context: string;
  state: string;
  ready: boolean;
  transmitting: boolean;
  watching: boolean;
  paused: boolean;
  participants: DockParticipant[];
  onReturn: () => void;
}
/** Presentation only: receives the existing session's data and controls. */
export function CallDockView({
  profile,
  info,
  controls,
  sessions,
}: {
  profile: ReactNode;
  info: CallDockInfo | null;
  controls?: ReactNode;
  sessions?: ReactNode;
}) {
  return (
    <footer
      className="session-call-dock"
      data-call-active={!!info}
      data-watching={!!info?.watching}
      data-transmitting={!!info?.transmitting}
      aria-label={info ? "Barra fixa da chamada" : "Barra do perfil"}
    >
      <div className="session-call-profile">{profile}</div>
      {info ? (
        <>
          <div className="session-call-info">
            <div className="session-call-summary">
              <span className="session-call-symbol" data-ready={info.ready}>
                <AudioLines className="h-7 w-7" />
              </span>
              <div className="session-call-copy">
                <button
                  type="button"
                  className="session-call-return"
                  onClick={info.onReturn}
                  title="Voltar à chamada"
                >
                  <strong title={info.name}>{info.name}</strong>
                </button>
                <p title={info.context}>{info.context}</p>
                <span role="status" className="session-call-state" data-ready={info.ready}>
                  <i aria-hidden="true" />
                  {info.state}
                  {info.transmitting
                    ? " · Transmitindo"
                    : info.watching
                      ? " · Assistindo"
                      : info.paused
                        ? " · Visualização interrompida"
                        : ""}
                </span>
              </div>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="session-call-people"
                  aria-label={`Ver participantes (${info.participants.length})`}
                >
                  <span className="session-call-avatars" aria-hidden>
                    {info.participants.slice(0, 3).map((person) => (
                      <Avatar key={person.id} frame={person.avatarFrame} className="h-9 w-9">
                        <AvatarImage src={person.avatarUrl ?? undefined} />
                        <AvatarFallback>{person.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ))}
                    {info.participants.length > 3 && (
                      <span className="session-call-more">+{info.participants.length - 3}</span>
                    )}
                  </span>
                  <span className="session-call-count">
                    <Users className="h-4 w-4" />
                    {info.participants.length}
                    <ChevronDown className="h-3 w-3" />
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="max-h-80 overflow-y-auto w-64">
                <h3 className="mb-3 text-sm font-semibold">
                  Participantes · {info.participants.length}
                </h3>
                {info.participants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aguardando conexão.</p>
                ) : (
                  <ul className="space-y-3">
                    {info.participants.map((person) => (
                      <li key={person.id} className="flex items-center gap-3 text-sm">
                        <Avatar frame={person.avatarFrame} className="h-8 w-8">
                          <AvatarImage src={person.avatarUrl ?? undefined} />
                          <AvatarFallback>{person.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{person.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </PopoverContent>
            </Popover>
            {sessions}
          </div>
          <div className="session-call-controls">{controls}</div>
        </>
      ) : null}
    </footer>
  );
}
