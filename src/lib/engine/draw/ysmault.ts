// Act 3, Mission 4 (Ysmault): the Red Lanterns' home world. The Blood Altar,
// a lake of blood in a ring of black stone; the conduits that feed it; the
// surge it throws out; and the pools the Red Lanterns climb out of.

const OUTLINE = '#050101';
const TAU = Math.PI * 2;
const BLOOD = '#8a0c10';
const BLOOD_LIT = '#c81c22';
const STONE = '#1a1012';
const STONE_LIT = '#2e1c1f';

/** The Blood Altar: a lake of blood in a ring of black stone, pulsing; `power` 1..0 as its conduits fall. */
export function drawBloodAltar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, power: number) {
	ctx.save();
	ctx.translate(x, y);
	// The stone rim
	ctx.fillStyle = STONE;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(0, 0, r + 40, (r + 40) * 0.45, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = STONE_LIT;
	for (let i = 0; i < 20; i++) {
		const a = (i / 20) * TAU;
		ctx.save();
		ctx.translate(Math.cos(a) * (r + 22), Math.sin(a) * (r + 22) * 0.45);
		ctx.rotate(a);
		ctx.fillRect(-14, -6, 28, 12);
		ctx.restore();
	}
	// The blood
	const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
	const lake = ctx.createRadialGradient(0, 0, 10, 0, 0, r);
	lake.addColorStop(0, power > 0 ? `rgba(255, ${60 + 50 * pulse * power}, 60, 1)` : '#5a0a0c');
	lake.addColorStop(0.6, BLOOD_LIT);
	lake.addColorStop(1, BLOOD);
	ctx.fillStyle = lake;
	ctx.beginPath();
	ctx.ellipse(0, 0, r, r * 0.45, 0, 0, TAU);
	ctx.fill();
	// Ripples
	ctx.strokeStyle = `rgba(255, 120, 110, ${0.25 + 0.2 * power})`;
	ctx.lineWidth = 2;
	for (let i = 0; i < 3; i++) {
		const k = (time * 0.3 + i / 3) % 1;
		ctx.beginPath();
		ctx.ellipse(0, 0, r * k, r * k * 0.45, 0, 0, TAU);
		ctx.stroke();
	}
	// Its light going up, while it has power
	if (power > 0) {
		ctx.globalCompositeOperation = 'lighter';
		const beam = ctx.createLinearGradient(0, 0, 0, -700);
		beam.addColorStop(0, `rgba(255, 40, 40, ${0.35 * power})`);
		beam.addColorStop(1, 'rgba(255, 40, 40, 0)');
		ctx.fillStyle = beam;
		ctx.fillRect(-r * 0.3 * power, -700, r * 0.6 * power, 700);
	}
	ctx.restore();
}

/** A conduit feeding the altar: a black spike, blood running up it and off toward the altar. */
export function drawConduit(ctx: CanvasRenderingContext2D, x: number, y: number, toX: number, toY: number, time: number, health: number) {
	ctx.save();
	// The stream of blood-light to the altar
	ctx.strokeStyle = `rgba(255, 50, 50, ${0.35 + 0.2 * Math.sin(time * 6 + x)})`;
	ctx.shadowColor = '#ff2a2a';
	ctx.shadowBlur = 10;
	ctx.lineWidth = 5;
	ctx.setLineDash([16, 10]);
	ctx.lineDashOffset = -time * 80;
	ctx.beginPath();
	ctx.moveTo(x, y - 170);
	ctx.quadraticCurveTo((x + toX) / 2, Math.min(y, toY) - 320, toX, toY - 90);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.shadowBlur = 0;
	ctx.translate(x, y);
	ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
	ctx.beginPath();
	ctx.ellipse(0, 0, 50, 16, 0, 0, TAU);
	ctx.fill();
	const spike = new Path2D();
	spike.moveTo(-34, 0);
	spike.lineTo(-18, -120);
	spike.lineTo(-6, -190);
	spike.lineTo(0, -220);
	spike.lineTo(8, -180);
	spike.lineTo(20, -110);
	spike.lineTo(34, 0);
	spike.closePath();
	const shade = ctx.createLinearGradient(-34, 0, 34, 0);
	shade.addColorStop(0, '#0e0708');
	shade.addColorStop(0.6, STONE_LIT);
	shade.addColorStop(1, STONE);
	ctx.fillStyle = shade;
	ctx.fill(spike);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 2.5;
	ctx.stroke(spike);
	// Blood running up the middle of it
	ctx.strokeStyle = BLOOD_LIT;
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.moveTo(0, -6);
	ctx.lineTo(-2, -100);
	ctx.lineTo(1, -200);
	ctx.stroke();
	// Cracks as it's broken
	if (health < 0.66) {
		ctx.strokeStyle = 'rgba(255, 200, 190, 0.7)';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(-20, -40);
		ctx.lineTo(-8, -90);
		ctx.lineTo(-16, -130);
		if (health < 0.33) {
			ctx.moveTo(18, -30);
			ctx.lineTo(8, -110);
		}
		ctx.stroke();
	}
	ctx.restore();
}

/** A broken conduit: a stump and scattered black shards. */
export function drawConduitStump(ctx: CanvasRenderingContext2D, x: number, y: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.fillStyle = STONE;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(-34, 0);
	ctx.lineTo(-24, -50);
	ctx.lineTo(-6, -36);
	ctx.lineTo(10, -58);
	ctx.lineTo(26, -30);
	ctx.lineTo(34, 0);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	for (let i = 0; i < 5; i++) {
		const a = i * 1.3;
		ctx.save();
		ctx.translate(Math.cos(a) * 60, Math.sin(a) * 22);
		ctx.rotate(a);
		ctx.fillRect(-10, -4, 20, 8);
		ctx.restore();
	}
	ctx.restore();
}

/** The altar's surge: a wave of blood rolling out across the plain (radius now r, 0..1 through it). */
export function drawBloodSurge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number) {
	ctx.save();
	const fade = 1 - k;
	ctx.strokeStyle = `rgba(200, 20, 30, ${0.75 * fade})`;
	ctx.lineWidth = 22 * fade + 4;
	ctx.beginPath();
	ctx.ellipse(x, y, r, r * 0.45, 0, 0, TAU);
	ctx.stroke();
	ctx.strokeStyle = `rgba(255, 140, 130, ${0.8 * fade})`;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(x, y, r, r * 0.45, 0, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

/** A pool of blood the Red Lanterns climb out of. */
export function drawBloodPool(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number) {
	ctx.save();
	ctx.fillStyle = BLOOD;
	ctx.strokeStyle = STONE;
	ctx.lineWidth = 6;
	ctx.beginPath();
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * TAU;
		const r = 70 + Math.sin(i * 2.3 + seed * 9) * 12;
		ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.45);
	}
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = `rgba(255, 100, 90, ${0.25 + 0.15 * Math.sin(time * 3 + seed * 5)})`;
	ctx.beginPath();
	ctx.ellipse(x - 12, y - 4, 26, 8, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
}
