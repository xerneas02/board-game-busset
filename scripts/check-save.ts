import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

async function main() {
  const directory=mkdtempSync(join(tmpdir(),"busset-save-"));
  process.env.DATABASE_PATH=join(directory,"test.db");
  try {
    const {db}=await import("../lib/db");
    const {POST:savePlay}=await import("../app/api/plays/route");
    const {GET:getEvents}=await import("../app/api/events/route");
    const {DELETE:removePlayer}=await import("../app/api/players/[id]/route");
    const {POST:addPlayer}=await import("../app/api/players/route");
    const game=(db.prepare("SELECT id FROM games LIMIT 1").get() as {id:number}).id;
    const player=Number(db.prepare("INSERT INTO players(name) VALUES('Test')").run().lastInsertRowid);
    const event=Number(db.prepare("INSERT INTO game_events(gameId,name) VALUES(?,'Test spécial')").run(game).lastInsertRowid);
    const occurredAt=Date.now();
    db.prepare("INSERT INTO active_session(id,gameId,players,startedAt,elapsedSeconds,tracking,paused,events,version,updatedAt) VALUES(1,?,?,NULL,0,0,1,'[]',1,0)").run(game,JSON.stringify([player]));
    const save=(version:number)=>savePlay(new Request("http://localhost/api/plays",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({gameId:game,expectedSessionVersion:version,duration:30,players:[{id:player,winner:true}],events:[{id:event,playerId:player,count:2,occurredAt}]})}) as NextRequest);

    assert.equal((await save(2)).status,409);
    assert.equal((db.prepare("SELECT count(*) total FROM plays").get() as {total:number}).total,0);
    assert.ok(db.prepare("SELECT 1 FROM active_session").get());
    assert.equal((await save(1)).status,201);
    assert.equal((db.prepare("SELECT count(*) total FROM plays").get() as {total:number}).total,1);
    assert.equal(db.prepare("SELECT 1 FROM active_session").get(),undefined);
    assert.equal((await save(1)).status,409);
    assert.equal((db.prepare("SELECT count(*) total FROM plays").get() as {total:number}).total,1);

    const events=await (await getEvents(new NextRequest(`http://localhost/api/events?gameId=${game}`))).json();
    assert.equal(events[0].total,2);
    assert.equal(events[0].occurrences[0].playerName,"Test");
    assert.equal(events[0].occurrences[0].occurredAt,occurredAt);
    db.prepare("INSERT INTO active_session(id,gameId,players,startedAt,elapsedSeconds,tracking,paused,events,version,updatedAt) VALUES(1,?,?,NULL,0,0,1,'[]',2,0)").run(game,JSON.stringify([player]));
    const remove=()=>removePlayer(new Request("http://localhost"),{params:Promise.resolve({id:String(player)})});
    assert.equal((await remove()).status,409);
    db.prepare("DELETE FROM active_session").run();
    assert.equal((await remove()).status,204);
    assert.equal((db.prepare("SELECT active FROM players WHERE id=?").get(player) as {active:number}).active,0);
    assert.equal((db.prepare("SELECT count(*) total FROM participants WHERE playerId=?").get(player) as {total:number}).total,1);
    const restored=await addPlayer(new NextRequest("http://localhost/api/players",{method:"POST",body:JSON.stringify({name:"Test"})}));
    assert.equal(restored.status,201);
    assert.equal((await restored.json()).id,player);
    db.close();
    console.log("Sauvegarde, événements et retrait réversible d’un joueur OK");
  } finally {
    rmSync(directory,{recursive:true,force:true});
  }
}

main().catch(error=>{console.error(error);process.exitCode=1});
