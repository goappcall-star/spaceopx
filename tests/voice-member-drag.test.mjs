import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import test from "node:test";
import assert from "node:assert/strict";
function fixture(allowed = true) {
  const requests = [];
  const exports = {};
  const imports = {
    react: { useRef: (current) => ({current}), useState: (value) => [value, () => {}] },
    sonner: { toast: {success(){},error(){}} },
    "@/services/voice-moderation": {requestVoiceMove: async (...args) => { requests.push(args); } }
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/hooks/use-voice-member-drag.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>imports[name]});
  const rooms={games:[{user_id:"peer",voice_session_id:"session"}],afk:[]};
  const drag=exports.useVoiceMemberDrag("server",allowed,rooms);
  const data=new Map();
  const event={preventDefault(){},stopPropagation(){},dataTransfer:{types:[],setData(key,value){data.set(key,value);this.types=[...data.keys()];},getData(key){return data.get(key);}}};
  return {drag,event,requests,rooms,data};
}
test("Dragging a live member sends the actual room/session to the voice move service and suppresses opening their profile", async () => {
 const f=fixture(); assert.equal(f.drag.source("peer").draggable,true);
 f.drag.source("peer").onDragStart(f.event);
 assert.equal(f.drag.suppressClick(),true);
 f.drag.zone("afk").onDrop(f.event); await Promise.resolve();
 assert.deepEqual(f.requests,[["peer","games","afk","session"]]);
 f.drag.source("peer").onDragEnd(f.event);
 assert.equal(f.drag.suppressClick(),true);
});
test("Non-admin, wrong-server, expired-session, same-room and channel/category drags cannot move a member", () => {
 const denied=fixture(false); assert.equal(denied.drag.source("peer").draggable,false);
 denied.drag.source("peer").onDragStart(denied.event); denied.drag.zone("afk").onDrop(denied.event);
 assert.equal(denied.requests.length,0);
 for (const variation of ["server","session","room","category"]) {
  const f=fixture(); f.drag.source("peer").onDragStart(f.event);
  const mime=f.event.dataTransfer.types[0];
  if(variation==="server") f.data.set(mime,JSON.stringify({serverId:"elsewhere",userId:"peer",channelId:"games",session:"session"}));
  if(variation==="session") f.rooms.games[0].voice_session_id="new-session";
  if(variation==="category") f.event.dataTransfer.types=["text/plain"];
  f.drag.zone(variation==="room"?"games":"afk").onDrop(f.event);
  assert.equal(f.requests.length,0,variation);
 }
});
