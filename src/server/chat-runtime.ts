let activeChats = 0;
const MAX_ACTIVE_CHATS = 2;
const DEFAULT_CHAT_BUDGET_MS = 45_000;

export class ChatBusyError extends Error {
  constructor() {
    super("El servicio de chat está ocupado.");
    this.name = "ChatBusyError";
  }
}

export class ChatTimeoutError extends Error {
  constructor() {
    super("La solicitud de chat excedió el presupuesto de tiempo.");
    this.name = "ChatTimeoutError";
  }
}

export class ChatCancelledError extends Error {
  constructor() {
    super("La solicitud de chat fue cancelada.");
    this.name = "ChatCancelledError";
  }
}

function abortError(signal: AbortSignal): Error {
  return signal.reason?.name === "TimeoutError"
    ? new ChatTimeoutError()
    : new ChatCancelledError();
}

function waitForAbortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export function runChatRequest<T>(
  task: (signal: AbortSignal) => Promise<T>,
  callerSignal?: AbortSignal,
  budgetMs = DEFAULT_CHAT_BUDGET_MS,
): Promise<T> {
  if (activeChats >= MAX_ACTIVE_CHATS) return Promise.reject(new ChatBusyError());

  activeChats += 1;
  const deadline = AbortSignal.timeout(budgetMs);
  const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeChats -= 1;
  };
  const work = Promise.resolve().then(() => {
    if (signal.aborted) throw abortError(signal);
    return task(signal);
  });
  // Keep the slot until actual work settles, even if the caller has timed out.
  work.then(release, release);
  return waitForAbortable(work, signal);
}
