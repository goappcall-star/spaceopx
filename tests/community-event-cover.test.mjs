import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compile = (file, module) =>
  ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const lib = await import(
  "data:text/javascript;base64," +
    Buffer.from(compile("../src/lib/event-cover.ts", ts.ModuleKind.ESNext)).toString("base64")
);
const png = () =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "capa.png", { type: "image/png" });

test("event cover accepts PNG/JPEG and rejects unsupported, empty and oversized files", async () => {
  assert.equal(lib.validateEventCover(png()), null);
  assert.equal(
    lib.validateEventCover({ type: "image/jpeg", size: lib.MAX_EVENT_COVER_BYTES }),
    null,
  );
  for (const file of [
    { type: "image/svg+xml", size: 20 },
    { type: "image/gif", size: 20 },
    { type: "image/png", size: 0 },
    { type: "image/png", size: lib.MAX_EVENT_COVER_BYTES + 1 },
  ])
    assert.ok(lib.validateEventCover(file));
  await lib.verifyEventCover(png());
  await lib.verifyEventCover(
    new File([new Uint8Array([255, 216, 255, 224])], "foto.jpeg", { type: "image/jpeg" }),
  );
  await assert.rejects(
    lib.verifyEventCover(new File(["not a png"], "fake.png", { type: "image/png" })),
    /conteúdo/,
  );
});

test("event image uploader verifies bytes and reuses only the user's private asset uploader", async () => {
  const calls = [];
  const module = { exports: {} };
  vm.runInNewContext(compile("../src/services/event-cover-images.ts", ts.ModuleKind.CommonJS), {
    module,
    exports: module.exports,
    require: (name) => {
      if (name.endsWith("event-cover")) return lib;
      if (name === "./profile-images")
        return {
          profileImagesService: {
            upload: async (...args) => {
              calls.push(args);
              return "https://assets.example.test/signed-cover";
            },
          },
        };
      throw Error("Unexpected dependency: " + name);
    },
  });
  const file = png();
  const url = await module.exports.eventCoverImagesService.upload("current-user", file);
  assert.equal(url, "https://assets.example.test/signed-cover");
  assert.deepEqual(calls[0], ["banners", "current-user", file]);
  await assert.rejects(
    module.exports.eventCoverImagesService.upload(
      "current-user",
      new File(["invalid"], "bad.jpg", { type: "image/jpeg" }),
    ),
  );
  assert.equal(calls.length, 1);
});
