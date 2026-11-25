import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { campaign, updates } from "../../../../../lib/db";
import { picture } from "../../../../../lib/domain";
import { Share } from "../../../../../components/client";

export const dynamic = "force-dynamic";
type Props={params:Promise<{slug:string;id:string}>};
async function load(params:Props["params"]) {
  const {slug,id}=await params, c=campaign(slug);
  if (!c || c.status==="draft") notFound();
  const post=updates(slug).find(row=>String(row.id)===id);
  if (!post) notFound();
  return {c,post,path:`/chien-dich/${slug}/cap-nhat/${id}`};
}
export async function generateMetadata({params}:Props):Promise<Metadata> {
  const {c,post,path}=await load(params);
  return {title:post.title,description:post.body.slice(0,160),openGraph:{title:post.title,description:post.body.slice(0,160),url:path,images:[picture(post.image||c.cover)]}};
}
export default async function UpdatePage({params}:Props) {
  const {c,post,path}=await load(params);
  return <article className="shell narrow"><Link href={`/chien-dich/${c.slug}`}>{c.title}</Link><h1>{post.title}</h1>{post.image&&<div className="post-photo"><Image src={picture(post.image)} alt="Ảnh minh họa" fill sizes="100vw"/></div>}<p>{post.body}</p><Share path={path} title={post.title}/></article>;
}
