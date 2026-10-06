import { createContext, useContext } from "react";
export const testState = { created: "", watched: "", allowed: true };
export function useAuth() {
  return { user: { id: "me" } };
}
export const VoiceFixtureContext = createContext({
  participantsByChannel: { voice: [{ user_id: "peer", screen: true }] },
  activeChannelId: null as string | null,
  activeServerId: null as string | null,
  setVideoHidden: (_id: string, _hidden: boolean) => {},
  join: async (id: string, server: string, listen: boolean) => {
    testState.watched = JSON.stringify({ id, server, listen });
  },
});
export const useOptionalVoice = () => useContext(VoiceFixtureContext);
export const useNavigate = () => async () => {};
export const supabase = {
  rpc: async () => ({ data: testState.allowed, error: null }),
  from(table: string) {
    let inserted: unknown;
    const builder = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      order() {
        return this;
      },
      insert(row: unknown) {
        inserted = row;
        testState.created = JSON.stringify(row);
        return this;
      },
      single: async () => ({
        data: inserted
          ? { id: "new", ...(inserted as object) }
          : { id: "voice", server_id: "server", name: "Jogos" },
        error: null,
      }),
      then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
        return Promise.resolve(
          resolve({ data: table === "server_categories" ? [] : [], error: null }),
        );
      },
    };
    return builder;
  },
};
