/**
 * crackrock splash: animated ANSI header for pi.
 * Powers on like a CRT (dot -> scanline -> picture), glitches in with tearing
 * and noise in cyan/pink, then settles so the header stops re-rendering.
 * Drawn as a widget above the editor so it shows after the startup listing;
 * cleared once the first turn starts.
 * /splash replays it; /builtin-header clears it.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

const GLYPHS: Record<string, string[]> = {
	C: [" ██████╗", "██╔════╝", "██║     ", "██║     ", "╚██████╗", " ╚═════╝"],
	R: ["██████╗ ", "██╔══██╗", "██████╔╝", "██╔══██╗", "██║  ██║", "╚═╝  ╚═╝"],
	A: [" █████╗ ", "██╔══██╗", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"],
	K: ["██╗  ██╗", "██║ ██╔╝", "█████╔╝ ", "██╔═██╗ ", "██║  ██╗", "╚═╝  ╚═╝"],
	O: [" ██████╗ ", "██╔═══██╗", "██║   ██║", "██║   ██║", "╚██████╔╝", " ╚═════╝ "],
};

const ART: string[][] = GLYPHS.C.map((_, row) =>
	[..."CRACKROCK"].map((ch) => GLYPHS[ch][row]).join("").split(""),
);
const ART_WIDTH = ART[0].length;
const FPS = 30;
const DURATION_MS = 2200;
const LINE_MS = 250; // CRT dot stretches into a scanline
const EXPAND_MS = 550; // scanline opens vertically into the picture
const NOISE = "!@#$%&*<>/\\|=+?▓▒░";

type RGB = [number, number, number];
const CYAN: RGB = [0, 230, 255];
const DEEP_CYAN: RGB = [0, 150, 200];
const PINK: RGB = [255, 60, 200];
const WHITE: RGB = [235, 255, 255];

const paint = ([r, g, b]: RGB, s: string) => `\x1b[38;2;${r | 0};${g | 0};${b | 0}m${s}\x1b[39m`;
const mix = (a: RGB, b: RGB, k: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * k) as RGB;
// Same time, same noise: unrelated TUI repaints must not add extra flicker.
const noise = (frame: number, x: number, y: number): number => {
	const n = Math.sin(frame * 127.1 + x * 311.7 + y * 74.7) * 43758.5453;
	return n - Math.floor(n);
};

// Settled look: cyan faces sweeping light -> deep, pink box-drawing shadows.
const settled = (ch: string, x: number): RGB =>
	ch === "█" ? mix(CYAN, DEEP_CYAN, x / ART_WIDTH) : PINK;

// t in [0,1] animation progress; t >= 1 renders the settled frame.
function renderArt(t: number): string[] {
	const ms = t * DURATION_MS;
	const blank = " ".repeat(ART_WIDTH);
	const mid = (ART.length - 1) / 2;

	if (t >= 1) return ART.map((cells) => cells.map((ch, x) => (ch === " " ? " " : paint(settled(ch, x), ch))).join(""));

	if (ms < LINE_MS) {
		const progress = ms / LINE_MS;
		const half = 0.5 + (1 - (1 - progress) ** 3) * (ART_WIDTH - 1) / 2;
		const line = [...blank].map((_, x) => (Math.abs(x - (ART_WIDTH - 1) / 2) <= half ? paint(WHITE, "━") : " ")).join("");
		return ART.map((_, y) => (y === Math.floor(mid) ? line : blank));
	}

	const progress = Math.min(1, (ms - LINE_MS) / EXPAND_MS);
	const open = 1 - (1 - progress) ** 3;
	const decay = Math.max(0, 1 - (ms - LINE_MS - EXPAND_MS) / (DURATION_MS - LINE_MS - EXPAND_MS));
	const k = Math.min(1, decay) ** 2;
	const burst = Math.max(0, Math.sin(ms / 85)) ** 8 * k;
	const frame = Math.floor(ms * FPS / 1000);
	const rollY = (ms - LINE_MS) / (DURATION_MS - LINE_MS) * (ART.length + 4) - 2;
	return ART.map((cells, y) => {
		if (Math.abs(y - mid) > Math.max(0.5, open * (mid + 0.5))) return blank;
		let row = cells;
		if (noise(Math.floor(ms / 90), 0, y) < burst * 0.6) {
			// A tear holds briefly rather than jumping on every repaint.
			const shift = Math.floor(noise(Math.floor(ms / 90), 1, y) * 5) - 2;
			row = shift >= 0 ? [...Array(shift).fill(" "), ...cells.slice(0, ART_WIDTH - shift)] : [...cells.slice(-shift), ...Array(-shift).fill(" ")];
		}
		return row
			.map((ch, x) => {
				const grain = noise(frame, x, y);
				if (ch === " ") return grain < burst * 0.025 ? paint(DEEP_CYAN, "░") : " ";
				if (grain < burst * 0.18) {
					return paint(PINK, NOISE[Math.floor(noise(frame, x + ART_WIDTH, y) * NOISE.length)]);
				}
				const scan = Math.max(0, 1 - Math.abs(y - rollY)) * k;
				const glow = Math.min(1, (1 - open) * 0.9 + scan * 0.65 + k * 0.12);
				return paint(mix(settled(ch, x), WHITE, glow), ch);
			})
			.join("");
	});
}

export default function (pi: ExtensionAPI) {
	let timer: ReturnType<typeof setInterval> | null = null;

	const stop = () => {
		if (timer) clearInterval(timer);
		timer = null;
	};

	function show(ctx: ExtensionContext) {
		if (ctx.mode !== "tui") return;
		stop();
		const start = Date.now();
		ctx.ui.setWidget("crackrock-splash", (tui, theme) => {
			stop();
			timer = setInterval(() => {
				if (Date.now() - start >= DURATION_MS) stop();
				tui.requestRender();
			}, 1000 / FPS);
			return {
				render(width: number): string[] {
					const t = Math.min(1, (Date.now() - start) / DURATION_MS);
					const subtitle = theme.fg("muted", "  π  agent of chaos") + theme.fg("dim", `  v${VERSION}`);
					const art = width < ART_WIDTH ? [paint(PINK, "  CRACKROCK")] : renderArt(t);
					return ["", ...art, subtitle, ""].map((line) => truncateToWidth(line, width, ""));
				},
				invalidate() {},
				dispose: stop,
			};
		});
	}

	const clear = (ctx: ExtensionContext) => {
		stop();
		ctx.ui.setWidget("crackrock-splash", undefined);
	};

	pi.on("session_start", async (_event, ctx) => show(ctx));
	pi.on("agent_start", async (_event, ctx) => clear(ctx));
	pi.on("session_shutdown", async () => stop());

	pi.registerCommand("splash", {
		description: "Replay the crackrock splash",
		handler: async (_args, ctx) => show(ctx),
	});

	pi.registerCommand("builtin-header", {
		description: "Clear the crackrock splash",
		handler: async (_args, ctx) => clear(ctx),
	});
}
