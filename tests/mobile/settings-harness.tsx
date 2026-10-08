import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { SettingsShell, type SettingsSection } from "../../src/components/settings/SettingsShell";
import "../../src/styles.css";
export function Page() {
  const location = useRouterState({ select: (state) => state.location });
  const active = (
    location.pathname.endsWith("voice") ? "voice" : location.search.section || "profile"
  ) as SettingsSection;
  return (
    <SettingsShell active={active}>
      <section className="glass-panel rounded-xl p-4">
        <h2>Conteúdo da configuração</h2>
        <p>Seção selecionada: {active}</p>
        <input aria-label="Campo de teste" className="mt-4 w-full rounded border p-2" />
      </section>
    </SettingsShell>
  );
}
const root = createRootRoute({ component: Outlet });
const routes = ["/tests/mobile/settings.html", "/settings/profile", "/settings/voice", "/app"].map(
  (path) => createRoute({ getParentRoute: () => root, path, component: Page }),
);
const router = createRouter({ routeTree: root.addChildren(routes) });
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
