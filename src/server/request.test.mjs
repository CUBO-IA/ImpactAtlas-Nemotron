import assert from "node:assert/strict";
import test from "node:test";
import { readJsonRequest } from "./request.ts";

test("lee JSON y rechaza parámetros y cuerpos inválidos", async () => {
  const init = { method: "POST", headers: { "content-type": "application/json" } };
  assert.deepEqual(await readJsonRequest(new Request("http://localhost/api/test", { ...init, body: '{"ok":true}' })), { ok: true });
  await assert.rejects(readJsonRequest(new Request("http://localhost/api/test?q=1", { ...init, body: "{}" })), { status: 400 });
  await assert.rejects(readJsonRequest(new Request("http://localhost/api/test", { ...init, body: "{" })), { status: 400 });
});

test("rechaza cuerpos mayores al límite aunque no tengan Content-Length", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(65537));
      controller.close();
    },
  });
  const request = new Request("http://localhost/api/test", {
    method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half",
  });
  await assert.rejects(readJsonRequest(request), { status: 413, code: "PAYLOAD_TOO_LARGE" });
});
