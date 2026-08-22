import { createFileRoute, redirect } from "@tanstack/react-router";

// LobbyX has a single profile. /settings is kept as an alias to the one profile page.
export const Route = createFileRoute("/_authenticated/settings")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/profile" });
  },
  component: () => null,
});
