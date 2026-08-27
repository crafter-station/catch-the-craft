/**
 * The master clock for a run.
 *
 * Everything on screen is positioned from `timeMs`, which is derived from
 * `AudioContext.currentTime` and nothing else. `<audio>.currentTime` updates in
 * coarse steps and `performance.now()` drifts against the sound card, and either
 * one produces a chart that slowly slides out of sync with the music — the
 * single worst failure mode a rhythm game has.
 */
export class AudioClock {
	private readonly context: AudioContext;
	private readonly buffer: AudioBuffer;
	private source: AudioBufferSourceNode | null = null;
	private readonly gain: GainNode;

	/** `context.currentTime` at the moment playback started. */
	private startedAtContextTime = 0;
	/** Position in the track that playback started from, in ms. */
	private startedFromMs = 0;
	private running = false;

	/** Player-tunable latency compensation, nudged with `[` and `]` in game. */
	offsetMs = 0;

	/** True when this clock created the context and is therefore allowed to close it. */
	private readonly ownsContext: boolean;

	private constructor(context: AudioContext, buffer: AudioBuffer, ownsContext: boolean) {
		this.context = context;
		this.buffer = buffer;
		this.ownsContext = ownsContext;
		this.gain = context.createGain();
		this.gain.connect(context.destination);
	}

	/** Must be called from a user gesture — browsers block audio otherwise. */
	static async load(url: string, context?: AudioContext): Promise<AudioClock> {
		const ctx = context ?? new AudioContext();
		if (ctx.state === "suspended") await ctx.resume();

		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to load audio: ${url}`);
		const buffer = await ctx.decodeAudioData(await response.arrayBuffer());

		return new AudioClock(ctx, buffer, context === undefined);
	}

	get durationMs(): number {
		return this.buffer.duration * 1000;
	}

	get isRunning(): boolean {
		return this.running;
	}

	/**
	 * Chart time in ms. Valid before playback starts too: it counts up through the
	 * lead-in so objects can already be falling when the first note lands.
	 */
	get timeMs(): number {
		if (!this.running) return this.startedFromMs;
		const elapsed =
			(this.context.currentTime - this.startedAtContextTime) * 1000;
		return this.startedFromMs + elapsed + this.offsetMs;
	}

	/**
	 * Starts playback at `fromMs`, optionally after `leadInMs` of silence so the
	 * player sees the first objects fall before the music begins.
	 */
	start(fromMs: number, leadInMs = 0): void {
		this.stop();

		const source = this.context.createBufferSource();
		source.buffer = this.buffer;
		source.connect(this.gain);

		const startAt = this.context.currentTime + leadInMs / 1000;
		source.start(startAt, Math.max(0, fromMs) / 1000);

		this.source = source;
		this.startedAtContextTime = startAt;
		this.startedFromMs = fromMs;
		this.running = true;
	}

	stop(): void {
		if (this.source) {
			try {
				this.source.stop();
			} catch {
				// Already stopped; the node is single-use either way.
			}
			this.source.disconnect();
			this.source = null;
		}
		this.running = false;
	}

	setVolume(value: number): void {
		this.gain.gain.value = Math.min(1, Math.max(0, value));
	}

	dispose(): void {
		this.stop();
		this.gain.disconnect();
		// A shared context belongs to the caller — closing it would kill the
		// hitsound bank hanging off the same context.
		if (this.ownsContext) void this.context.close();
	}
}
