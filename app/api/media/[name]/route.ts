import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
const directory = process.env.UPLOAD_DIR || "./public/uploads";
export async function GET(_:NextRequest,{params}:{params:Promise<{name:string}>}) {
  const {name}=await params;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|pdf)$/.test(name)) return new NextResponse(null,{status:404});
  try {
    const body=await readFile(`${directory}/${name}`);
    const type=name.endsWith("pdf")?"application/pdf":name.endsWith("png")?"image/png":name.endsWith("webp")?"image/webp":"image/jpeg";
    return new NextResponse(body,{headers:{"Content-Type":type,"Cache-Control":"private, max-age=86400","X-Content-Type-Options":"nosniff"}});
  } catch { return new NextResponse(null,{status:404}); }
}
