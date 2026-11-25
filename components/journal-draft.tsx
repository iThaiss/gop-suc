"use client";

import { useRef, useState } from "react";
import { PencilLine } from "lucide-react";

export function JournalDraftFields({draft}: {draft:{title:string;body:string}}) {
  const title=useRef<HTMLInputElement>(null);
  const body=useRef<HTMLTextAreaElement>(null);
  const [message,setMessage]=useState("");
  function fill() {
    if(!title.current||!body.current) return;
    if(title.current.value.trim()||body.current.value.trim()) {
      setMessage("Giữ nguyên nội dung bạn đang viết. Xóa hai ô nếu muốn dùng bản nháp từ số liệu.");
      return;
    }
    title.current.value=draft.title;
    body.current.value=draft.body;
    setMessage("Đã điền bản nháp, chưa đăng. Hãy kiểm tra và bổ sung nội dung bàn giao trước khi công bố.");
    title.current.focus();
  }
  return <>
    <div className="journal-draft-tip"><button type="button" className="button outline" onClick={fill}><PencilLine size={16} aria-hidden="true"/> Soạn nháp từ số liệu</button>
      <small role="status">{message || "Dựa trên thu chi và hiện vật đã ghi nhận. Bạn có thể sửa trước khi đăng."}</small>
    </div>
    <label>Tiêu đề<input ref={title} name="title" maxLength={100} required/></label>
    <label>Nội dung<textarea ref={body} name="body" maxLength={900} required/></label>
  </>;
}
