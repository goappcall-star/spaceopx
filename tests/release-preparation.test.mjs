import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
test("desktop distribution defaults to draft and unattended CI cannot promote it", () => {
  const workflow = require("js-yaml").load(
    fs.readFileSync(".github/workflows/desktop-release.yml", "utf8"),
  );
  assert.equal(workflow.on.push, undefined);
  assert.equal(workflow.on.workflow_dispatch.inputs.web_validated.default, false);
  assert.match(workflow.jobs.windows.if, /inputs.web_validated == true/);
  assert.ok(!JSON.stringify(workflow).includes("--publish-approved"));
  const source = fs.readFileSync("scripts/publish-desktop-release.mjs", "utf8");
  assert.match(source, /if \(publishApproved\)\s+run\(\["release", "edit"/);
  assert.match(source, /"--draft"/);
});
