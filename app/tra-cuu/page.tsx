import { Lookup } from "../../components/client";

export const metadata={title:"Tra cứu khoản góp"};
export default async function LookupPage({searchParams}: {searchParams:Promise<{ma?:string}>}) {
  const {ma}=await searchParams;
  return <section className="shell narrow"><h1>Tra cứu khoản góp</h1><p>Dùng mã riêng để xem phiếu và theo dõi tiến độ chung của chiến dịch.</p><Lookup initialCode={typeof ma==="string" && /^[a-fA-F0-9]{32}$/.test(ma)?ma.toLowerCase():""}/></section>;
}
