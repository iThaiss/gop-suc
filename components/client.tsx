"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Copy, Heart, Package, Share2, X } from "lucide-react";
import { FacebookShareButton } from "react-share";
import { money, vietnamTime, type Campaign, type CampaignImpact, type Need, type Receipt, type VolunteerBooking } from "../lib/domain";
import { receiptAccessFromFragment, receiptPath } from "../lib/receipt-access";
import { ReceiptImpact } from "./receipt-impact";
import { PrivateReceiptLink } from "./private-receipt-link";
import { CalendarLink } from "./calendar-link";

export async function api<T>(data: object | FormData, signal?: AbortSignal): Promise<T> {
  const result = await fetch("/api/gopsuc",{
    method:"POST", signal,
    ...(data instanceof FormData ? {body:data} : {headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)}),
  });
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
    {gift.kind==="goods" && gift.status==="confirmed" && gift.actual!==null && gift.actual<gift.amount &&
      <small>Đã hẹn {gift.amount} {gift.unit} · Chênh lệch {gift.amount-gift.actual} {gift.unit} không được tính là đã nhận.</small>}
    {gift.status==="pending" && gift.handoff && <span>{gift.handoff}</span>}
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

export function Give({campaign, needs, initialNeed, initialAmount, initialCash, children}: {campaign:GivingControls["campaign"];needs:Need[];initialNeed?:number;initialAmount?:number;initialCash?:number|null;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const dialogTitle=useId();
  const router=useRouter();
  const [kind,setKind]=useState<"cash"|"goods">("cash");
  const [needId,setNeedId]=useState(initialNeed ?? needs[0]?.id ?? 0);
  const [amount,setAmount]=useState("50000");
  const [anonymous,setAnonymous]=useState(true);
  const [gift,setGift]=useState<Receipt>();
  const [qr,setQr]=useState<string>();
  const [actionToken,setActionToken]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [dialogOpen,setDialogOpen]=useState(false);
  const availableNeeds=campaign.status==="active" ? needs.filter(n=>n.target-n.received-n.pledged>0) : [];
  const selected=availableNeeds.find(n=>n.id===needId) ?? availableNeeds[0];
  const open=(next:"cash"|"goods", itemId?:number)=>{
    if (busy) return;
    if (itemId) setNeedId(itemId);
    setKind(next);setGift(undefined);setQr(undefined);setActionToken(null);setError("");setAmount(next==="cash"?"50000":"1");
    dialog.current?.showModal();
    setDialogOpen(true);
  };
  const directNeed=useRef<string | undefined>(undefined);
  const directCash=useRef<number|null|undefined>(undefined);
  useEffect(()=>{
    if(initialCash===undefined||initialCash===directCash.current||campaign.status!=="active") return;
    directCash.current=initialCash;
    setKind("cash");setAmount(String(initialCash??50_000));setGift(undefined);setQr(undefined);setActionToken(null);setError("");
    dialog.current?.showModal();setDialogOpen(true);
  },[initialCash,campaign.status]);
  useEffect(()=>{
    const key=[initialNeed,initialAmount].join(":");
    if (initialCash!==undefined || !initialNeed || directNeed.current===key || campaign.status!=="active") return;
    const item=needs.find(item=>item.id===initialNeed);
    if (!item) return;
    const remaining=item.target-item.received-item.pledged;
    if (remaining<=0) return;
    directNeed.current=key;
    setNeedId(initialNeed);setKind("goods");setAmount(String(Math.min(initialAmount??1,remaining)));setGift(undefined);setQr(undefined);setActionToken(null);setError("");
    dialog.current?.showModal();
    setDialogOpen(true);
  },[initialNeed,initialAmount,initialCash,campaign.status,needs]);
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
      const result=await api<{gift:Receipt;qr:string|null;actionToken:string|null}>({action:"contribute",slug:campaign.slug,kind,amount:Number(amount),needId:kind==="goods"?selected?.id:undefined,anonymous,name:form.get("name")??undefined,note:form.get("note")??undefined});
      setGift(result.gift);setQr(result.qr??undefined);setActionToken(result.actionToken);router.refresh();
    } catch (err) {setError(getError(err));} finally {setBusy(false);}
  }
  async function confirm() {
    if (!gift || !actionToken) return;
    setBusy(true);setError("");
    try { const r=await api<{receipt:Receipt}>({action:"confirm",code:gift.code,actionToken});setGift(r.receipt);router.refresh(); }
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
          <p>Quét QR riêng để xác nhận phiếu demo trên thiết bị khác. Màn hình này sẽ tự cập nhật.</p>
          <button className="button" onClick={confirm} disabled={busy||!actionToken}>Xác nhận giao dịch demo</button>
          {actionToken&&<PrivateReceiptLink code={gift.code} actionToken={actionToken} label="Mở phiếu để xác nhận"/>}
        </div> : <div className="row"><a className="button" href={`/tra-cuu?ma=${gift.code}`}>Mở phiếu và theo dõi</a><Share path={`/chien-dich/${campaign.slug}`} title={campaign.title}/></div>}
      </> : <form className="form" onSubmit={submit}>
        {kind==="cash" ? <>
          <div className="quick">{[20000,50000,100000,200000,500000].map(n=><button key={n} type="button" aria-pressed={Number(amount)===n} onClick={()=>setAmount(String(n))}>{n/1000}k</button>)}</div>
          <label>Số tiền tùy ý (₫)<input type="number" min={1000} max={1_000_000_000} value={amount} onChange={e=>setAmount(e.target.value)} required/></label>
          <label className="check"><input type="checkbox" checked={anonymous} onChange={e=>setAnonymous(e.target.checked)}/> Ủng hộ ẩn danh</label>
          {!anonymous && <label>Tên hiển thị<input name="name" maxLength={60} required/></label>}
          <label>Lời nhắn công khai (tùy chọn)<textarea name="note" maxLength={240}/></label>
        </> : <>
          <label>Hiện vật<select value={selected?.id} onChange={e=>{setNeedId(Number(e.target.value));setAmount("1");}}>{availableNeeds.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
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
  const [booking,setBooking]=useState<VolunteerBooking>();
  const [impact,setImpact]=useState<CampaignImpact | null>();
  const [error,setError]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [access,setAccess]=useState<{code:string;token:string}>();
  const lastLinkAccess=useRef<{code:string;token:string}|null>(null);
  type LookupResult = {gift?:Receipt;booking?:VolunteerBooking;impact:CampaignImpact | null};
  useEffect(()=>{
    if (!/^[a-f0-9]{32}$/.test(initialCode)) return;
    const fragment=window.location.hash;
    const token=receiptAccessFromFragment(fragment);
    if (token) {
      const current={code:initialCode,token};
      lastLinkAccess.current=current;
      setAccess(current);
      try {sessionStorage.setItem(`gopsuc-access:${initialCode}`,token);} catch {}
    } else if (lastLinkAccess.current?.code===initialCode) {
      setAccess(lastLinkAccess.current);
    } else {
      setAccess(savedReceiptAccess(initialCode));
    }
    if (fragment.startsWith("#k=")) window.history.replaceState(window.history.state,"",receiptPath(initialCode));
    const controller=new AbortController();
    setBusy(true);
    api<LookupResult>({action:"lookup",code:initialCode,withImpact:true},controller.signal)
      .then(result=>{ if (!controller.signal.aborted) {setGift(result.gift);setBooking(result.booking);setImpact(result.impact);} })
      .catch(err=>{ if (!controller.signal.aborted) setError(getError(err)); })
      .finally(()=>{ if (!controller.signal.aborted) setBusy(false); });
    return ()=>controller.abort();
  },[initialCode]);
  async function process(confirm=false) {
    setBusy(true);setError("");setStatus("");
    if (!confirm) {setGift(undefined);setBooking(undefined);setImpact(undefined);}
    try {
      if (confirm && gift && access?.code===gift.code) {
        const r=await api<{receipt:Receipt;duplicate:boolean}>({action:"confirm",code:gift.code,actionToken:access.token});
        setGift(r.receipt);setStatus(r.duplicate?"Giao dịch đã được ghi nhận trước đó.":"Đã ghi nhận khoản ủng hộ demo.");
        setImpact(undefined);
        const latest=await api<LookupResult>({action:"lookup",code:gift.code,withImpact:true}).catch(()=>null);
        setImpact(latest?.impact);
      } else {
        const requested=code.trim().toLowerCase();
        setAccess(lastLinkAccess.current?.code===requested ? lastLinkAccess.current : savedReceiptAccess(requested));
        const result=await api<LookupResult>({action:"lookup",code:requested,withImpact:true});
        setGift(result.gift);setBooking(result.booking);setImpact(result.impact);
      }
    }catch(err){setError(getError(err));}finally{setBusy(false);}
  }
  return <><form className="form" onSubmit={event=>{event.preventDefault();void process();}}><label>Mã tra cứu<input value={code} onChange={e=>setCode(e.target.value)} required autoComplete="off" spellCheck={false}/></label><button disabled={busy} className="button">{busy?"Đang xử lý…":"Tra cứu"}</button></form>
    {gift && <><ReceiptView gift={gift}/>{gift.kind==="cash" && gift.status==="pending" && (access?.code===gift.code ? <button className="button" disabled={busy} onClick={()=>void process(true)}>Xác nhận giao dịch demo</button> : <p>Phiếu chỉ xem. Hãy quét QR riêng hoặc mở liên kết thao tác đã lưu để xác nhận.</p>)}</>}
    {booking && <><div className="ticket"><strong>{booking.title}</strong><span>{vietnamTime(booking.startsAt)} · {booking.location}</span><span>{booking.status==="booked"?"Đã giữ 1 chỗ":"Đã hủy giữ chỗ"}</span></div>
      {booking.status==="booked"&&Date.parse(booking.startsAt)>Date.now()&&<CalendarLink slug={booking.slug} shiftId={booking.shiftId}/>}
      <a href={`/chien-dich/${booking.slug}#tinh-nguyen`}>Xem ca trên trang chiến dịch</a>
      {booking.status==="booked" && Date.parse(booking.startsAt)>Date.now() && (access?.code===booking.code ? <details className="cancel-booking"><summary>Hủy giữ chỗ</summary><p>Chỗ này sẽ được mở lại cho người khác.</p><button type="button" className="button outline" disabled={busy} onClick={async()=>{
        setBusy(true);setError("");setStatus("");
        try {
          const result=await api<{booking:VolunteerBooking}>({action:"cancelVolunteer",code:booking.code,actionToken:access.token});
          setBooking(result.booking);setStatus("Đã hủy giữ chỗ.");
        } catch(err) {setError(getError(err));} finally {setBusy(false);}
      }}>Xác nhận hủy</button></details> : <p>Phiếu chỉ xem. Mở liên kết thao tác đã lưu nếu bạn cần hủy giữ chỗ.</p>)}
    </>}
    {error && <p className="error" role="alert">{error}</p>}{status&&<p role="status">{status}</p>}
    {impact ? <ReceiptImpact impact={impact}/> : gift && <a href={`/chien-dich/${gift.slug}#nhat-ky`}>Xem nhật ký chiến dịch</a>}
  </>;
}

function savedReceiptAccess(code:string) {
  if (!/^[a-f0-9]{32}$/.test(code)) return undefined;
  try {
    const token=sessionStorage.getItem(`gopsuc-access:${code}`);
    if (token && /^[a-f0-9]{64}$/.test(token)) return {code,token};
  } catch {}
}
