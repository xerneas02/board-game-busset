import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const directory=process.env.UPLOAD_DIR||"./public/uploads";
export async function POST(request:NextRequest) {
  const {gameId,path,fileName}=await request.json();
  const name=String(path||"").split("/").pop();
  if (!Number.isInteger(gameId)||!name||!/(^[a-f0-9-]{36}\.pdf$)/.test(name)) return NextResponse.json({error:"PDF invalide"},{status:400});
  try {
    const bytes=await readFile(`${directory}/${name}`);
    const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc=pathToFileURL(resolve(process.cwd(),"public/pdf.worker.mjs")).href;
    const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true,disableFontFace:true}).promise;
    const pages:{page:number;content:string}[]=[];
    for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const text=await page.getTextContent();pages.push({page:n,content:text.items.map((item:any)=>item.str||"").join(" ")})}
    const transaction=db.transaction(()=>{const doc=db.prepare("INSERT INTO rule_documents(gameId,filePath,fileName) VALUES(?,?,?)").run(gameId,path,String(fileName||"Règles.pdf"));const insert=db.prepare("INSERT INTO rule_pages(documentId,gameId,page,content) VALUES(?,?,?,?)");const index=db.prepare("INSERT INTO rule_pages_fts(rowid,content) VALUES(?,?)");for(const page of pages){const row=insert.run(doc.lastInsertRowid,gameId,page.page,page.content);index.run(row.lastInsertRowid,page.content)}return doc.lastInsertRowid});
    return NextResponse.json({id:transaction(),pages:pages.length});
  } catch (error) {console.error("Indexation PDF :",error);return NextResponse.json({error:"Impossible de lire ce PDF."},{status:400})}
}
