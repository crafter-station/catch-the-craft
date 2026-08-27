/**
 * osu!'s own gameplay samples, from ppy/osu-resources.
 *
 * These share the clock's AudioContext rather than opening their own: a second
 * context runs on its own hardware callback and would drift against the music,
 * which is exactly the desync the clock exists to prevent.
 */
export type SampleName = "fruit" | "droplet" | "banana" | "comboBreak" | "comboUp";

const SOURCES: Record<SampleName, string> = {
	fruit: "/sfx/normal-hitnormal.wav",
	droplet: "/sfx/soft-hitnormal.wav",
	banana: "/sfx/catch-banana.wav",
	comboBreak: "/sfx/combobreak.mp3",
	comboUp: "/sfx/normal-hitfinish.wav",
};

/** Per-sample levels. Droplets fire in dense bursts and have to sit well under fruit. */
const LEVELS: Record<SampleName, number> = {
	fruit: 0.55,
	droplet: 0.22,
	banana: 0.35,
	comboBreak: 0.5,
	comboUp: 0.45,
};

/**
 * Minimum gap between two plays of the same sample. A juice stream can land
 * several droplets inside one frame, and stacking identical buffers sample-aligned
 * sums to a loud click rather than sounding like more droplets.
 */
const RETRIGGER_GUARD_MS = 12;

export class SampleBank {
	private readonly context: AudioContext;
	private readonly master: GainNode;
	private readonly buffers = new Map<SampleName, AudioBuffer>();
	private readonly lastPlayedAt = new Map<SampleName, number>();

	private constructor(context: AudioContext) {
		this.context = context;
		this.master = context.createGain();
		this.master.gain.value = 1;
		this.master.connect(context.destination);
	}

	/**
	 * Missing samples are not fatal — the game is perfectly playable silent, and
	 * a failed asset should never stop a run starting in front of a queue.
	 */
	static async load(context: AudioContext): Promise<SampleBank> {
		const bank = new SampleBank(context);

		await Promise.all(
			(Object.keys(SOURCES) as SampleName[]).map(async (name) => {
				try {
					const response = await fetch(SOURCES[name]);
					if (!response.ok) return;
					bank.buffers.set(name, await context.decodeAudioData(await response.arrayBuffer()));
				} catch {
					// Leave it unset; play() becomes a no-op for this sample.
				}
			}),
		);

		return bank;
	}

	play(name: SampleName, gain = 1): void {
		const buffer = this.buffers.get(name);
		if (!buffer) return;

		const now = this.context.currentTime * 1000;
		const last = this.lastPlayedAt.get(name) ?? Number.NEGATIVE_INFINITY;
		if (now - last < RETRIGGER_GUARD_MS) return;
		this.lastPlayedAt.set(name, now);

		const source = this.context.createBufferSource();
		source.buffer = buffer;

		const voice = this.context.createGain();
		voice.gain.value = LEVELS[name] * gain;

		source.connect(voice);
		voice.connect(this.master);
		source.start();
		source.onended = () => {
			source.disconnect();
			voice.disconnect();
		};
	}

	setVolume(value: number): void {
		this.master.gain.value = Math.min(1, Math.max(0, value));
	}

	dispose(): void {
		this.master.disconnect();
	}
}
