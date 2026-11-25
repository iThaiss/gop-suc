import { publicExpensePhoto } from "../../../../../../lib/db";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};

export async function GET(_:Request,{params}:{params:Promise<{slug:string;id:string}>}) {
  const {slug,id}=await params;
  const number=Number(id);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>70||!/^[1-9]\d{0,9}$/.test(id)||number>2_147_483_647) return new Response(null,{status:404,headers});
  const result=await publicExpensePhoto(slug,number);
  if(!result) return new Response(null,{status:404,headers});
  return new Response(Uint8Array.from(result.image),{headers:{...headers,"Content-Type":"image/webp"}});
}
