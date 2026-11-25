"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Heart, Package, Share2, Sparkles, X } from "lucide-react";
import { FacebookShareButton } from "react-share";
import { money, type Campaign, type Need, type Receipt } from "../lib/domain";

export async function api<T>(data: object, signal?: AbortSignal): Promise<T> {
  const result = await fetch("/api/gopsuc",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),signal});
  const body = await result.json();
  if (!result.ok) throw new Error(body.error ?? "Yêu cầu chưa thành công.");
  return body as T;
}
const getError = (error: unknown) => error instanceof Error ? error.message : "Vui lòng thử lại.";

export function Share({ path, title }: {path:string;title:string}) {
  const headingId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [url,setUrl] = useState("");
  const [status,setStatus] = useState("");
  const [nativeAvailable,setNativeAvailable]=useState(false);
  const share = () => {
    setUrl(new URL(path,window.location.origin).href);
    setStatus("");
    setNativeAvailable(typeof navigator.share === "function");
    dialog.current?.showModal();
  };
  const nativeShare=async()=>{
    try { await navigator.share({title,url});dialog.current?.close(); }
    catch (err) { if (!(err instanceof DOMException && err.name==="AbortError")) setStatus("Vui lòng thử Facebook hoặc sao chép liên kết."); }
  };
  return <>
    <button type="button" className="button outline" onClick={share}><Share2 size={17}/> Chia sẻ</button>
    <dialog ref={dialog} aria-labelledby={headingId} className="dialog">
      <div className="dialog-head"><h2 id={headingId}>Chia sẻ liên kết</h2><button type="button" className="icon" aria-label="Đóng" onClick={()=>dialog.current?.close()}><X/></button></div>
      <p>{title}</p>
      <label>Liên kết công khai<input value={url} readOnly onFocus={event=>event.currentTarget.select()}/></label>
      <div className="row"><button className="button" onClick={async()=>{try{await navigator.clipboard.writeText(url);setStatus("Đã sao chép liên kết.");}catch{setStatus("Bạn có thể chọn và sao chép liên kết ở trên.");}}}><Copy size={16}/> Sao chép</button>{url && <FacebookShareButton url={url} className="button outline">Facebook</FacebookShareButton>}{nativeAvailable && <button className="button outline" onClick={nativeShare}>Ứng dụng khác</button>}</div>
      <small role="status">{status}</small>
    </dialog>
  </>;
}

function ReceiptView({ gift }: {gift:Receipt}) {
  const [copyMessage,setCopyMessage]=useState("");
  return <div className="ticket"><strong>{gift.kind==="cash" ? money(gift.amount) : `${gift.amount} ${gift.unit} · ${gift.needName}`}</strong>
    <span>{gift.status==="confirmed" ? gift.kind==="goods" ? `Đã nhận ${gift.actual} ${gift.unit}` : "Đã ghi nhận khoản ủng hộ" : gift.status==="cancelled" ? "Đã hủy hẹn" : gift.kind==="cash" ? "Đang chờ xác nhận" : "Đã đăng ký · chờ bàn giao"}</span>
    {gift.handoff && <span>{gift.handoff}</span>}
    <label>Mã tra cứu<input value={gift.code} readOnly onFocus={event=>event.currentTarget.select()}/></label>
    <button type="button" className="receipt-copy" onClick={async()=>{
      try { await navigator.clipboard.writeText(gift.code);setCopyMessage("Đã sao chép mã tra cứu."); }
      catch { setCopyMessage("Chọn và sao chép mã trong ô bên trên."); }
    }}><Copy size={15}/> Sao chép mã</button>
    {copyMessage && <small role="status">{copyMessage}</small>}
  </div>;
}

type GivingControls = {
  campaign: Pick<Campaign,"slug"|"title"|"status">;
  available: Need[];
  open: (kind: "cash"|"goods", itemId?: number) => void;
};
const GivingContext = createContext<GivingControls | null>(null);

export function GiveActions() {
  const controls=useContext(GivingContext);
  if (!controls) return null;
  const {campaign,available,open}=controls;
  return <div className="give-actions">
    {campaign.status==="active" && <button type="button" className="button" onClick={()=>open("cash")}><Heart size={18}/> Ủng hộ tiền</button>}
    {campaign.status==="active" && available.length>0 && <button type="button" className="button outline" onClick={()=>open("goods")}><Package size={18}/> Góp hiện vật</button>}
    <Share path={`/chien-dich/${campaign.slug}`} title={campaign.title}/>
  </div>;
}

export function GiveNeedButton({id,name}: {id:number;name:string}) {
  const controls=useContext(GivingContext);
  if (!controls || !controls.available.some(item=>item.id===id)) return null;
  return <button type="button" className="button outline" aria-label={`Góp ${name.toLocaleLowerCase("vi")}`} onClick={()=>controls.open("goods",id)}>Góp món này</button>;
}

export function Give({campaign, needs, initialNeed, children}: {campaign:GivingControls["campaign"];needs:Need[];initialNeed?:number;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const dialogTitle=useId();
  const router=useRouter();
  const [kind,setKind]=useState<"cash"|"goods">("cash");
  const [needId,setNeedId]=useState(initialNeed ?? needs[0]?.id ?? 0);
  const [amount,setAmount]=useState("50000");
  const [anonymous,setAnonymous]=useState(true);
  const [gift,setGift]=useState<Receipt>();
  const [qr,setQr]=useState<string>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [dialogOpen,setDialogOpen]=useState(false);
  const availableNeeds=campaign.status==="active" ? needs.filter(n=>n.target-n.received-n.pledged>0) : [];
  const selected=availableNeeds.find(n=>n.id===needId) ?? availableNeeds[0];
  const open=(next:"cash"|"goods", itemId?:number)=>{
    if (busy) return;
    if (itemId) setNeedId(itemId);
    setKind(next);setGift(undefined);setQr(undefined);setError("");setAmount(next==="cash"?"50000":"1");
    dialog.current?.showModal();
    setDialogOpen(true);
  };
  const directNeed=useRef<number | undefined>(undefined);
  useEffect(()=>{
    if (!initialNeed || directNeed.current===initialNeed || campaign.status!=="active") return;
    if (!needs.some(item=>item.id===initialNeed && item.target>item.received+item.pledged)) return;
    directNeed.current=initialNeed;
    setNeedId(initialNeed);setKind("goods");setAmount("1");setGift(undefined);setQr(undefined);setError("");
    dialog.current?.showModal();
    setDialogOpen(true);
  },[initialNeed,campaign.status,needs]);
  const pendingCode=dialogOpen && gift?.kind==="cash" && gift.status==="pending" ? gift.code : undefined;
  useEffect(()=>{
    if (!pendingCode) return;
    const controller=new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        const result=await api<{gift:Receipt}>({action:"lookup",code:pendingCode},controller.signal);
        if (controller.signal.aborted) return;
        if (result.gift.status==="confirmed") {
          setGift(result.gift);
          router.refresh();
          return;
        }
      } catch {
        // The donor can still confirm manually after a brief network failure.
      }
      if (!controller.signal.aborted) timer=setTimeout(check,3000);
    }
    timer=setTimeout(check,3000);
    return ()=>{ controller.abort();clearTimeout(timer); };
  },[pendingCode,router]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");
    const form=new FormData(event.currentTarget);
    try {
      const result=await api<{gift:Receipt;qr?:string}>({action:"contribute",slug:campaign.slug,kind,amount:Number(amount),needId:kind==="goods"?selected?.id:undefined,anonymous,name:form.get("name")??undefined,note:form.get("note")??undefined});
      setGift(result.gift);setQr(result.qr);router.refresh();
    } catch (err) {setError(getError(err));} finally {setBusy(false);}
  }
  async function confirm() {
    if (!gift) return;
    setBusy(true);setError("");
    try { const r=await api<{receipt:Receipt}>({action:"confirm",code:gift.code});setGift(r.receipt);router.refresh(); }
    catch(err){setError(getError(err));}finally{setBusy(false);}
  }
  return <GivingContext.Provider value={{campaign,available:availableNeeds,open}}>
    {children}
    <dialog ref={dialog} className="dialog" aria-labelledby={dialogTitle} onClose={()=>setDialogOpen(false)}>
      <div className="dialog-head"><h2 id={dialogTitle} aria-live="polite">{gift?.status==="confirmed" || gift?.kind==="goods" ? "Cảm ơn bạn" : kind==="cash" ? "Ủng hộ bằng tiền" : "Đăng ký góp hiện vật"}</h2><button type="button" className="icon" onClick={()=>dialog.current?.close()} aria-label="Đóng"><X/></button></div>
      {gift ? <>
        <ReceiptView gift={gift}/>
        {gift.kind==="cash" && gift.status==="pending" ? <div className="qr">
          {qr && <img width="210" height="210" src={qr} alt="QR mở phiếu giao dịch mô phỏng"/>}
          <p>Quét QR để mở phiếu demo. Màn hình này tự cập nhật sau khi phiếu được xác nhận.</p>
          <button className="button" onClick={confirm} disabled={busy}>Xác nhận giao dịch demo</button>
        </div> : <div className="row"><Share path={`/chien-dich/${campaign.slug}`} title={campaign.title}/><button className="button" onClick={()=>dialog.current?.close()}><Check size={16}/> Hoàn tất</button></div>}
        <a href={`/tra-cuu?ma=${gift.code}`}>Mở trang tra cứu</a>
      </> : <form className="form" onSubmit={submit}>
        {kind==="cash" ? <>
          <div className="quick">{[20000,50000,100000,200000,500000].map(n=><button key={n} type="button" aria-pressed={Number(amount)===n} onClick={()=>setAmount(String(n))}>{n/1000}k</button>)}</div>
          <label>Số tiền tùy ý (₫)<input type="number" min={1000} max={1_000_000_000} value={amount} onChange={e=>setAmount(e.target.value)} required/></label>
          <label className="check"><input type="checkbox" checked={anonymous} onChange={e=>setAnonymous(e.target.checked)}/> Ủng hộ ẩn danh</label>
          {!anonymous && <label>Tên hiển thị<input name="name" maxLength={60} required/></label>}
          <label>Lời nhắn công khai (tùy chọn)<textarea name="note" maxLength={240}/></label>
        </> : <>
          <label>Hiện vật<select value={selected?.id} onChange={e=>setNeedId(Number(e.target.value))}>{availableNeeds.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
          {selected && <><label>Số lượng ({selected.unit})<input type="number" min={1} max={selected.target-selected.received-selected.pledged} value={amount} onChange={e=>setAmount(e.target.value)} required/></label><p>Còn nhận hẹn {selected.target-selected.received-selected.pledged} {selected.unit}. {selected.handoff}</p></>}
        </>}
        <button className="button" disabled={busy || (kind==="goods" && !selected)}>{busy?"Đang xử lý…":kind==="cash"?"Tạo QR demo":"Đăng ký bàn giao"}</button>
      </form>}
      {error && <p className="error" role="alert">{error}</p>}
    </dialog>
  </GivingContext.Provider>;
}

export function Lookup({initialCode}: {initialCode:string}) {
  const [code,setCode]=useState(initialCode);
  const [gift,setGift]=useState<Receipt>();
  const [error,setError]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    if (!/^[a-f0-9]{32}$/.test(initialCode)) return;
    const controller=new AbortController();
    setBusy(true);
    api<{gift:Receipt}>({action:"lookup",code:initialCode},controller.signal)
      .then(result=>{ if (!controller.signal.aborted) setGift(result.gift); })
      .catch(err=>{ if (!controller.signal.aborted) setError(getError(err)); })
      .finally(()=>{ if (!controller.signal.aborted) setBusy(false); });
    return ()=>controller.abort();
  },[initialCode]);
  async function process(confirm=false) {
    setBusy(true);setError("");setStatus("");
    if (!confirm) setGift(undefined);
    try {
      if (confirm && gift) {
        const r=await api<{receipt:Receipt;duplicate:boolean}>({action:"confirm",code:gift.code});
        setGift(r.receipt);setStatus(r.duplicate?"Giao dịch đã được ghi nhận trước đó.":"Đã ghi nhận khoản ủng hộ demo.");
      } else setGift((await api<{gift:Receipt}>({action:"lookup",code:code.trim().toLowerCase()})).gift);
    }catch(err){setError(getError(err));}finally{setBusy(false);}
  }
  return <><form className="form" onSubmit={event=>{event.preventDefault();void process();}}><label>Mã tra cứu<input value={code} onChange={e=>setCode(e.target.value)} required autoComplete="off" spellCheck={false}/></label><button disabled={busy} className="button">{busy?"Đang xử lý…":"Tra cứu"}</button></form>
    {gift && <><ReceiptView gift={gift}/>{gift.kind==="cash" && gift.status==="pending" && <button className="button" disabled={busy} onClick={()=>void process(true)}>Xác nhận giao dịch demo</button>}</>}
    {error && <p className="error" role="alert">{error}</p>}<p role="status">{status}</p></>;
}

export function Matcher({titles}: {titles:Record<string,string>}) {
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState<{topics:{id:string;label:string}[];goods:(Need & {available:number})[]}>();
  async function suggest(text: string) {
    setQuery(text);setBusy(true);setError("");setResult(undefined);
    try { setResult(await api({action:"match",query:text})); }
    catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  }
  return <section className="ai-box" id="tim-cach-gop"><div><span className="ai-icon"><Sparkles size={24}/></span><h2>Bạn có gì để góp?</h2><p>AI gợi ý nơi đang cần món đồ của bạn, dựa trên số lượng còn nhận.</p></div>
    <form className="form" onSubmit={e=>{e.preventDefault();void suggest(query);}}>
      <label>Bạn muốn góp gì?<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={220} required placeholder="Ví dụ: Mình có 15 bộ dụng cụ học tập"/></label>
      <button className="button" disabled={busy}>{busy?"Đang tìm…":"Gợi ý bằng AI"}</button>
      <div className="ai-examples" aria-label="Gợi ý để thử">{["Mình có 15 bộ dụng cụ học tập","Mình có gạo đóng túi","Mình muốn góp tiền"].map(text=><button key={text} type="button" disabled={busy} onClick={()=>void suggest(text)}>{text}</button>)}</div>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {result && <div className="ai-result" aria-live="polite">
      {result.goods.map(item=><a key={item.id} href={`/chien-dich/${item.slug}?mon=${item.id}#gop`}><b>{item.name}</b><span>{titles[item.slug]} · có thể đăng ký thêm {item.available} {item.unit}</span><span className="ai-result-action">Đăng ký góp</span></a>)}
      {result.topics.some(t=>t.id==="money") && <a href="#chien-dich"><b>Ủng hộ bằng tiền</b><span>Chọn chiến dịch để tạo QR demo.</span></a>}
      {!result.goods.length && !result.topics.some(t=>t.id==="money") && <p>Chưa tìm được nhu cầu phù hợp. Bạn có thể <a href="#chien-dich">xem các chiến dịch</a> hoặc mô tả rõ tên món đồ.</p>}
    </div>}
  </section>;
}
