import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { categories, covers } from "../../../lib/domain";
import { bookVolunteer, campaign, campaignImpact, campaigns, cancelVolunteer, confirmCash, contribute, all, get, manage, needs, receipt, ReceiptAccessError, RuleError, volunteerBooking, volunteerShifts } from "../../../lib/db";
import { receiptPath } from "../../../lib/receipt-access";
import { findMatches, topics } from "../../../lib/match";
import { assistMatches, days, giveModes, goodsTopics, parseAssist, parts, units, validDay } from "../../../lib/assist";
import { hash, sessionCookie as cookie, sessionRole } from "../../../lib/session";
import { encodeUpdateImage, readPhotoForm, UploadError } from "../../../lib/update-image";

export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value,{status,headers:{"Cache-Control":"no-store"}});
const string = (max: number) => z.string().trim().min(1).max(max);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(70);
const code = z.string().regex(/^[a-f0-9]{32}$/);
const actionToken = z.string().regex(/^[a-f0-9]{64}$/).optional();
const amount = z.number().int().min(1).max(1_000_000_000);
const manageCommon = {slug};
const campaignFields = {title:string(100),description:string(900),category:z.enum(categories),location:string(60),cover:z.enum(covers),goal:amount};
const updateSchema = z.object({action:z.literal("update"),slug,title:string(100),body:string(900),image:z.enum(["",...covers])});
const assistInput=z.discriminatedUnion("source",[
  z.object({source:z.literal("query"),query:string(220)}),
  z.object({source:z.literal("filters"),filters:z.object({
    modes:z.array(z.enum(giveModes)).max(3),location:z.string().trim().max(60),day:z.enum(days),date:z.string().refine(value=>!value||validDay(value)),part:z.enum(parts),role:z.string().trim().max(40),
    money:amount.min(1000).nullable(),items:z.array(z.object({topic:z.enum(goodsTopics),quantity:z.number().int().min(1).max(100_000).nullable(),unit:z.enum(units)})).max(4).refine(items=>new Set(items.map(item=>item.topic)).size===items.length),
  })}),
]);
const schema = z.discriminatedUnion("action",[
  z.object({action:z.literal("contribute"), slug, kind:z.enum(["cash","goods"]), amount, needId:z.number().int().positive().optional(), anonymous:z.boolean(), name:z.string().trim().max(60).optional(), note:z.string().trim().max(240).optional()}),
  z.object({action:z.literal("confirm"),code,actionToken}),
  z.object({action:z.literal("lookup"),code,withImpact:z.boolean().optional()}),
  z.object({action:z.literal("bookVolunteer"),slug,shiftId:z.number().int().positive()}),
  z.object({action:z.literal("cancelVolunteer"),code,actionToken}),
  z.object({action:z.literal("match"),query:string(220)}),
  z.object({action:z.literal("assist"),input:assistInput}),
  z.object({action:z.literal("login"),role:z.enum(["admin","organizer"]),password:string(200)}),
  z.object({action:z.literal("logout")}),
  z.object({action:z.literal("create"),...manageCommon,...campaignFields}),
  z.object({action:z.literal("editDraft"),...manageCommon,...campaignFields}),
  z.object({action:z.literal("publish"),...manageCommon}),
  z.object({action:z.literal("close"),...manageCommon}),
  z.object({action:z.literal("addShift"),slug,title:string(100),location:string(120),startLocal:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),capacity:z.number().int().min(1).max(1000)}),
  z.object({action:z.literal("need"),...manageCommon,name:string(100),unit:string(30),target:z.number().int().min(1).max(100_000),handoff:string(180),topic:z.enum(topics.map(t=>t.id).filter(id=>id!=="money"))}),
  updateSchema,
  z.object({action:z.literal("expense"),...manageCommon,title:string(100),amount,evidence:string(400)}),
  z.object({action:z.literal("receive"),...manageCommon,code,actual:z.number().int().min(1).max(100_000)}),
  z.object({action:z.literal("cancel"),...manageCommon,code}),
]);

async function rateLimit(request: NextRequest, action: string) {
  const identity = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
  const key = hash(`${identity}:${action}`).toString("hex");
  const now = Date.now();
  await all("DELETE FROM limits WHERE until<?",now);
  const row = await get(`
    INSERT INTO limits(key,count,until) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN limits.until<? THEN 1 ELSE limits.count+1 END,
    until=CASE WHEN limits.until<? THEN excluded.until ELSE limits.until END RETURNING count
  `,key,now + 60_000,now,now);
  return Number(row?.count) <= (action === "login" ? 8 : action === "bookVolunteer" ? 10 : action === "update-photo" ? 12 : action === "contribute" ? 20 : 60);
}

export async function POST(request: NextRequest) {
  const host = request.headers.get("host") || request.nextUrl.host;
  const expectedOrigin = new URL(process.env.SITE_URL || `${request.nextUrl.protocol}//${host}`).origin;
  if (request.headers.get("origin") !== expectedOrigin) return json({error:"Nguồn yêu cầu không hợp lệ."},403);
  const token = request.cookies.get(cookie)?.value;
  if (request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
    const role = await sessionRole(token);
    if (!role) return json({error:"Phiên đăng nhập đã hết hạn."},401);
    if (!await rateLimit(request,"update-photo")) return json({error:"Bạn thao tác quá nhanh. Thử lại sau một phút."},429);
    try {
      const form = await readPhotoForm(request);
      const post = updateSchema.safeParse(Object.fromEntries(form));
      const photos = form.getAll("photo");
      if (!post.success || photos.length!==1 || !(photos[0] instanceof File)) return json({error:"Kiểm tra lại nội dung và ảnh cập nhật."},400);
      const {slug: postSlug, action, ...fields} = post.data;
      const target = await campaign(postSlug);
      if (!target || (role!=="admin" && target.owner!==role)) return json({error:"Bạn không có quyền với chiến dịch này."},403);
      await manage(role,postSlug,action,fields,await encodeUpdateImage(photos[0]));
      return json({ok:true},201);
    } catch (error) {
      if (error instanceof UploadError) return json({error:error.message},error.status);
      if (error instanceof RuleError) return json({error:error.message},409);
      console.error("Góp Sức photo upload failed",error instanceof Error ? error.message : "");
      return json({error:"Chưa đăng được ảnh. Vui lòng thử lại."},500);
    }
  }
  let data: unknown;
  try {
    const source = await request.text();
    if (source.length > 6000) return json({error:"Yêu cầu quá dài."},413);
    data = JSON.parse(source);
  } catch {
    return json({error:"Yêu cầu không hợp lệ."},400);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) return json({error:"Kiểm tra lại dữ liệu đã nhập."},400);
  const input = parsed.data;
  if (!await rateLimit(request,input.action)) return json({error:"Bạn thao tác quá nhanh. Thử lại sau một phút."},429);
  try {
    switch (input.action) {
      case "contribute": {
        if (input.kind==="cash" && input.amount < 1000) return json({error:"Số tiền tối thiểu là 1.000 ₫."},400);
        if (!input.anonymous && input.kind==="cash" && !input.name) return json({error:"Nhập tên hiển thị hoặc chọn ẩn danh."},400);
        const {gift,actionToken} = await contribute({...input,name:input.anonymous || input.kind==="goods" ? undefined : input.name});
        const qr = actionToken ? await QRCode.toDataURL(new URL(receiptPath(gift.code,actionToken),expectedOrigin).href,{width:320,margin:4}) : null;
        return json({gift,qr,actionToken},201);
      }
      case "confirm": return json(await confirmCash(input.code,input.actionToken));
      case "lookup": {
        const gift=await receipt(input.code);
        if (gift) return json(input.withImpact ? {gift,impact:await campaignImpact(gift.slug)} : {gift});
        const booking=await volunteerBooking(input.code);
        if (!booking) return json({error:"Không tìm thấy mã tra cứu."},404);
        return json(input.withImpact ? {booking,impact:await campaignImpact(booking.slug)} : {booking});
      }
      case "bookVolunteer": return json(await bookVolunteer(input.slug,input.shiftId),201);
      case "cancelVolunteer": return json({booking:await cancelVolunteer(input.code,input.actionToken)});
      case "match": return json(findMatches(input.query,await needs()));
      case "assist": {
        const active=(await campaigns()).filter(campaign=>campaign.status==="active");
        const interpreted=input.input.source==="query" ? parseAssist(input.input.query,active.map(campaign=>campaign.location)) : {filters:input.input.filters,notes:[],needsTime:false};
        const {filters,needsTime}=interpreted;
        const [inventory,shifts]=await Promise.all([
          filters.modes.includes("goods")&&filters.items.length?needs():[],
          filters.modes.includes("volunteer")&&!needsTime?Promise.all(active.map(campaign=>volunteerShifts(campaign.slug))):[],
        ]);
        return json({...interpreted,...assistMatches(filters,active,inventory,shifts.flat(),Date.now(),needsTime)});
      }
      case "login": {
        const configured = input.role==="admin" ? process.env.ADMIN_PASSWORD : process.env.ORGANIZER_PASSWORD;
        const expected = configured || (process.env.NODE_ENV==="development" ? `gopsuc-${input.role}-demo` : "");
        if (expected.length < 12 || !timingSafeEqual(hash(input.password),hash(expected))) return json({error:"Vai trò hoặc mật khẩu không đúng."},401);
        await all("DELETE FROM sessions WHERE until<?",Date.now());
        if (token) await all("DELETE FROM sessions WHERE token=?",hash(token).toString("hex"));
        const nextToken=randomBytes(32).toString("hex");
        await all("INSERT INTO sessions VALUES(?,?,?)",hash(nextToken).toString("hex"),input.role,Date.now()+8*3600_000);
        const result=json({role:input.role});
        result.cookies.set(cookie,nextToken,{httpOnly:true,secure:expectedOrigin.startsWith("https:"),sameSite:"strict",path:"/",maxAge:8*3600});
        return result;
      }
      case "logout": {
        if (token) await all("DELETE FROM sessions WHERE token=?",hash(token).toString("hex"));
        const result=json({ok:true});
        result.cookies.delete(cookie);
        return result;
      }
      default: {
        const role=await sessionRole(token);
        if (!role) return json({error:"Phiên đăng nhập đã hết hạn."},401);
        const {action,slug:campaignSlug,...fields}=input;
        await manage(role,campaignSlug,action,fields);
        return json({ok:true});
      }
    }
  } catch (error) {
    if (error instanceof ReceiptAccessError) return json({error:error.message},403);
    if (error instanceof RuleError) return json({error:error.message},409);
    console.error("Góp Sức request failed", error instanceof Error ? error.message : "");
    return json({error:"Có lỗi khi xử lý. Vui lòng thử lại."},500);
  }
}
