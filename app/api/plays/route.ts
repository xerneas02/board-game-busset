import { db } from "@/lib/db";
import { NextRequest,NextResponse } from "next/server";
type Participant={id:number;winner?:boolean;score?:number|null};
type Event={id:number;count:number;playerId?:number|null};
export async function POST(request:NextRequest){
  const body=await request.json(),players=body.players as Participant[],events=(body.events||[]) as Event[];
  const validPlayers=Array.isArray(players)&&players.length&&new Set(players.map(x=>x.id)).size===players.length&&players.every(x=>Number.isInteger(x.id)&&(x.score===undefined||x.score===null||Number.isFinite(x.score)));
  const validEvents=Array.isArray(events)&&events.every(x=>Number.isInteger(x.id)&&Number.isInteger(x.count)&&x.count>0&&(x.playerId===undefined||x.playerId===null||Number.isInteger(x.playerId)));
  if(!Number.isInteger(body.gameId)||!validPlayers||!validEvents||events.some(x=>x.playerId!=null&&!players.some(p=>p.id===x.playerId)))return NextResponse.json({error:"Données de partie invalides."},{status:400});
  if(body.duration!==null&&body.duration!==undefined&&(!Number.isInteger(body.duration)||body.duration<1))return NextResponse.json({error:"Durée invalide."},{status:400});
  if(!db.prepare("SELECT id FROM games WHERE id=?").get(body.gameId))return NextResponse.json({error:"Jeu introuvable."},{status:404});
  const playerCount=db.prepare(`SELECT count(*) count FROM players WHERE id IN (${players.map(()=>"?").join(",")})`).get(...players.map(x=>x.id)) as {count:number};
  const eventCount=events.length?(db.prepare(`SELECT count(*) count FROM game_events WHERE gameId=? AND id IN (${events.map(()=>"?").join(",")})`).get(body.gameId,...events.map(x=>x.id)) as {count:number}).count:0;
  if(playerCount.count!==players.length||eventCount!==new Set(events.map(x=>x.id)).size)return NextResponse.json({error:"Joueur ou événement introuvable."},{status:400});
  const id=db.transaction(()=>{const play=db.prepare("INSERT INTO plays(gameId,duration,notes) VALUES(?,?,?)").run(body.gameId,body.duration??null,body.notes||null),add=db.prepare("INSERT INTO participants(playId,playerId,winner,score) VALUES(?,?,?,?)"),event=db.prepare("INSERT INTO play_events(playId,eventId,playerId,count) VALUES(?,?,?,?)");players.forEach(x=>add.run(play.lastInsertRowid,x.id,x.winner?1:0,x.score??null));events.forEach(x=>event.run(play.lastInsertRowid,x.id,x.playerId??null,x.count));return play.lastInsertRowid})();
  return NextResponse.json({id},{status:201});
}
