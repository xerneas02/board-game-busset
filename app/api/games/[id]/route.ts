import { db } from "@/lib/db";
import { NextRequest,NextResponse } from "next/server";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const id=Number((await params).id),body=await request.json();
  const current=db.prepare("SELECT * FROM games WHERE id=?").get(id) as {id:number;minPlayers:number;maxPlayers:number}|undefined;
  if(!current) return NextResponse.json({error:"Jeu introuvable."},{status:404});
  const min=body.minPlayers??current.minPlayers,max=body.maxPlayers??current.maxPlayers,name=body.name?.trim();
  if(min<1||max<min) return NextResponse.json({error:"Nombre de joueurs invalide."},{status:400});
  if(name&&db.prepare("SELECT id FROM games WHERE active=1 AND lower(trim(name))=lower(?) AND id<>?").get(name,id))
    return NextResponse.json({error:"Ce jeu est déjà dans la ludothèque."},{status:409});
  if(name) body.name=name;
  const keys=["name","coverPath","minPlayers","maxPlayers","estimatedMinutes","difficulty","rating","notes","rulesUrl","active"].filter(key=>key in body);
  if(!keys.length) return NextResponse.json({error:"Rien à modifier."},{status:400});
  try {
    db.prepare(`UPDATE games SET ${keys.map(key=>`${key}=?`).join(",")},updatedAt=CURRENT_TIMESTAMP WHERE id=?`).run(...keys.map(key=>body[key]),id);
  } catch(error) {
    if(error instanceof Error&&error.message.includes("UNIQUE")) return NextResponse.json({error:"Ce jeu est déjà dans la ludothèque."},{status:409});
    throw error;
  }
  return NextResponse.json(db.prepare("SELECT * FROM games WHERE id=?").get(id));
}

export async function DELETE(_:NextRequest,{params}:{params:Promise<{id:string}>}) {
  db.prepare("UPDATE games SET active=0 WHERE id=?").run((await params).id);
  return new NextResponse(null,{status:204});
}
