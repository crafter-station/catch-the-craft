import { cachedArrayBuffer } from "./cache";

/**
 * Announcer lines, one per sponsor, played when a combo burst fires.
 *
 * Keyed by sponsor slug so it lines up with the fruit roster in
 * `render/tokens.ts` — the burst already knows which sponsor it is showing, and
 * the voice should be the same one.
 */
const LINES = [
	"convex",
	"clerk",
	"cursor",
	"elevenlabs",
	"exa",
	"tavily",
	"vapi",
	"apify",
] as const;

export type VoiceLine = (typeof LINES)[number];

/**
 * The announcer is the loudest thing in the mix. It only fires on a milestone,
 * and the whole point of naming the sponsor is that the room hears it — a line
 * buried under the hitsounds does not do that.
 */
const LEVEL = 1;

export class VoiceBank {
	private readonly context: AudioContext;
	private readonly master: GainNode;
	private readonly buffers = new Map<string, AudioBuffer>();
	/** The line currently speaking, so two bursts in quick succession do not overlap. */
	private speaking: AudioBufferSourceNode | null = null;

	private constructor(context: AudioContext) {
		this.context = context;
		this.master = context.createGain();
		this.master.gain.value = LEVEL;
		this.master.connect(context.destination);
	}

	/** A missing line is not fatal; the burst still shows, just silently. */
	static async load(context: AudioContext): Promise<VoiceBank> {
		const bank = new VoiceBank(context);

		await Promise.all(
			LINES.map(async (slug) => {
				try {
					const bytes = await cachedArrayBuffer(`/voice/${slug}.mp3`);
					bank.buffers.set(slug, await context.decodeAudioData(bytes));
				} catch {
					// Leave it unset; play() becomes a no-op for this sponsor.
				}
			}),
		);

		return bank;
	}

	play(slug: string): void {
		const buffer = this.buffers.get(slug);
		if (!buffer) return;

		// Cut the previous line rather than letting two announcers talk over
		// each other — back-to-back milestones are exactly when that happens.
		this.stopSpeaking();

		const source = this.context.createBufferSource();
		source.buffer = buffer;
		source.connect(this.master);
		source.start();

		this.speaking = source;
		source.onended = () => {
			if (this.speaking === source) this.speaking = null;
			source.disconnect();
		};
	}

	setVolume(value: number): void {
		this.master.gain.value = Math.min(1, Math.max(0, value)) * LEVEL;
	}

	private stopSpeaking(): void {
		if (!this.speaking) return;
		try {
			this.speaking.stop();
		} catch {
			// Already finished.
		}
		this.speaking = null;
	}

	dispose(): void {
		this.stopSpeaking();
		this.master.disconnect();
	}
}
