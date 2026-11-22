import assert from "node:assert/strict";
import test from "node:test";
import {
  ChatBusyError,
  ChatTimeoutError,
  runChatRequest,
} from "./chat-runtime.ts";

test("admits two concurrent chat requests and rejects the third as busy", async () => {
  let finish;
  const gate = new Promise((resolve) => { finish = resolve; });
  const first = runChatRequest(() => gate);
  const second = runChatRequest(() => gate);
  await Promise.resolve();

  await assert.rejects(runChatRequest(async () => "should not run"), ChatBusyError);
  finish("done");
  assert.deepEqual(await Promise.all([first, second]), ["done", "done"]);
});

test("aborts work and returns timeout within the bounded request budget", async () => {
  let receivedSignal;
  const started = Date.now();
  await assert.rejects(runChatRequest((signal) => {
    receivedSignal = signal;
    return new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve("cooperatively stopped"), { once: true });
    });
  }, undefined, 20), ChatTimeoutError);

  assert.equal(receivedSignal.aborted, true);
  assert.ok(Date.now() - started < 1000);
});

test("retains the slot after timeout until non-cooperative work actually settles", async () => {
  let finishTimedOutWork;
  let finishSecondWork;
  const timedOutWork = new Promise((resolve) => { finishTimedOutWork = resolve; });
  const secondWork = new Promise((resolve) => { finishSecondWork = resolve; });
  const first = runChatRequest(() => timedOutWork, undefined, 15);
  const second = runChatRequest(() => secondWork);

  await assert.rejects(first, ChatTimeoutError);
  await assert.rejects(runChatRequest(async () => "should remain busy"), ChatBusyError);

  finishTimedOutWork("settled");
  finishSecondWork("settled");
  await second;
  assert.equal(await runChatRequest(async () => "released"), "released");
});
