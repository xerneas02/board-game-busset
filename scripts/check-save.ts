import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextRequest } from "next/server";

async function main() {
  const directory=mkdtempSync(join(tmpdir(),"busset-save-"));
  process.env.DATABASE_PATH=join(directory,"test.db");
  try {
  const {db}=await import("../lib/db");
  const {POST}=await import("../app/api/plays/route");
  const game=(db.prepare("SELECT id FROM games LIMIT 1").get() as {id:number}).id;
  const player=Number(db.prepare("INSERT INTO players(name) VALUES('Test')").run().lastInsertRowid);
  db.prepare("INSERT INTO active_session(id,gameId,players,startedAt,elapsedSeconds,tracking,paused,events,version,updatedAt) VALUES(1,?,?,NULL,0,0,1,'[]',1,0)").run(game,JSON.stringify([player]));
  const save=(version:number)=>POST(new Request("http://localhost/api/plays",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({gameId:game,expectedSessionVersion:version,duration:30,players:[{id:player,winner:true}],events:[]})}) as NextRequest);

  assert.equal((await save(2)).status,409);
  assert.equal((db.prepare("SELECT count(*) total FROM plays").get() as {total:number}).total,0);
  assert.ok(db.prepare("SELECT 1 FROM active_session").get());
  assert.equal((await save(1)).status,201);
  assert.equal((db.prepare("SELECT count(*) total FROM plays").get() as {total:number}).total,1);
  assert.equal(db.prepare("SELECT 1 FROM active_session").get(),undefined);
  assert.equal((await save(1)).status,409);
  assert.equal((db.prepare("SELECT count(*) total FROM plays").get() as {total:number}).total,1);
  db.close();
  console.log("Sauvegarde atomique : conflit, succès et doublon OK");
  } finally {
    rmSync(directory,{recursive:true,force:true});
  }
}

main().catch(error=>{console.error(error);process.exitCode=1});
