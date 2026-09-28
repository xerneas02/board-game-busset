import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic="force-dynamic";

export async function GET(request:NextRequest) {
  const gameId=Number(request.nextUrl.searchParams.get("gameId"));
  if(!Number.isInteger(gameId))return NextResponse.json({error:"Jeu invalide."},{status:400});
  const events=db.prepare("SELECT e.id,e.name,COALESCE(SUM(pe.count),0) total FROM game_events e LEFT JOIN play_events pe ON pe.eventId=e.id WHERE e.gameId=? GROUP BY e.id ORDER BY e.name").all(gameId) as {id:number;name:string;total:number}[];
  const occurrences=db.prepare(`SELECT pe.eventId,pe.count,p.name playerName,
    COALESCE(pe.occurredAt,CAST(strftime('%s',plays.playedAt) AS INTEGER)*1000) occurredAt,
    pe.occurredAt IS NOT NULL exact
    FROM play_events pe JOIN plays ON plays.id=pe.playId
    LEFT JOIN players p ON p.id=pe.playerId
    WHERE plays.gameId=? ORDER BY occurredAt DESC`).all(gameId) as {eventId:number;count:number;playerName:string|null;occurredAt:number;exact:number}[];
  return NextResponse.json(events.map(event=>({...event,occurrences:occurrences.filter(row=>row.eventId===event.id)})));
}

export async function POST(request:NextRequest) {
  const {gameId,name}=await request.json(),value=String(name||"").trim();
  if(!Number.isInteger(gameId)||!value||value.length>60)return NextResponse.json({error:"Événement invalide."},{status:400});
  try {
    const row=db.prepare("INSERT INTO game_events(gameId,name) VALUES(?,?)").run(gameId,value);
    return NextResponse.json({id:row.lastInsertRowid,name:value,total:0,occurrences:[]},{status:201});
  } catch {
    return NextResponse.json({error:"Cet événement existe déjà."},{status:409});
  }
}
