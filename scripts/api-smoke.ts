import { strict as assert } from "node:assert";
import Database from "better-sqlite3";

const base=process.env.SMOKE_BASE||"http://localhost:3002";
let authCookie="";
async function call<T=any>(path:string,method="GET",body?:unknown):Promise<T>{const response=await fetch(base+path,{method,headers:{...(body?{"Content-Type":"application/json"}:{}),...(authCookie?{Cookie:authCookie}:{})},body:body?JSON.stringify(body):undefined});if(!response.ok)throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);return response.status===204?undefined as T:await response.json() as T}
function smallPdf(){const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];const content="BT /F1 14 Tf 40 200 Td (Une route est construite) Tj ET";objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);let pdf="%PDF-1.4\n",offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,"0")} 00000 n \n`;pdf+=`trailer << /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf)}

async function main(){
  if(process.env.SMOKE_PASSWORD){assert.equal((await fetch(base+"/api/games")).status,401);const wrong=await fetch(base+"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:"incorrect"})});assert.equal(wrong.status,401);const login=await fetch(base+"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:process.env.SMOKE_PASSWORD})});assert.equal(login.status,200);authCookie=login.headers.get("set-cookie")?.split(";")[0]||"";assert.ok(authCookie)}
  const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
  assert.equal((await pdfjs.getDocument({data:new Uint8Array(smallPdf()),useSystemFonts:true,disableFontFace:true}).promise).numPages,1);
  const initial=await call<any[]>("/api/games");
  assert.ok(initial.length>=31);
  assert.ok(initial.some(game=>game.name==="Skyjo Action"&&Number(game.difficulty)===1.17));
  assert.ok(initial.some(game=>game.name==="Palet breton")&&initial.some(game=>game.name==="Jeu de la grenouille"));
  assert.ok(["Fort Boyard","Monopoly","Risk"].every(name=>!initial.some(game=>game.name===name)));
  assert.ok(["Cryptide","TTMC","Codenames"].every(name=>initial.some(game=>game.name===name&&game.coverPath)));

  const suffix=Date.now().toString(36);
  const game=await call("/api/games","POST",{name:"Essai "+suffix,minPlayers:2,maxPlayers:4,estimatedMinutes:45,difficulty:1.5,tags:["Nouveau tag"]});
  assert.deepEqual(game.tags,["Nouveau tag"]);
  const duplicate=await fetch(base+"/api/games",{method:"POST",headers:{"Content-Type":"application/json",...(authCookie?{Cookie:authCookie}:{})},body:JSON.stringify({name:"  ESSAI "+suffix+"  ",minPlayers:2,maxPlayers:4})});
  assert.equal(duplicate.status,409);
  const edited=await call(`/api/games/${game.id}`,"PATCH",{name:"Essai modifié "+suffix,minPlayers:2,maxPlayers:5,estimatedMinutes:30,difficulty:1.5});
  assert.equal(edited.maxPlayers,5);
  const p1=await call("/api/players","POST",{name:"Alice "+suffix}),p2=await call("/api/players","POST",{name:"Bob "+suffix});
  const play=await call("/api/plays","POST",{gameId:game.id,duration:17,players:[{id:p1.id,winner:true,score:100},{id:p2.id,winner:true,score:50}]});
  await call("/api/plays","POST",{gameId:game.id,duration:null,players:[{id:p1.id,winner:true},{id:p2.id,winner:false}]});
  const stats=await call<any>("/api/stats");
  assert.equal(stats.players.find((player:any)=>player.id===p1.id).wins,2);
  assert.equal(stats.players.find((player:any)=>player.id===p1.id).winRate,100);
  assert.ok(stats.topGames.some((item:any)=>item.name===edited.name));
  assert.equal(stats.averageScore,undefined);
  const gameStats=await call<any>(`/api/stats?gameId=${game.id}`);
  assert.equal(gameStats.players.find((player:any)=>player.id===p1.id).averageScore,100);
  assert.equal(gameStats.averageScore.value,75);
  assert.ok(gameStats.scoresByPlayerCount.some((row:any)=>row.playerCount===2));
  assert.equal((await call<any[]>("/api/games")).find(item=>item.id===game.id).avgDuration,17);

  await call("/api/rules","POST",{gameId:game.id,title:"Construction",content:"Une route relie deux villages."});
  let rules=await call<any>(`/api/rules?gameId=${game.id}&q=route`);
  assert.ok(rules.results.some((rule:any)=>rule.title==="Construction"));
  const form=new FormData();form.append("file",new Blob([smallPdf()],{type:"application/pdf"}),"regles.pdf");
  const uploadResponse=await fetch(base+"/api/media",{method:"POST",headers:authCookie?{Cookie:authCookie}:undefined,body:form});assert.equal(uploadResponse.status,200);
  const upload=await uploadResponse.json();
  const pdf=await call("/api/rules/pdf","POST",{gameId:game.id,path:upload.path,fileName:"regles.pdf"});assert.equal(pdf.pages,1);
  rules=await call<any>(`/api/rules?gameId=${game.id}&q=route`);assert.ok(rules.results.some((rule:any)=>rule.type==="pdf"&&rule.page===1));
  await call(`/api/games/${game.id}`,"DELETE");assert.ok(!(await call<any[]>("/api/games")).some(item=>item.id===game.id));
  if(!process.env.SMOKE_BASE){const database=new Database("./data/smoke.db",{readonly:true});assert.equal((database.prepare("SELECT duration FROM plays WHERE id=?").get(play.id) as any).duration,17);database.close()}
  console.log("API : collection, scores, durée moyenne, stats, FTS5, PDF et persistance OK");
}

main().catch(error=>{console.error(error);process.exitCode=1});
