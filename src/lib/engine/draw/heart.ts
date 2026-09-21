// Act 2's boss (Manhunter Prime): the Heart of the Vault, the hall under the
// vault world where the first Manhunter was buried, and the green light it
// pulls out of a Lantern's ring when it learns a construct.

const OUTLINE = '#07080a';
const TAU = Math.PI * 2;
const AMBER = '#ff8a2a';

/** One of the ranks of sleeping Manhunters along the walls: a hooded shape, eyes dim, or lit as it wakes (`awake` 0..1). */
export function drawDormant(ctx: CanvasRenderingContext2D, x: number, y: number, awake: number, time: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(0, 0, 20, 6, 0, 0, TAU);
	ctx.fill();
	// The alcove it stands in
	ctx.fillStyle = '#10141d';
	ctx.strokeStyle = '#2a3142';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(-26, 0);
	ctx.lineTo(-26, -96);
	ctx.quadraticCurveTo(0, -128, 26, -96);
	ctx.lineTo(26, 0);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Shoulders, hood, folded arms: all one dark shape
	ctx.fillStyle = '#232a3b';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(-15, 0);
	ctx.lineTo(-17, -62);
	ctx.quadraticCurveTo(-16, -76, -8, -78);
	ctx.quadraticCurveTo(-10, -100, 0, -102);
	ctx.quadraticCurveTo(10, -100, 8, -78);
	ctx.quadraticCurveTo(16, -76, 17, -62);
	ctx.lineTo(15, 0);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#3a1716';
	ctx.fillRect(-13, -62, 26, 26);
	// Eyes
	const lit = 0.12 + 0.88 * awake * (0.8 + 0.2 * Math.sin(time * 9 + x));
	ctx.fillStyle = `rgba(255, 138, 42, ${lit})`;
	ctx.shadowColor = AMBER;
	ctx.shadowBlur = 10 * awake;
	ctx.fillRect(-6, -91, 4, 2);
	ctx.fillRect(2, -91, 4, 2);
	ctx.restore();
}

/** The dais in the middle of the hall, where Prime was kept: rings of old steel in the floor, a dull light under them. */
export function drawPrimeDais(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, power: number) {
	ctx.save();
	ctx.translate(x, y);
	const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, 260);
	glow.addColorStop(0, `rgba(255, 138, 42, ${0.1 + 0.16 * power})`);
	glow.addColorStop(1, 'rgba(255, 138, 42, 0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.ellipse(0, 0, 260, 118, 0, 0, TAU);
	ctx.fill();
	for (let i = 0; i < 3; i++) {
		const r = 90 + i * 70;
		ctx.strokeStyle = i === 1 ? `rgba(255, 138, 42, ${0.25 + 0.3 * power})` : '#38415a';
		ctx.lineWidth = i === 1 ? 3 : 5;
		ctx.beginPath();
		ctx.ellipse(0, 0, r, r * 0.45, 0, 0, TAU);
		ctx.stroke();
	}
	// Marks round the middle ring, turning slowly
	ctx.fillStyle = `rgba(255, 138, 42, ${0.4 + 0.4 * power})`;
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * TAU + time * 0.15;
		ctx.fillRect(Math.cos(a) * 160 - 3, Math.sin(a) * 72 - 2, 6, 4);
	}
	ctx.restore();
}

/**
 * Prime learning a construct: green light pulled out of a Lantern's ring, across
 * the hall and into its chest. `k` 0..1 through the analysis.
 */
export function drawSiphon(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, k: number, time: number) {
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	ctx.lineCap = 'round';
	const fade = Math.min(1, k * 5) * Math.min(1, (1 - k) * 5);
	const mx = (fromX + toX) / 2;
	const my = Math.min(fromY, toY) - 90;
	for (let strand = 0; strand < 3; strand++) {
		ctx.strokeStyle = `rgba(61, 255, 110, ${(0.55 - strand * 0.12) * fade})`;
		ctx.shadowColor = '#3dff6e';
		ctx.shadowBlur = 14;
		ctx.lineWidth = 5 - strand * 1.5;
		ctx.beginPath();
		ctx.moveTo(fromX, fromY);
		ctx.quadraticCurveTo(mx + Math.sin(time * 6 + strand * 2) * 40, my + Math.cos(time * 5 + strand) * 30, toX, toY);
		ctx.stroke();
	}
	// Motes of light running along it, toward Prime
	ctx.fillStyle = `rgba(210, 255, 225, ${fade})`;
	for (let i = 0; i < 7; i++) {
		const t = (time * 1.2 + i / 7) % 1;
		const x = (1 - t) ** 2 * fromX + 2 * (1 - t) * t * mx + t * t * toX;
		const y = (1 - t) ** 2 * fromY + 2 * (1 - t) * t * my + t * t * toY;
		ctx.beginPath();
		ctx.arc(x, y, 3.5, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}
