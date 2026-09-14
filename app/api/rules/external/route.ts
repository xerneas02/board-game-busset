import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const dynamic="force-dynamic";
const maxBytes=50*1024*1024;

export async function POST(request:NextRequest) {
  const {gameId,url}=await request.json();
  if (!Number.isInteger(gameId)||typeof url!=="string") return NextResponse.json({error:"Jeu ou lien invalide."},{status:400});
  let source:URL;
  try { source=new URL(url) } catch { return NextResponse.json({error:"Lien de règles invalide."},{status:400}) }
  if (source.protocol!=="https:"||source.port) return NextResponse.json({error:"Seuls les PDF HTTPS peuvent être indexés."},{status:400});
  if (!db.prepare("SELECT 1 FROM games WHERE id=? AND active=1 AND rulesUrl=?").get(gameId,url)) return NextResponse.json({error:"Ce lien ne correspond pas aux règles de ce jeu."},{status:400});
  const existing=db.prepare("SELECT id FROM rule_documents WHERE gameId=? AND filePath=?").get(gameId,url) as {id:number}|undefined;
  if (existing) return NextResponse.json({id:existing.id,alreadyIndexed:true});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  try {
    const response=await fetch(source,{signal:controller.signal,redirect:"follow"});
    if (!response.ok) throw new Error("Téléchargement impossible.");
    const finalUrl=new URL(response.url);
    if (finalUrl.protocol!=="https:"||finalUrl.port) throw new Error("Redirection PDF refusée.");
    const contentLength=Number(response.headers.get("content-length")||0);
    if (contentLength>maxBytes) throw new Error("Ce PDF est trop volumineux (50 Mo maximum).");
    const bytes=new Uint8Array(await response.arrayBuffer());
    if (!bytes.length||bytes.length>maxBytes||String.fromCharCode(...bytes.subarray(0,4))!=="%PDF") throw new Error("Le lien ne fournit pas un PDF lisible.");
    const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc=pathToFileURL(resolve(process.cwd(),"public/pdf.worker.mjs")).href;
    const pdf=await pdfjs.getDocument({data:bytes,useSystemFonts:true,disableFontFace:true}).promise;
    const pages:{page:number;content:string}[]=[];
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++) {
      const page=await pdf.getPage(pageNumber),text=await page.getTextContent();
      pages.push({page:pageNumber,content:text.items.map((item:any)=>item.str||"").join(" ")});
    }
    const fileName=decodeURIComponent(finalUrl.pathname.split("/").pop()||"Règles.pdf").replace(/[^\w.() -]/g,"_").slice(0,120)||"Règles.pdf";
    const transaction=db.transaction(()=>{
      const document=db.prepare("INSERT INTO rule_documents(gameId,filePath,fileName) VALUES(?,?,?)").run(gameId,url,fileName);
      const insertPage=db.prepare("INSERT INTO rule_pages(documentId,gameId,page,content) VALUES(?,?,?,?)");
      const indexPage=db.prepare("INSERT INTO rule_pages_fts(rowid,content) VALUES(?,?)");
      for (const page of pages) { const row=insertPage.run(document.lastInsertRowid,gameId,page.page,page.content); indexPage.run(row.lastInsertRowid,page.content); }
      return document.lastInsertRowid;
    });
    return NextResponse.json({id:transaction(),pages:pages.length},{status:201});
  } catch (error) {
    console.error("Indexation PDF externe :",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Impossible d’indexer ce PDF."},{status:400});
  } finally { clearTimeout(timeout) }
}
