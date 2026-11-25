import sharp from "sharp";
import { UPDATE_IMAGE_MAX_BYTES } from "./domain.ts";

const MAX_FORM_BYTES = UPDATE_IMAGE_MAX_BYTES + 16 * 1024;
export class UploadError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function readPhotoForm(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new UploadError("Thiếu dữ liệu cập nhật.");
  if (Number(request.headers.get("content-length")) > MAX_FORM_BYTES) {
    await reader.cancel();
    throw new UploadError("Ảnh vượt quá 4 MB.", 413);
  }
  let read = 0;
  const chunks: Buffer[] = [];
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      read += value.byteLength;
      if (read > MAX_FORM_BYTES) {
        await reader.cancel();
        throw new UploadError("Ảnh vượt quá 4 MB.", 413);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(Buffer.concat(chunks), {headers:{"Content-Type":request.headers.get("content-type")??""}}).formData();
  } catch {
    throw new UploadError("Không đọc được dữ liệu ảnh.");
  }
}

export async function encodeUpdateImage(file: File) {
  if (!file.size || file.size > UPDATE_IMAGE_MAX_BYTES) throw new UploadError("Ảnh phải nhỏ hơn hoặc bằng 4 MB.",413);
  try {
    const input = sharp(Buffer.from(await file.arrayBuffer()), {limitInputPixels:24_000_000});
    const info = await input.metadata();
    if (!["jpeg","png","webp"].includes(info.format) || (info.pages??1)>1) throw new UploadError("Hãy chọn một ảnh JPEG, PNG hoặc WebP tĩnh.");
    return await input.rotate().resize(1280,1280,{fit:"inside",withoutEnlargement:true}).webp({quality:81}).toBuffer();
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("Không đọc được ảnh. Hãy thử JPEG, PNG hoặc WebP dưới 24 megapixel.");
  }
}
