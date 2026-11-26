export const savedReceiptLimit=12;
export type SavedReceiptKind="cash"|"goods"|"volunteer";
export type SavedReceipt={code:string;kind:SavedReceiptKind};

function readEntry(raw:unknown):SavedReceipt|null {
  if(!raw||typeof raw!=="object") return null;
  const {code,kind}=raw as {code?:unknown;kind?:unknown};
  if(typeof code!=="string"||!/^[a-f0-9]{32}$/.test(code)) return null;
  if(kind!=="cash"&&kind!=="goods"&&kind!=="volunteer") return null;
  return {code,kind};
}

export function readSavedReceipts(serialized:string|null):SavedReceipt[] {
  if(!serialized) return [];
  let values:unknown;
  try {values=JSON.parse(serialized);} catch {return [];}
  if(!Array.isArray(values)) return [];
  const entries=new Map<string,SavedReceipt>();
  for(const value of values) {
    const entry=readEntry(value);
    if(entry&&!entries.has(entry.code)) entries.set(entry.code,entry);
    if(entries.size===savedReceiptLimit) break;
  }
  return [...entries.values()];
}

export function editSavedReceipts(serialized:string|null,entry:SavedReceipt,save:boolean):SavedReceipt[] {
  const list=readSavedReceipts(serialized);
  if(!save) return list.filter(item=>item.code!==entry.code);
  if(list.some(item=>item.code===entry.code)) return list;
  if(list.length>=savedReceiptLimit) throw new Error(`Đã lưu ${savedReceiptLimit} phiếu. Hãy bỏ lưu một phiếu trước.`);
  const validated=readEntry(entry);
  if(!validated) throw new Error("Mã phiếu chưa hợp lệ.");
  return [validated,...list];
}
