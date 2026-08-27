/** Parsed representation of a `.osu` beatmap file. Playfield x is always 0..512. */

export const PLAYFIELD_WIDTH = 512;

export interface Vec2 {
	x: number;
	y: number;
}

export interface TimingPoint {
	time: number;
	/** ms per beat. Only meaningful when `uninherited` is true. */
	beatLength: number;
	/** Slider velocity multiplier contributed by inherited points (1 for uninherited). */
	sliderVelocity: number;
	meter: number;
	uninherited: boolean;
	kiai: boolean;
}

export type CurveType = "B" | "C" | "L" | "P";

interface HitObjectBase {
	x: number;
	y: number;
	time: number;
	newCombo: boolean;
}

export interface HitCircle extends HitObjectBase {
	type: "circle";
}

export interface Slider extends HitObjectBase {
	type: "slider";
	curveType: CurveType;
	/** Control points, including the head at index 0. */
	points: Vec2[];
	/** Number of traversals of the path. 1 = no repeats. */
	slides: number;
	/** Path length in osu! pixels. */
	pixelLength: number;
}

export interface Spinner extends HitObjectBase {
	type: "spinner";
	endTime: number;
}

export type HitObject = HitCircle | Slider | Spinner;

export interface Beatmap {
	formatVersion: number;
	general: {
		audioFilename: string;
		audioLeadIn: number;
		previewTime: number;
		/** 0 = osu!, 1 = taiko, 2 = catch, 3 = mania. We only play 2. */
		mode: number;
	};
	metadata: {
		title: string;
		titleUnicode: string;
		artist: string;
		artistUnicode: string;
		creator: string;
		/** Difficulty name, e.g. "Cup", "Salad", "Platter". */
		version: string;
		beatmapId: number;
		beatmapSetId: number;
	};
	difficulty: {
		hpDrainRate: number;
		circleSize: number;
		overallDifficulty: number;
		approachRate: number;
		sliderMultiplier: number;
		sliderTickRate: number;
	};
	timingPoints: TimingPoint[];
	hitObjects: HitObject[];
}
