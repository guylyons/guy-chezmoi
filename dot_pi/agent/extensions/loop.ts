/**
 * Claude Code's /loop: run a prompt or slash command again and again, on a
 * fixed interval or paced by the model. Load with /reload.
 *
 *   /loop 5m /review             now, then every 5 minutes
 *   /loop check the deploy every 2h
 *   /loop watch CI until green   no interval: the model picks each wait
 *   /loop                        status
 *   /loop stop                   end it
 *
 * A run that comes due while Pi is busy waits until it settles. Loops end
 * after 7 days, when the session changes, or (self-paced) when the model
 * doesn't schedule another run.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const UNITS: Record<string, number> = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 };
const MIN_INTERVAL = 10e3;
const MAX_AGE = 7 * 86400e3;
const SELF_MIN = 60, SELF_MAX = 3600;
const TOOL = "loop_schedule";

/** "5m", "90s", "2h", "1d" (also "5 min", "2 hours") → ms; null if not a duration. */
export function parseDuration(s: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)$/i.exec(s.trim());
  return m ? Math.round(parseFloat(m[1]) * UNITS[m[2][0].toLowerCase()]) : null;
}

/** `/loop` arguments → interval (null: self-paced) and prompt. */
export function parseArgs(args: string): { interval: number | null; prompt: string } {
  let text = args.trim(), interval: number | null = null;
  const lead = /^(\S+)\s+([\s\S]+)$/.exec(text);
  const tail = /^([\s\S]+?)\s+every\s+(\d+(?:\.\d+)?\s*[a-z]+)$/i.exec(text);
  if (lead && parseDuration(lead[1]) !== null) {
    interval = parseDuration(lead[1]);
    text = lead[2].trim();
  } else if (tail && parseDuration(tail[2]) !== null) {
    interval = parseDuration(tail[2]);
    text = tail[1].trim();
  }
  return { interval: interval === null ? null : Math.max(MIN_INTERVAL, interval), prompt: text };
}

export function formatDuration(ms: number): string {
  for (const [u, n] of [["d", 86400e3], ["h", 3600e3], ["m", 60e3]] as const)
    if (ms >= n && ms % n === 0) return `${ms / n}${u}`;
  return ms >= 60e3 ? `${Math.round(ms / 60e3)}m` : `${Math.round(ms / 1e3)}s`;
}

interface Loop {
  prompt: string;
  interval: number | null;
  started: number;
  runs: number;
  timer?: ReturnType<typeof setTimeout>;
  nextAt?: number;
  /** Came due while Pi was busy: send once it settles. */
  due: boolean;
  /** Our prompt is the run in progress. */
  inFlight: boolean;
  /** Self-paced: the model's requested wait for this run, or a stop. */
  scheduled?: { delay: number } | { stop: true; reason?: string };
}

export default function (pi: ExtensionAPI) {
  let loop: Loop | undefined;
  let ctx: ExtensionContext | undefined;

  const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const pace = (l: Loop) => (l.interval ? `every ${formatDuration(l.interval)}` : "self-paced");

  function status() {
    if (!ctx?.hasUI) return;
    ctx.ui.setStatus("loop", loop
      ? `⟳ ${pace(loop)} · #${loop.runs}${loop.inFlight ? " running" : loop.nextAt ? ` · next ${time(loop.nextAt)}` : loop.due ? " · waiting" : ""}`
      : undefined);
  }

  function setTool(on: boolean) {
    const active = pi.getActiveTools().filter((t) => t !== TOOL);
    pi.setActiveTools(on ? [...active, TOOL] : active);
  }

  function stop(why?: string) {
    if (!loop) return;
    clearTimeout(loop.timer);
    if (loop.interval === null) setTool(false);
    loop = undefined;
    status();
    if (why && ctx?.hasUI) ctx.ui.notify(`Loop stopped: ${why}`, "info");
  }

  function schedule(delay: number) {
    if (!loop) return;
    clearTimeout(loop.timer);
    loop.nextAt = Date.now() + delay;
    loop.timer = setTimeout(fire, delay);
    loop.timer.unref?.();
    status();
  }

  function fire() {
    if (!loop) return;
    loop.nextAt = undefined;
    if (Date.now() - loop.started >= MAX_AGE) return stop("it ran for 7 days");
    if (!ctx || !ctx.isIdle()) {
      loop.due = true;
      return status();
    }
    loop.due = false;
    loop.inFlight = true;
    loop.scheduled = undefined;
    loop.runs++;
    // A fixed loop keeps its rhythm from each start, not each finish.
    if (loop.interval) schedule(loop.interval);
    status();
    pi.sendUserMessage(loop.prompt, { expandPromptTemplates: true });
  }

  pi.registerTool({
    name: TOOL,
    label: "Loop",
    description:
      "Schedule the next run of the current self-paced /loop, or end it. Call once per run, after the work: " +
      `delaySeconds (${SELF_MIN}-${SELF_MAX}) is the wait before the prompt runs again; stop: true ends the loop.`,
    promptSnippet: "Schedule the next run of a self-paced /loop, or stop it",
    promptGuidelines: [
      `While a self-paced /loop runs, finish each run by calling ${TOOL}: a delaySeconds sized to how soon something is likely to change, or stop: true once the loop's goal is met or can't be met. Without the call the loop ends.`,
    ],
    defaultActive: false,
    parameters: {
      type: "object",
      properties: {
        delaySeconds: { type: "number", description: `Seconds until the next run (${SELF_MIN}-${SELF_MAX})` },
        stop: { type: "boolean", description: "End the loop instead" },
        reason: { type: "string", description: "Why: shown to the user" },
      },
      additionalProperties: false,
    } as any,
    async execute(_id: string, params: { delaySeconds?: number; stop?: boolean; reason?: string }) {
      const text = (t: string) => ({ content: [{ type: "text" as const, text: t }], details: {} });
      if (!loop || loop.interval !== null) return text("No self-paced loop is running.");
      if (params.stop) {
        loop.scheduled = { stop: true, reason: params.reason };
        return text("The loop will end after this run.");
      }
      const s = Math.min(SELF_MAX, Math.max(SELF_MIN, Math.round(params.delaySeconds ?? 600)));
      loop.scheduled = { delay: s * 1e3 };
      return text(`Next run in ${formatDuration(s * 1e3)}.`);
    },
  } as any);

  pi.registerCommand("loop", {
    description: "Run a prompt on an interval: /loop [5m] <prompt>, /loop stop",
    getArgumentCompletions: (prefix: string) => {
      const items = ["stop", "5m ", "10m ", "30m ", "1h "].filter((v) => v.startsWith(prefix));
      return items.length ? items.map((v) => ({ value: v, label: v })) : null;
    },
    handler: async (args: string, c: ExtensionContext) => {
      ctx = c;
      const a = args.trim();
      if (a === "stop" || a === "off" || a === "cancel") {
        if (!loop) return c.ui.notify("No loop is running.", "info");
        return stop("by /loop stop");
      }
      if (!a) {
        if (!loop) return c.ui.notify("No loop is running. Usage: /loop [5m] <prompt>", "info");
        const next = loop.inFlight ? "running now" : loop.nextAt ? `next at ${time(loop.nextAt)}` : "waiting for Pi to finish";
        return c.ui.notify(`Loop (${pace(loop)}, ${loop.runs} runs, ${next}): ${loop.prompt}`, "info");
      }
      const { interval, prompt } = parseArgs(a);
      if (!prompt) return c.ui.notify("Usage: /loop [5m] <prompt>", "warning");
      if (loop) stop();
      loop = { prompt, interval, started: Date.now(), runs: 0, due: false, inFlight: false };
      if (interval === null) setTool(true);
      c.ui.notify(`Looping ${pace(loop)}: ${prompt}  (/loop stop to end)`, "info");
      fire();
    },
  } as any);

  pi.on("agent_settled", (_e: unknown, c: ExtensionContext) => {
    ctx = c;
    if (!loop) return;
    const finished = loop.inFlight;
    loop.inFlight = false;
    if (finished && loop.interval === null) {
      const s = loop.scheduled;
      loop.scheduled = undefined;
      if (!s) return stop("the model didn't schedule another run");
      if ("stop" in s) return stop(s.reason || "the model ended it");
      return schedule(s.delay);
    }
    if (loop.due) return fire();
    status();
  });

  for (const e of ["session_start", "session_shutdown"] as const)
    pi.on(e, (_e: unknown, c: ExtensionContext) => {
      if (c) ctx = c;
      stop();
    });
}
