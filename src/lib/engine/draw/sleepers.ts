// Act 2, Mission 5 (Sleepers): what the Manhunters raise under Detroit, the
// holes they leave in the street coming up, and Batman's Batwing overhead.

const OUTLINE = '#07080a';
const TAU = Math.PI * 2;
const MH_RED = '#b3261e';
const MH_BLUE = '#233a82';
const MH_BLUE_DARK = '#152452';
const MH_EYE = '#ff8a2a';

/** How tall the spire stands once it's all the way up. */
const SPIRE_HEIGHT = 250;

/**
 * The signal spire: a tapering tower of Manhunter steel up out of the broken
 * junction, rings turning round its head, and a beam into the sky that
 * thickens as the signal builds. `rise` 0..1 as it comes up, `signal` 0..1,
 * `health` 1..0, `warn` 0..1 as a pulse builds.
 */
export function drawSignalSpire(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, rise: number, signal: number, health: number, warn: number) {
	ctx.save();
	ctx.translate(x, y);
	// The street torn open round it
	ctx.fillStyle = '#0c0d10';
	ctx.beginPath();
	for (let i = 0; i < 14; i++) {
		const a = (i / 14) * TAU;
		const r = 92 + Math.sin(i * 2.7) * 22;
		ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.42);
	}
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#3a3b40';
	for (let i = 0; i < 9; i++) {
		const a = (i / 9) * TAU + 0.3;
		const r = 100 + Math.sin(i * 5.1) * 14;
		ctx.save();
		ctx.translate(Math.cos(a) * r, Math.sin(a) * r * 0.42);
		ctx.rotate(i * 1.3);
		ctx.fillRect(-13, -6, 26, 12);
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 1.5;
		ctx.strokeRect(-13, -6, 26, 12);
		ctx.restore();
	}
	if (rise <= 0) {
		ctx.restore();
		return;
	}

	const h = SPIRE_HEIGHT * rise;
	const shake = rise < 1 ? Math.sin(time * 60) * 2 : 0;
	ctx.translate(shake, 0);
	// Only what's above the street shows
	ctx.save();
	ctx.beginPath();
	ctx.rect(-120, -SPIRE_HEIGHT - 900, 240, SPIRE_HEIGHT + 900 + 6);
	ctx.clip();
	ctx.translate(0, SPIRE_HEIGHT - h);

	const half = (t: number) => 40 - 26 * t; // half width at height t (0 base .. 1 top)
	const body = new Path2D();
	body.moveTo(-half(0), 0);
	body.lineTo(-half(1), -SPIRE_HEIGHT);
	body.lineTo(half(1), -SPIRE_HEIGHT);
	body.lineTo(half(0), 0);
	body.closePath();
	const steel = ctx.createLinearGradient(-40, 0, 40, 0);
	steel.addColorStop(0, MH_BLUE_DARK);
	steel.addColorStop(0.55, MH_BLUE);
	steel.addColorStop(1, '#0d1633');
	ctx.fillStyle = steel;
	ctx.fill(body);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 3;
	ctx.stroke(body);
	// Red bands, and the damage showing through
	for (let i = 1; i <= 4; i++) {
		const t = i / 5;
		const w = half(t);
		ctx.fillStyle = MH_RED;
		ctx.fillRect(-w, -SPIRE_HEIGHT * t - 5, w * 2, 10);
		ctx.strokeRect(-w, -SPIRE_HEIGHT * t - 5, w * 2, 10);
	}
	// The slit of light up its face: brighter as the signal builds, guttering as it's hurt
	const glow = (0.35 + 0.65 * signal) * (health < 0.35 ? 0.5 + 0.5 * Math.sin(time * 30) : 1);
	ctx.shadowColor = MH_EYE;
	ctx.shadowBlur = 14;
	ctx.fillStyle = `rgba(255, 138, 42, ${glow})`;
	ctx.fillRect(-4, -SPIRE_HEIGHT + 24, 8, SPIRE_HEIGHT - 60);
	ctx.shadowBlur = 0;
	if (health < 0.7) {
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(-22, -40);
		ctx.lineTo(-8, -90);
		ctx.lineTo(-18, -130);
		if (health < 0.4) {
			ctx.moveTo(16, -70);
			ctx.lineTo(6, -150);
			ctx.lineTo(14, -200);
		}
		ctx.stroke();
	}
	// The head: a Manhunter's face plate, and rings turning round it
	ctx.fillStyle = '#c9ccd6';
	ctx.beginPath();
	ctx.ellipse(0, -SPIRE_HEIGHT - 10, 20, 16, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = `rgba(255, 138, 42, ${0.6 + 0.4 * Math.sin(time * 5)})`;
	ctx.fillRect(-11, -SPIRE_HEIGHT - 14, 8, 4);
	ctx.fillRect(3, -SPIRE_HEIGHT - 14, 8, 4);
	if (rise >= 1) {
		ctx.strokeStyle = `rgba(255, 138, 42, ${0.5 + 0.4 * signal})`;
		ctx.lineWidth = 3;
		for (let i = 0; i < 2; i++) {
			ctx.beginPath();
			ctx.ellipse(0, -SPIRE_HEIGHT - 10 - i * 4, 44 + i * 16, 12 + i * 4, 0, time * (2 + i) + i * 2, time * (2 + i) + i * 2 + 4.4);
			ctx.stroke();
		}
		// The signal, into the sky
		const beam = ctx.createLinearGradient(0, -SPIRE_HEIGHT - 20, 0, -SPIRE_HEIGHT - 900);
		beam.addColorStop(0, `rgba(255, 150, 60, ${0.25 + 0.6 * signal})`);
		beam.addColorStop(1, 'rgba(255, 150, 60, 0)');
		ctx.fillStyle = beam;
		const bw = 4 + 16 * signal + Math.sin(time * 12) * 2;
		ctx.fillRect(-bw / 2, -SPIRE_HEIGHT - 900, bw, 880);
	}
	ctx.restore();
	// A pulse building: the base lights up
	if (warn > 0) {
		ctx.strokeStyle = `rgba(255, 138, 42, ${warn})`;
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.ellipse(0, 0, 60 + 30 * warn, (60 + 30 * warn) * 0.42, 0, 0, TAU);
		ctx.stroke();
	}
	ctx.restore();
}

/** Where a Manhunter came up through the street: a ragged black hole and thrown slabs. */
export function drawStreetBreak(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.fillStyle = '#08090b';
	ctx.beginPath();
	for (let i = 0; i < 10; i++) {
		const a = (i / 10) * TAU;
		const r = 30 + Math.sin(i * 3.1 + seed * 9) * 9;
		ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.45);
	}
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
	ctx.lineWidth = 1.5;
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * TAU + seed * 6;
		ctx.beginPath();
		ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 13);
		ctx.lineTo(Math.cos(a + 0.2) * 52, Math.sin(a + 0.2) * 23);
		ctx.stroke();
	}
	ctx.fillStyle = '#3a3b40';
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * TAU + seed * 4;
		ctx.save();
		ctx.translate(Math.cos(a) * 40, Math.sin(a) * 18);
		ctx.rotate(seed * 10 + i);
		ctx.fillRect(-8, -4, 16, 8);
		ctx.restore();
	}
	ctx.restore();
}

/** The Batwing, low over the street: a black bat's shape, and its shadow under it. (x, y) is the ground below it. */
export function drawBatwing(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1) {
	ctx.save();
	ctx.translate(x, y);
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(0, 0, 110, 26, 0, 0, TAU);
	ctx.fill();
	ctx.translate(0, -300);
	ctx.scale(dir, 1);
	ctx.fillStyle = '#0a0b10';
	ctx.strokeStyle = '#2a2f40';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(120, 0); // nose
	ctx.quadraticCurveTo(60, -14, 20, -16);
	ctx.lineTo(-30, -78); // wing tip (far side)
	ctx.quadraticCurveTo(-40, -40, -62, -34);
	ctx.quadraticCurveTo(-58, -16, -84, -10);
	ctx.lineTo(-70, 0);
	ctx.lineTo(-84, 10);
	ctx.quadraticCurveTo(-58, 16, -62, 34);
	ctx.quadraticCurveTo(-40, 40, -30, 78); // wing tip (near side)
	ctx.lineTo(20, 16);
	ctx.quadraticCurveTo(60, 14, 120, 0);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Cockpit, and the engines' glow
	ctx.fillStyle = '#39405a';
	ctx.beginPath();
	ctx.ellipse(52, 0, 18, 6, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = 'rgba(120, 190, 255, 0.85)';
	ctx.shadowColor = '#78beff';
	ctx.shadowBlur = 12;
	ctx.fillRect(-92, -6, 12, 4);
	ctx.fillRect(-92, 2, 12, 4);
	ctx.restore();
}
