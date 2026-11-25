"use client";

import { useState } from "react";
import { ArrowUpRight, CalendarDays, Heart, Package, SlidersHorizontal, Sparkles } from "lucide-react";
import { api } from "./client";
import { days, emptyAssistFilters, giveModes, goodsTopics, parts, units, type AssistFilters, type AssistResult } from "../lib/assist";
import { money, vietnamTime } from "../lib/domain";

const modeLabels={goods:"Hiện vật",volunteer:"Tình nguyện",cash:"Tiền mô phỏng"};
const topicLabels={learning:"Đồ dùng học tập",cleaning:"Vật tư vệ sinh",food:"Thực phẩm",blankets:"Chăn ấm"};
const dayLabels={any:"Ngày nào cũng được",today:"Hôm nay",tomorrow:"Ngày mai",weekend:"Cuối tuần gần nhất",mon:"Thứ Hai tới",tue:"Thứ Ba tới",wed:"Thứ Tư tới",thu:"Thứ Năm tới",fri:"Thứ Sáu tới",sat:"Thứ Bảy tới",sun:"Chủ nhật tới"};
const partLabels={any:"Buổi nào cũng được",morning:"Sáng",afternoon:"Chiều",evening:"Tối"};
const examples=[
  {label:"Có 15 bộ dụng cụ học tập",query:"Mình có 15 bộ dụng cụ học tập ở Quảng Nam"},
  {label:"Muốn góp đồ và phụ đóng gói",query:"Mình có 15 bộ dụng cụ học tập ở Quảng Nam và muốn phụ đóng gói"},
  {label:"Góp 200k ở Đà Nẵng",query:"Mình muốn góp 200k ở Đà Nẵng"},
];

export function GivingAssistant({locations}: {locations:string[]}) {
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [show,setShow]=useState(false);
  const [filters,setFilters]=useState<AssistFilters>(emptyAssistFilters);
  const [result,setResult]=useState<AssistResult>();
  const [dirty,setDirty]=useState(false);
  function edit(changes:Partial<AssistFilters>) {setFilters(current=>({...current,...changes}));setDirty(true);}
  async function search(input:{source:"query";query:string}|{source:"filters";filters:AssistFilters}) {
    if(busy) return;
    if(input.source==="query") setQuery(input.query);
    setBusy(true);setError("");setResult(undefined);
    try {
      const next=await api<AssistResult>({action:"assist",input});
      setFilters(next.filters);setResult(next);setShow(next.needsTime||!next.filters.modes.length);setDirty(false);
    } catch(err) {setError(err instanceof Error?err.message:"Chưa tìm được gợi ý.");}
    finally {setBusy(false);}
  }
  const found=result&&(result.goods.length+result.volunteer.length+result.cash.length);
  const hasQuery=query.trim().length>0;

  return <section className="giving-assistant" id="tim-cach-gop" aria-labelledby="giving-assistant-heading">
    <div className="giving-assistant-header">
      <span className="assistant-icon"><Sparkles size={22} aria-hidden="true"/> Trợ lý Góp Sức</span>
      <h2 id="giving-assistant-heading">Tìm cách góp phù hợp</h2>
      <p>Kể bạn có gì, ở đâu hoặc rảnh khi nào. Trợ lý tìm hiện vật đang cần, ca còn chỗ và chiến dịch nhận góp tiền mô phỏng.</p>
    </div>
    <div className="giving-assistant-main">
      <form className="form" onSubmit={event=>{event.preventDefault();void search({source:"query",query:query.trim()});}}>
        <label>Bạn muốn góp thế nào?<textarea value={query} onChange={event=>setQuery(event.target.value)} disabled={busy} maxLength={220} rows={2} required placeholder="Ví dụ: Mình có 15 bộ dụng cụ học tập ở Quảng Nam, cũng muốn phụ đóng gói"/></label>
        <div className="row"><button className="button" disabled={busy||!hasQuery}><Sparkles size={16} aria-hidden="true"/>{busy?"Đang đối chiếu…":"Tìm gợi ý"}</button>
          <button type="button" className="button outline" onClick={()=>setShow(current=>!current)} aria-expanded={show} aria-controls={show?"assist-filters":undefined}><SlidersHorizontal size={16} aria-hidden="true"/>{show?"Ẩn điều kiện":result?"Sửa điều kiện":"Tự chọn điều kiện"}</button>
        </div>
        <div className="ai-examples" aria-label="Câu ví dụ">{examples.map(example=><button key={example.label} type="button" disabled={busy} onClick={()=>void search({source:"query",query:example.query})}>{example.label}</button>)}</div>
      </form>
      <div className="assistant-announcement" role="status" aria-live="polite">
        {busy?"Đang kiểm tra dữ liệu chiến dịch…":result&&!dirty?found?`Tìm thấy ${found} gợi ý.`:"Chưa có kết quả phù hợp với điều kiện.":null}
      </div>
      {error&&<p className="error" role="alert">{error} Bạn vẫn có thể <a href="#chien-dich">xem danh sách chiến dịch</a>.</p>}
      {result&&!dirty&&result.filters.modes.length>0&&!show&&<ul className="assistant-tags" aria-label="Điều kiện đã hiểu">
        {result.filters.items.map(item=><li key={item.topic}>{topicLabels[item.topic]}{item.quantity&&item.unit?` · ${item.quantity} ${item.unit}`:""}</li>)}
        {result.filters.location&&<li>{result.filters.location}</li>}
        {result.filters.modes.includes("volunteer")&&<li>{result.filters.role||"Tình nguyện"}{result.filters.date?` · ${result.filters.date.split("-").reverse().join("/")}`:result.filters.day!=="any"?` · ${dayLabels[result.filters.day]}`:""}{result.filters.part!=="any"?` · ${partLabels[result.filters.part]}`:""}</li>}
        {result.filters.modes.includes("cash")&&<li>{result.filters.money?`${money(result.filters.money)} mô phỏng`:"Tiền mô phỏng"}</li>}
      </ul>}
      {result&&!dirty&&!show&&result.notes.map(note=><p className="assistant-note" key={note}>{note}</p>)}
      {show&&<form className="assistant-filters form" id="assist-filters" onSubmit={e=>{e.preventDefault();void search({source:"filters",filters});}}>
        <div><h3>{result?"Điều kiện đã hiểu":"Chọn điều kiện của bạn"}</h3><p>Sửa bất kỳ điều kiện nào rồi bấm tìm lại.</p></div>
        {!dirty&&result?.notes.map(note=><p className="assistant-note" key={note}>{note}</p>)}
        <fieldset disabled={busy}><legend>Cách muốn góp</legend><div className="assistant-mode-row">{giveModes.map(mode=><label key={mode}><input type="checkbox" checked={filters.modes.includes(mode)} onChange={e=>edit({modes:e.target.checked?[...filters.modes,mode]:filters.modes.filter(x=>x!==mode)})}/>{modeLabels[mode]}</label>)}</div></fieldset>
        <label>Khu vực<input value={filters.location} maxLength={60} list="assist-locations" placeholder="Bất kỳ khu vực nào" onChange={e=>edit({location:e.target.value})}/></label>
        <datalist id="assist-locations">{locations.map(location=><option key={location} value={location}/>)}</datalist>
        {filters.modes.includes("goods")&&<fieldset disabled={busy}><legend>Hiện vật bạn có</legend>
          {filters.items.map((item,i)=><div className="assistant-item" key={i}>
            <label>Nhóm hiện vật<select value={item.topic} onChange={e=>edit({items:filters.items.map((x,j)=>i===j?{...x,topic:e.target.value as typeof item.topic}:x)})}>{goodsTopics.map(topic=><option value={topic} key={topic} disabled={filters.items.some((other,j)=>j!==i&&other.topic===topic)}>{topicLabels[topic]}</option>)}</select></label>
            <label>Số lượng<input type="number" min={1} max={100_000} value={item.quantity??""} onChange={e=>edit({items:filters.items.map((x,j)=>i===j?{...x,quantity:e.target.value?Number(e.target.value):null}:x)})}/></label>
            <label>Đơn vị<select value={item.unit} onChange={e=>edit({items:filters.items.map((x,j)=>i===j?{...x,unit:e.target.value as typeof item.unit}:x)})}>{units.map(unit=><option value={unit} key={unit}>{unit||"Bất kỳ"}</option>)}</select></label>
            <button type="button" aria-label={`Bỏ nhóm hiện vật ${i+1}`} className="button outline" onClick={()=>edit({items:filters.items.filter((_,j)=>i!==j)})}>Bỏ</button>
          </div>)}
          {filters.items.length<4&&<button type="button" className="button outline" onClick={()=>edit({items:[...filters.items,{topic:goodsTopics.find(topic=>!filters.items.some(item=>item.topic===topic))??"learning",quantity:null,unit:""}]})}>Thêm nhóm hiện vật</button>}
        </fieldset>}
        {filters.modes.includes("volunteer")&&<fieldset disabled={busy}><legend>Lịch tình nguyện (giờ Việt Nam)</legend>
          <div className="assistant-schedule"><label>Ngày<select value={filters.day} onChange={e=>edit({day:e.target.value as AssistFilters["day"],date:""})}>{days.map(day=><option key={day} value={day}>{dayLabels[day]}</option>)}</select></label>
          <label>Buổi<select value={filters.part} onChange={e=>edit({part:e.target.value as AssistFilters["part"]})}>{parts.map(part=><option key={part} value={part}>{partLabels[part]}</option>)}</select></label></div>
          <label>Hoặc một ngày cụ thể<input type="date" value={filters.date} onChange={e=>edit({date:e.target.value,day:"any"})}/></label>
          <label>Công việc<input value={filters.role} maxLength={40} placeholder="Ví dụ: đóng gói" onChange={e=>edit({role:e.target.value})}/></label>
        </fieldset>}
        {filters.modes.includes("cash")&&<label>Số tiền mô phỏng (₫)<input type="number" min={1000} max={1_000_000_000} value={filters.money??""} onChange={e=>edit({money:e.target.value?Number(e.target.value):null})}/></label>}
        <button className="button" disabled={busy||!filters.modes.length}>Tìm theo điều kiện</button>
      </form>}
      {result&&!dirty&&<div className="assistant-results">
        {result.goods.length>0&&<section aria-label="Hiện vật phù hợp"><h3><Package size={18} aria-hidden="true"/> Nơi đang nhận hiện vật</h3><div className="assistant-cards">{result.goods.map(item=>{
          const params=new URLSearchParams({mon:String(item.id)});
          if(item.suggested!==null) params.set("soLuong",String(item.suggested));
          return <a key={item.id} href={`/chien-dich/${item.campaign.slug}?${params}#gop`}><strong>{item.name}</strong><span>{item.campaign.title} · {item.campaign.location}</span>
            <b>{item.suggested!==null?item.suggested===item.requested?`Nhận đủ ${item.suggested} ${item.unit}`:`Nhận được ${item.suggested}/${item.requested} ${item.unit}`:`Còn nhận ${item.available} ${item.unit}`}</b><small>{item.handoff}</small><span className="assistant-cta">Mở biểu mẫu góp <ArrowUpRight size={16} aria-hidden="true"/></span></a>;
        })}</div></section>}
        {result.volunteer.length>0&&<section aria-label="Ca tình nguyện phù hợp"><h3><CalendarDays size={18} aria-hidden="true"/> Ca còn chỗ</h3><div className="assistant-cards">{result.volunteer.map(shift=><a key={shift.id} href={`/chien-dich/${shift.campaign.slug}?ca=${shift.id}#tinh-nguyen`}><strong>{shift.title}</strong><span>{shift.campaign.title}</span><b>{vietnamTime(shift.startsAt)} · Còn {shift.available} chỗ</b><small>{shift.location}</small><span className="assistant-cta">Xem và giữ chỗ <ArrowUpRight size={16} aria-hidden="true"/></span></a>)}</div></section>}
        {result.cash.length>0&&<section aria-label="Chiến dịch nhận tiền mô phỏng"><h3><Heart size={18} aria-hidden="true"/> Góp tiền mô phỏng</h3><div className="assistant-cards">{result.cash.map(item=><a key={item.campaign.slug} href={`/chien-dich/${item.campaign.slug}?gop=tien${item.amount?`&soTien=${item.amount}`:""}#gop`}><strong>{item.campaign.title}</strong><span>{item.campaign.location}</span><b>{item.remaining?`Còn ${money(item.remaining)} đến mục tiêu`:"Đã đạt mục tiêu tiền"}</b><span className="assistant-cta">{item.amount?`Mở biểu mẫu ${money(item.amount)}`:"Mở biểu mẫu QR mô phỏng"} <ArrowUpRight size={16} aria-hidden="true"/></span></a>)}</div></section>}
        {result.filters.modes.includes("goods")&&!result.goods.length&&<p>Chưa có hiện vật còn nhận khớp nhóm, đơn vị và khu vực đã chọn.</p>}
        {result.filters.modes.includes("volunteer")&&!result.volunteer.length&&!result.needsTime&&<p>Chưa có ca còn chỗ khớp khu vực, lịch và công việc đã chọn.</p>}
        {result.filters.modes.includes("cash")&&!result.cash.length&&<p>Chưa có chiến dịch đang nhận tiền mô phỏng ở khu vực đã chọn.</p>}
        {!result.filters.modes.length&&<p>Chưa xác định được cách bạn muốn góp. Hãy chọn một cách ở trên hoặc <a href="#chien-dich">duyệt chiến dịch</a>.</p>}
      </div>}
    </div>
  </section>;
}
