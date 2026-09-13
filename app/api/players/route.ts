import { db } from "@/lib/db"; import { NextRequest,NextResponse } from "next/server";
export async function GET(){return NextResponse.json(db.prepare("SELECT * FROM players WHERE active=1 ORDER BY name").all())}
export async function POST(r:NextRequest){const b=await r.json();if(!b.name?.trim())return NextResponse.json({error:"Nom requis"},{status:400});const x=db.prepare("INSERT INTO players(name,color) VALUES(?,?)").run(b.name.trim(),b.color||null);return NextResponse.json(db.prepare("SELECT * FROM players WHERE id=?").get(x.lastInsertRowid),{status:201})}
