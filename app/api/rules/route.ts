import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  const id=Number(request.nextUrl.searchParams.get("gameId"));
  if (!Number.isInteger(id)||id<1) return NextResponse.json({error:"Jeu invalide"},{status:400});
  const q=(request.nextUrl.searchParams.get("q")||"").trim();
  if (!q) return NextResponse.json({sections:db.prepare("SELECT id,title,content FROM rule_sections WHERE gameId=? ORDER BY position,id").all(id),documents:db.prepare("SELECT id,fileName,filePath FROM rule_documents WHERE gameId=? ORDER BY id DESC").all(id),results:[]});
  const terms=[...new Set(q.normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/[a-zA-Z0-9]+/g)||[])].slice(0,8);
  if (!terms) return NextResponse.json({sections:[],documents:[],results:[]});
  // Any matching word is useful for a family-rule lookup. Prefix matching also makes searches such as "construc" find related words.
  const query=terms.map(term=>`"${term}"*`).join(" OR ");
  const sections=db.prepare("SELECT s.id,s.title,s.content FROM rules_fts f JOIN rule_sections s ON s.id=f.rowid WHERE s.gameId=? AND rules_fts MATCH ? ORDER BY bm25(rules_fts) LIMIT 20").all(id,query);
  const pages=db.prepare("SELECT p.id,p.page,p.content,d.filePath,d.fileName FROM rule_pages_fts f JOIN rule_pages p ON p.id=f.rowid JOIN rule_documents d ON d.id=p.documentId WHERE p.gameId=? AND rule_pages_fts MATCH ? ORDER BY bm25(rule_pages_fts) LIMIT 20").all(id,query);
  return NextResponse.json({sections:[],documents:[],results:[...sections.map((x:any)=>({...x,type:"section"})),...pages.map((x:any)=>({...x,type:"pdf",title:x.fileName}))]});
}
export async function POST(request:NextRequest) {
  const {gameId,title,content}=await request.json();
  if (!Number.isInteger(gameId)||!title?.trim()||!content?.trim()) return NextResponse.json({error:"Titre et texte requis"},{status:400});
  const transaction=db.transaction(()=>{const row=db.prepare("INSERT INTO rule_sections(gameId,title,content,position) VALUES(?,?,?,(SELECT count(*) FROM rule_sections WHERE gameId=?))").run(gameId,title.trim(),content.trim(),gameId);db.prepare("INSERT INTO rules_fts(rowid,gameId,title,content) VALUES(?,?,?,?)").run(row.lastInsertRowid,gameId,title.trim(),content.trim());return row.lastInsertRowid});
  try {return NextResponse.json({id:transaction()},{status:201})} catch {return NextResponse.json({error:"Enregistrement impossible"},{status:400})}
}
