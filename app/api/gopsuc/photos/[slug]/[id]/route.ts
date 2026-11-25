import { publicUpdatePhoto } from "../../../../../../lib/db";

export async function GET(_: Request, {params}: {params:Promise<{slug:string;id:string}>}) {
  const {slug,id}=await params;
  const number=Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(number)) return new Response(null,{status:404});
  const data=await publicUpdatePhoto(slug,number);
  if (!data) return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
  return new Response(Uint8Array.from(data),{headers:{"Content-Type":"image/webp","Cache-Control":"public, max-age=3600"}});
}
