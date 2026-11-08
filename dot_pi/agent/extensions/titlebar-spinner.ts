/** Animate the terminal tab title while Pi is working. Load with /reload. */
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export default function (pi: ExtensionAPI) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let frame = 0;

  function baseTitle(ctx: ExtensionContext): string {
    const cwd = path.basename(ctx.cwd) || ctx.cwd;
    const name = pi.getSessionName();
    // Titles must not contain terminal control characters, even in a path/name.
    return (name ? `π - ${name} - ${cwd}` : `π - ${cwd}`).replace(/[\x00-\x1f\x7f-\x9f]/g, "");
  }

  function render(ctx: ExtensionContext) {
    if (ctx.mode !== "tui") return;
    ctx.ui.setTitle(`${timer ? `${frames[frame % frames.length]} ` : ""}${baseTitle(ctx)}`);
  }

  function stop(ctx: ExtensionContext) {
    if (timer) clearInterval(timer);
    timer = undefined;
    frame = 0;
    render(ctx);
  }

  pi.on("session_start", (_event, ctx) => stop(ctx));
  pi.on("session_info_changed", (_event, ctx) => render(ctx));
  pi.on("agent_start", (_event, ctx) => {
    // No terminal output/timers in print, JSON or RPC invocations. Retried
    // runs reuse the timer rather than flickering back to an idle title.
    if (ctx.mode !== "tui" || timer) return;
    timer = setInterval(() => {
      frame++;
      render(ctx);
    }, 100);
    timer.unref?.();
    render(ctx);
  });
  // agent_end is not idle: retries and queued continuations may follow it.
  pi.on("agent_settled", (_event, ctx) => stop(ctx));
  // /reload, /new, /resume and shutdown must never leave a timer behind.
  pi.on("session_shutdown", (_event, ctx) => stop(ctx));
}
