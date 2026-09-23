import { cleanTags, db, gameJson, slugify } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(db.prepare("SELECT g.*, (SELECT count(*) FROM plays p WHERE p.gameId=g.id) playedCount, (SELECT ROUND(AVG(p.duration)) FROM plays p WHERE p.gameId=g.id AND p.duration IS NOT NULL) avgDuration FROM games g WHERE active=1 ORDER BY name").all().map(gameJson));
}

export async function POST(request:NextRequest) {
  const body=await request.json(),name=body.name?.trim();
  if(!name||!Number.isInteger(body.minPlayers)||!Number.isInteger(body.maxPlayers)||body.minPlayers<1||body.maxPlayers<body.minPlayers)
    return NextResponse.json({error:"Vérifiez le nom et le nombre de joueurs."},{status:400});
  if(db.prepare("SELECT id FROM games WHERE active=1 AND lower(trim(name))=lower(?)").get(name))
    return NextResponse.json({error:"Ce jeu est déjà dans la ludothèque."},{status:409});
  const slug=slugify(name)+"-"+Date.now().toString(36);
  try {
    const result=db.prepare("INSERT INTO games(slug,name,coverPath,minPlayers,maxPlayers,estimatedMinutes,difficulty,rating,notes,rulesUrl,tags,lowerScoreWins) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(slug,name,body.coverPath||null,body.minPlayers,body.maxPlayers,body.estimatedMinutes||null,body.difficulty||null,body.rating||null,body.notes||null,body.rulesUrl||null,JSON.stringify(cleanTags(body.tags)),body.lowerScoreWins?1:0);
    return NextResponse.json(gameJson(db.prepare("SELECT * FROM games WHERE id=?").get(result.lastInsertRowid)),{status:201});
  } catch(error) {
    if(error instanceof Error&&error.message.includes("UNIQUE")) return NextResponse.json({error:"Ce jeu est déjà dans la ludothèque."},{status:409});
    throw error;
  }
}
