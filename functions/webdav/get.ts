import { notFound } from "./utils";
import { RequestHandlerParams } from "./utils";

export async function handleRequestGet({
  bucket,
  path,
  request,
}: RequestHandlerParams): Promise<Response> {
  // 1. 从浏览器请求中正确地提取 Range 标头
  const range = request.headers.get("range") || undefined;

  // 2. 调用 R2 的 get 方法，并传入正确的 range 和 onlyIf 参数
  const obj = await bucket.get(path, {
    onlyIf: request.headers,
    range,
  });

  // 如果文件不存在，返回 404
  if (obj === null) {
    return notFound();
  }

  // 3. 智能判断状态码 (这是最关键的修复)
  // - 如果是缓存命中 (没有 body)，返回 304 Not Modified
  // - 如果有 body 且是范围请求，返回 206 Partial Content
  // - 如果是普通请求，返回 200 OK
  const status = !("body" in obj) ? 304 : range ? 206 : 200;

  // 如果状态码是 304，则不应包含 body
  const body = "body" in obj ? obj.body : null;

  // 4. 创建响应头，并保留您原有的逻辑
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag); // 添加 ETag 是一个好习惯

  // 保留您对缩略图的特殊缓存设置
  if (path.startsWith("_$flaredrive$/thumbnails/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  // 5. 返回带有正确 Body、Headers 和 Status 的响应
  return new Response(body, {
    headers,
    status,
  });
}
