import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(db.prepare("SELECT * FROM players WHERE active=1 ORDER BY name").all());
}

export async function POST(request:NextRequest) {
  const body=await request.json(),name=String(body.name||"").trim();
  if(!name)return NextResponse.json({error:"Nom requis"},{status:400});
  const existing=db.prepare("SELECT id,active FROM players WHERE lower(name)=lower(?)").get(name) as {id:number;active:number}|undefined;
  if(existing?.active)return NextResponse.json({error:"Ce joueur existe déjà."},{status:409});
  const id=existing?.id??db.prepare("INSERT INTO players(name,color) VALUES(?,?)").run(name,body.color||null).lastInsertRowid;
  if(existing)db.prepare("UPDATE players SET active=1 WHERE id=?").run(id);
  return NextResponse.json(db.prepare("SELECT * FROM players WHERE id=?").get(id),{status:201});
}
