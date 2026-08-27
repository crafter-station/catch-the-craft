/**
 * Catch debris.
 *
 * Purely decorative, and deliberately cheap: a flat array of structs updated in
 * place with no allocation per frame beyond the initial burst. A rhythm game
 * that drops frames to draw sparkles has made a bad trade.
 *
 * Coordinates are playfield units, the same space the chart uses, with `y`
 * measured downward from the catcher line. The renderer is the only thing that
 * knows about pixels, so particles survive a resize without rescaling.
 */
export interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Remaining life in ms. */
	life: number;
	maxLife: number;
	size: number;
	color: string;
}

/** Playfield units per ms², pulling particles back down. */
const GRAVITY = 0.00025;

/** Hard ceiling so a dense juice stream cannot pile up unbounded. */
const MAX_PARTICLES = 260;

export class ParticleField {
	private particles: Particle[] = [];

	get all(): readonly Particle[] {
		return this.particles;
	}

	/**
	 * Sprays `count` particles up and outward from a catch. Spread is randomised
	 * per particle; the seeded determinism that matters for fairness applies to
	 * the chart, not to decoration.
	 */
	emit(x: number, y: number, color: string, count: number, power = 1): void {
		if (this.particles.length > MAX_PARTICLES) return;

		for (let i = 0; i < count; i++) {
			// Biased upward: a fan, not a sphere, so it reads as an impact.
			const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.1;
			const speed = (0.05 + Math.random() * 0.09) * power;
			const life = 320 + Math.random() * 380;

			this.particles.push({
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life,
				maxLife: life,
				size: 1.2 + Math.random() * 2.2,
				color,
			});
		}
	}

	update(deltaMs: number): void {
		let write = 0;

		for (let read = 0; read < this.particles.length; read++) {
			const particle = this.particles[read];
			particle.life -= deltaMs;
			if (particle.life <= 0) continue;

			particle.vy += GRAVITY * deltaMs;
			particle.x += particle.vx * deltaMs;
			particle.y += particle.vy * deltaMs;

			this.particles[write++] = particle;
		}

		this.particles.length = write;
	}

	clear(): void {
		this.particles.length = 0;
	}
}
