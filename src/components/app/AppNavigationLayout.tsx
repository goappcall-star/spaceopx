import type { ReactNode } from "react";
import "./app-navigation-layout.css";

/** One footer across the existing rail and channel/social column. */
export function AppNavigationLayout({
  children,
  profile,
}: {
  children: ReactNode;
  profile?: ReactNode;
}) {
  return (
    <div className="app-navigation-layout">
      <div className="app-navigation-columns">{children}</div>
      {profile && <div className="app-navigation-profile">{profile}</div>}
    </div>
  );
}
