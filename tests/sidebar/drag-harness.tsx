import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useSidebarDrag } from "../../src/hooks/use-sidebar-drag";
import * as fixture from "./drag-service";
import "../../src/styles.css";
function Harness() {
  const [manager, setManager] = useState(true),
    [joins, setJoins] = useState(0);
  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "fixture"],
    queryFn: fixture.categoriesService.list,
  });
  const { data: channels = [] } = useQuery({
    queryKey: ["channels", "fixture"],
    queryFn: async () => [...fixture.channels],
  });
  const drag = useSidebarDrag("fixture", manager, channels, categories, () => {});
  return (
    <main className="bg-background text-foreground min-h-screen p-8">
      <h1>Arraste real — sem acesso ao banco</h1>
      <label>
        <input type="checkbox" checked={manager} onChange={(e) => setManager(e.target.checked)} />{" "}
        Permissão de gerenciar canais
      </label>
      <aside className="bg-surface mt-4 w-64 p-3">
        {categories.map((category) => (
          <section
            key={category.id}
            {...drag.zone(category.id)}
            className={
              "mb-3 rounded border p-2 " +
              (drag.target?.id === category.id ? "border-primary bg-primary/15" : "border-border")
            }
          >
            <div
              data-category-header
              {...drag.draggable("category", category.id)}
              className="cursor-grab py-2"
            >
              {category.name}
            </div>
            {channels
              .filter((channel) => channel.category_id === category.id)
              .map((channel) => (
                <button
                  key={channel.id}
                  {...drag.draggable("channel", channel.id)}
                  onClick={() => {
                    if (!drag.suppressClick()) setJoins((n) => n + 1);
                  }}
                  className="w-full rounded bg-secondary p-2"
                >
                  🔊 {channel.name}
                </button>
              ))}
          </section>
        ))}
        <section {...drag.zone(null)} className="border-border rounded border p-3">
          SEM CATEGORIA
          {channels
            .filter((channel) => !channel.category_id)
            .map((channel) => (
              <button
                key={channel.id}
                {...drag.draggable("channel", channel.id)}
                onClick={() => {
                  if (!drag.suppressClick()) setJoins((n) => n + 1);
                }}
                className="block"
              >
                {channel.name}
              </button>
            ))}
        </section>
      </aside>
      <p role="status">{drag.announcement}</p>
      <p>Entradas na chamada: {joins}</p>
      <pre>
        {JSON.stringify(
          {
            order: categories.map((c) => c.id),
            category: channels[0]?.category_id,
            saving: drag.saving,
          },
          null,
          2,
        )}
      </pre>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <Harness />
  </QueryClientProvider>,
);
