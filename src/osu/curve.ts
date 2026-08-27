import type { CurveType, Vec2 } from "./types";

/**
 * A slider path resolved to an arc-length-parameterised polyline.
 *
 * Catch only ever asks for the x coordinate of a droplet at some fraction along
 * the slider, so exact curve fidelity matters less than monotonic arc length —
 * which is why everything is flattened to a polyline up front instead of being
 * evaluated analytically per sample.
 */
export interface SliderPath {
	/** Point at `progress` in 0..1 along the (possibly truncated) path. */
	pointAt(progress: number): Vec2;
	/** Total path length in osu! pixels. */
	length: number;
}

const distance = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.y - a.y);

export function buildSliderPath(
	curveType: CurveType,
	controlPoints: Vec2[],
	pixelLength: number,
): SliderPath {
	const flattened = flatten(curveType, controlPoints);
	const { points, cumulative, length } = truncate(flattened, pixelLength);

	return {
		length,
		pointAt(progress: number): Vec2 {
			if (points.length === 1) return points[0];
			const target = Math.min(Math.max(progress, 0), 1) * length;

			// Binary search the segment containing `target`.
			let low = 0;
			let high = cumulative.length - 1;
			while (low < high) {
				const mid = (low + high) >> 1;
				if (cumulative[mid] < target) low = mid + 1;
				else high = mid;
			}

			const index = Math.max(1, low);
			const spanStart = cumulative[index - 1];
			const spanLength = cumulative[index] - spanStart;
			const t = spanLength <= 0 ? 0 : (target - spanStart) / spanLength;
			const a = points[index - 1];
			const b = points[index];
			return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
		},
	};
}

function truncate(points: Vec2[], pixelLength: number) {
	const kept: Vec2[] = [points[0]];
	const cumulative: number[] = [0];
	let total = 0;

	for (let i = 1; i < points.length; i++) {
		const step = distance(points[i - 1], points[i]);
		if (step <= 0) continue;

		if (pixelLength > 0 && total + step >= pixelLength) {
			const t = (pixelLength - total) / step;
			const a = points[i - 1];
			const b = points[i];
			kept.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
			cumulative.push(pixelLength);
			return { points: kept, cumulative, length: pixelLength };
		}

		total += step;
		kept.push(points[i]);
		cumulative.push(total);
	}

	return { points: kept, cumulative, length: total };
}

function flatten(curveType: CurveType, controlPoints: Vec2[]): Vec2[] {
	if (controlPoints.length < 2) return [...controlPoints];

	switch (curveType) {
		case "L":
			return [...controlPoints];
		case "P":
			return flattenPerfectCircle(controlPoints);
		case "C":
			return flattenCatmull(controlPoints);
		default:
			return flattenBezier(controlPoints);
	}
}

/**
 * osu! encodes a multi-segment bezier as one control point list with a repeated
 * point marking each segment boundary, so we split on duplicates first.
 */
function flattenBezier(controlPoints: Vec2[]): Vec2[] {
	const output: Vec2[] = [];
	let segment: Vec2[] = [controlPoints[0]];

	for (let i = 1; i < controlPoints.length; i++) {
		const point = controlPoints[i];
		const previous = controlPoints[i - 1];

		if (point.x === previous.x && point.y === previous.y) {
			appendSegment(output, sampleBezier(segment));
			segment = [point];
			continue;
		}
		segment.push(point);
	}

	appendSegment(output, sampleBezier(segment));
	return output;
}

function appendSegment(output: Vec2[], segment: Vec2[]): void {
	if (segment.length === 0) return;
	// Skip the duplicated joint between consecutive segments.
	output.push(...(output.length === 0 ? segment : segment.slice(1)));
}

function sampleBezier(controlPoints: Vec2[]): Vec2[] {
	if (controlPoints.length === 1) return [...controlPoints];
	if (controlPoints.length === 2) return [...controlPoints];

	let polygonLength = 0;
	for (let i = 1; i < controlPoints.length; i++) {
		polygonLength += distance(controlPoints[i - 1], controlPoints[i]);
	}

	const steps = Math.min(1000, Math.max(8, Math.ceil(polygonLength / 4)));
	const points: Vec2[] = [];
	for (let i = 0; i <= steps; i++) {
		points.push(deCasteljau(controlPoints, i / steps));
	}
	return points;
}

function deCasteljau(controlPoints: Vec2[], t: number): Vec2 {
	const xs = controlPoints.map((p) => p.x);
	const ys = controlPoints.map((p) => p.y);

	for (let level = controlPoints.length - 1; level > 0; level--) {
		for (let i = 0; i < level; i++) {
			xs[i] = xs[i] + (xs[i + 1] - xs[i]) * t;
			ys[i] = ys[i] + (ys[i + 1] - ys[i]) * t;
		}
	}
	return { x: xs[0], y: ys[0] };
}

/**
 * A three-point arc. Degenerate (collinear) inputs fall back to a bezier, which
 * is what osu! itself does.
 */
function flattenPerfectCircle(controlPoints: Vec2[]): Vec2[] {
	if (controlPoints.length !== 3) return flattenBezier(controlPoints);

	const [a, b, c] = controlPoints;
	const aSq = distance(b, c) ** 2;
	const bSq = distance(a, c) ** 2;
	const cSq = distance(a, b) ** 2;

	if (aSq === 0 || bSq === 0 || cSq === 0) return flattenBezier(controlPoints);

	const s = aSq * (bSq + cSq - aSq);
	const t = bSq * (aSq + cSq - bSq);
	const u = cSq * (aSq + bSq - cSq);
	const sum = s + t + u;
	if (Math.abs(sum) < 1e-9) return flattenBezier(controlPoints);

	const centre: Vec2 = {
		x: (s * a.x + t * b.x + u * c.x) / sum,
		y: (s * a.y + t * b.y + u * c.y) / sum,
	};
	const radius = distance(centre, a);

	let startAngle = Math.atan2(a.y - centre.y, a.x - centre.x);
	const midAngle = Math.atan2(b.y - centre.y, b.x - centre.x);
	let endAngle = Math.atan2(c.y - centre.y, c.x - centre.x);

	// Walk the arc in whichever direction actually passes through the middle point.
	while (midAngle < startAngle) startAngle -= Math.PI * 2;
	while (endAngle < midAngle) endAngle += Math.PI * 2;
	if (endAngle - startAngle > Math.PI * 2) {
		[startAngle, endAngle] = [endAngle, startAngle];
	}

	const arcLength = Math.abs((endAngle - startAngle) * radius);
	const steps = Math.min(1000, Math.max(8, Math.ceil(arcLength / 4)));

	const points: Vec2[] = [];
	for (let i = 0; i <= steps; i++) {
		const angle = startAngle + ((endAngle - startAngle) * i) / steps;
		points.push({
			x: centre.x + Math.cos(angle) * radius,
			y: centre.y + Math.sin(angle) * radius,
		});
	}
	return points;
}

function flattenCatmull(controlPoints: Vec2[]): Vec2[] {
	const points: Vec2[] = [];
	const stepsPerSegment = 25;

	for (let i = 0; i < controlPoints.length - 1; i++) {
		const p0 = controlPoints[i - 1] ?? controlPoints[i];
		const p1 = controlPoints[i];
		const p2 = controlPoints[i + 1];
		const p3 = controlPoints[i + 2] ?? {
			x: p2.x * 2 - p1.x,
			y: p2.y * 2 - p1.y,
		};

		for (let step = i === 0 ? 0 : 1; step <= stepsPerSegment; step++) {
			points.push(catmullAt(p0, p1, p2, p3, step / stepsPerSegment));
		}
	}

	return points.length > 0 ? points : [...controlPoints];
}

function catmullAt(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
	const t2 = t * t;
	const t3 = t2 * t;
	const axis = (a: number, b: number, c: number, d: number) =>
		0.5 *
		(2 * b +
			(-a + c) * t +
			(2 * a - 5 * b + 4 * c - d) * t2 +
			(-a + 3 * b - 3 * c + d) * t3);

	return {
		x: axis(p0.x, p1.x, p2.x, p3.x),
		y: axis(p0.y, p1.y, p2.y, p3.y),
	};
}
