import test from "node:test";
import assert from "node:assert/strict";
import { createCallGracePeriod } from "../src/services/call-grace-period.ts";

test("Ends exactly at 30 seconds, not before", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  let exits = 0;
  const grace = createCallGracePeriod(() => exits++);
  assert.equal(grace.start(), 31000);
  context.mock.timers.tick(29999);
  assert.equal(exits, 0);
  context.mock.timers.tick(1);
  assert.equal(exits, 1);
  context.mock.timers.tick(30000);
  assert.equal(exits, 1);
});
test("Repeated peer leave messages do not extend the grace period", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  let exits = 0;
  const grace = createCallGracePeriod(() => exits++);
  grace.start();
  context.mock.timers.tick(20000);
  assert.equal(grace.start(), 31000);
  context.mock.timers.tick(10000);
  assert.equal(exits, 1);
});
test("Leaving manually cancels the pending auto-disconnect", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  let exits = 0;
  const grace = createCallGracePeriod(() => exits++);
  grace.start();
  context.mock.timers.tick(5000);
  grace.cancel();
  context.mock.timers.tick(60000);
  assert.equal(exits, 0);
});
test("A timer from an earlier call cannot end a later call", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  let exits = 0;
  const grace = createCallGracePeriod(() => exits++);
  grace.start();
  context.mock.timers.tick(10000);
  grace.cancel();
  grace.start();
  context.mock.timers.tick(20000);
  assert.equal(exits, 0);
  context.mock.timers.tick(10000);
  assert.equal(exits, 1);
});
