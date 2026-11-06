export const MAX_JSON_BODY_BYTES = 16 * 1024;

export type JsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" };

const INVALID_JSON: JsonBodyResult = { ok: false, reason: "invalid_json" };
const TOO_LARGE: JsonBodyResult = { ok: false, reason: "too_large" };

export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  if (request.headers.has("content-length")) {
    const declaredBytes = Number(request.headers.get("content-length"));
    if (declaredBytes > maxBytes) {
      return TOO_LARGE;
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return INVALID_JSON;
  }

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return TOO_LARGE;
      }
      chunks.push(value);
    }
  } catch {
    return INVALID_JSON;
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return INVALID_JSON;
  }
}
