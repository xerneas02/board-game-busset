import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}) {
  const id=Number((await params).id);
  if(!Number.isInteger(id))return NextResponse.json({error:"Joueur invalide."},{status:400});
  const player=db.prepare("SELECT id FROM players WHERE id=? AND active=1").get(id);
  if(!player)return NextResponse.json({error:"Joueur introuvable."},{status:404});
  const session=db.prepare("SELECT players FROM active_session WHERE id=1").get() as {players:string}|undefined;
  if(session&&JSON.parse(session.players).includes(id))return NextResponse.json({error:"Ce joueur participe à la partie en cours."},{status:409});
  db.prepare("UPDATE players SET active=0 WHERE id=?").run(id);
  return new NextResponse(null,{status:204});
}
