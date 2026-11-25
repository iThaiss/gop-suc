import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake, Search } from "lucide-react";
import { publicBase } from "../lib/domain";
import "@fontsource-variable/manrope";
import "./style.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicBase()),
  title: { default:"Góp Sức · Gây quỹ cộng đồng", template:"%s · Góp Sức" },
  description:"Khám phá chiến dịch cộng đồng, góp tiền hoặc hiện vật và theo dõi kết quả bàn giao.",
  referrer:"no-referrer",
  robots:{index:false,follow:false},
};
export default function Layout({children}: {children:React.ReactNode}) {
  return <html lang="vi"><body>
    <a className="skip" href="#noi-dung">Đến nội dung chính</a>
    <header className="header"><div className="shell nav">
      <Link href="/" className="brand"><span><HeartHandshake size={23}/></span>Góp Sức</Link>
      <nav aria-label="Điều hướng chính"><Link href="/#chien-dich">Chiến dịch</Link><Link href="/#tim-cach-gop">Tìm cách góp</Link><Link href="/tra-cuu"><Search size={17}/> Tra cứu</Link></nav>
    </div></header>
    <main id="noi-dung">{children}</main>
    <footer><div className="shell foot"><b>Góp Sức</b><p>Đồ án lập trình web · Dữ liệu và giao dịch mô phỏng.</p><Link href="/quan-tri">Trang quản trị</Link></div></footer>
  </body></html>;
}
