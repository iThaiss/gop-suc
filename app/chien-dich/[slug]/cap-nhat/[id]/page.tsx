import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { campaign, updates } from "../../../../../lib/db";
import { picture, updateDate, updatePicture } from "../../../../../lib/domain";
import { Share } from "../../../../../components/client";

export const dynamic = "force-dynamic";
type Props={params:Promise<{slug:string;id:string}>};
async function load(params:Props["params"]) {
  const {slug,id}=await params, c=await campaign(slug);
  if (!c || c.status==="draft") notFound();
  const post=(await updates(slug)).find(row=>String(row.id)===id);
  if (!post) notFound();
  return {c,post,path:`/chien-dich/${slug}/cap-nhat/${id}`};
}
export async function generateMetadata({params}:Props):Promise<Metadata> {
  const {c,post,path}=await load(params);
  return {title:post.title,description:post.body.slice(0,160),openGraph:{title:post.title,description:post.body.slice(0,160),url:path,images:[updatePicture(post)??picture(c.cover)]}};
}
export default async function UpdatePage({params}:Props) {
  const {c,post,path}=await load(params);
  const photo=updatePicture(post);
  return <article className="shell narrow post-page"><Link href={`/chien-dich/${c.slug}#nhat-ky`}>{c.title}</Link>
    <header><time dateTime={post.created.replace(" ","T")+"Z"}>{updateDate(post.created)}</time><h1>{post.title}</h1></header>
    {photo&&<div className="post-photo"><Image src={photo} alt={post.hasPhoto?`Ảnh bàn giao: ${post.title}`:"Ảnh minh họa"} fill sizes="(max-width: 680px) 100vw, 680px"/></div>}
    <p>{post.body}</p><Share path={path} title={post.title}/></article>;
}
