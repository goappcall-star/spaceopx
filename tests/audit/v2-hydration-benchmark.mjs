import { readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { performance } from "node:perf_hooks";
import * as validation from "../../src/lib/input-validation.mjs";
const scratch = process.argv[2];
if (!scratch) throw Error("Provide local baseline directory");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function load(file, imports) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(await readFile(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require(name) {
        if (name === "@/lib/input-validation.mjs") return validation;
        if (!(name in imports)) throw Error(name);
        return imports[name];
      },
    },
  );
  return exports;
}
const report = {
  scope:
    "Actual service hydration with controlled 10 ms transport per independent request; no production/network latency claim",
  samples: [],
};
for (const stage of ["before", "after"])
  for (const kind of ["server", "private"]) {
    const authorField = kind === "server" ? "author_id" : "sender_id",
      table = kind === "server" ? "messages" : "direct_messages";
    let requests = 0;
    const supabase = {
      from(name) {
        return {
          select() {
            return {
              async in() {
                requests++;
                await delay(10);
                return {
                  data:
                    name === table
                      ? [{ id: "reply", [authorField]: "alice", content: "Earlier" }]
                      : [{ message_id: "message", user_id: "me", emoji: "👍" }],
                };
              },
            };
          },
        };
      },
    };
    const imports = {
      "@/integrations/supabase/client": { supabase },
      "@/services/profiles": {
        profilesService: {
          async listByIds(ids) {
            if (!ids.length) return [];
            requests++;
            await delay(10);
            return [{ id: "alice", display_name: "Alice" }];
          },
        },
      },
      "@/services/uploads": { validateFile() {} },
    };
    imports["@/services/messages"] = await load("src/services/messages.ts", imports);
    const file = kind === "server" ? "messages" : "social";
    const module = await load(
      stage === "before" ? `${scratch}/v2-${file}-before.ts` : `src/services/${file}.ts`,
      imports,
    );
    const service = kind === "server" ? module.messagesService : module.directMessagesService;
    const times = [];
    for (let i = 0; i < 32; i++) {
      const t = performance.now();
      const [result] = await service.hydrate(
        [{ id: "message", [authorField]: "alice", reply_to_id: "reply", content: "Hi" }],
        "me",
      );
      if (!result.reactions[0].mine || result.replyTo.author.id !== "alice")
        throw Error("Hydration changed semantics");
      if (i >= 2) times.push(performance.now() - t);
    }
    report.samples.push({ stage, kind, samplesMs: times, requests });
  }
await writeFile(process.argv[3], JSON.stringify(report, null, 2));
