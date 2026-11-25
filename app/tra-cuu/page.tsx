import { Lookup } from "../../components/client";

export const metadata={title:"Tra cứu khoản góp"};
export default async function LookupPage({searchParams}: {searchParams:Promise<{ma?:string}>}) {
  const {ma}=await searchParams;
  return <section className="shell narrow"><h1>Tra cứu khoản góp</h1><p>Nhập mã riêng để kiểm tra giao dịch hoặc lịch hẹn bàn giao.</p><Lookup initialCode={typeof ma==="string"?ma.slice(0,32):""}/></section>;
}
