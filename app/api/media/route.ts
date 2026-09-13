import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const directory = process.env.UPLOAD_DIR || "./public/uploads";
export async function POST(request: NextRequest) {
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size > 12_000_000 || file.size === 0) return NextResponse.json({error:"Fichier invalide (12 Mo maximum)."},{status:400});
  const types: Record<string,string> = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"};
  const extension = types[file.type];
  if (!extension) return NextResponse.json({error:"Utilisez une image JPG, PNG, WebP ou un PDF."},{status:400});
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid = extension === "pdf" ? bytes.subarray(0,5).toString() === "%PDF-" : extension === "png" ? bytes.subarray(0,8).toString("hex") === "89504e470d0a1a0a" : extension === "jpg" ? bytes[0] === 255 && bytes[1] === 216 : bytes.subarray(0,4).toString() === "RIFF" && bytes.subarray(8,12).toString() === "WEBP";
  if (!valid) return NextResponse.json({error:"Format du fichier invalide."},{status:400});
  await mkdir(directory,{recursive:true});
  const name = `${randomUUID()}.${extension}`;
  await writeFile(`${directory}/${name}`,bytes);
  return NextResponse.json({path:`/api/media/${name}`,name:file.name});
}
