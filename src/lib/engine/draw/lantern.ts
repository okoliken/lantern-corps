// Draws a Lantern seen from above. All art is code: shapes plus glow.
//
// The body is drawn in "local space": we move the canvas origin to the
// Lantern and rotate it to their facing, so "forward" is always +x here.
// That makes the drawing code simple no matter which way they face.

import type { LanternDef } from '../lanterns';

export const GREEN = '#3dff6e';
export const LANTERN_RADIUS = 18;

export function drawLantern(
	ctx: CanvasRenderingContext2D,
	def: LanternDef,
	x: number,
	y: number,
	facing: number,
	time: number,
	scale = 1
) {
	const r = LANTERN_RADIUS * scale;
	const pulse = 0.75 + 0.25 * Math.sin(time * 4);

	ctx.save();
	ctx.translate(x, y);

	// Aura: soft green glow around the whole body
	const aura = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.2);
	aura.addColorStop(0, `rgba(61, 255, 110, ${0.28 * pulse})`);
	aura.addColorStop(1, 'rgba(61, 255, 110, 0)');
	ctx.fillStyle = aura;
	ctx.beginPath();
	ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
	ctx.fill();

	ctx.rotate(facing);

	// Shoulders: wide across (local y), narrow front-to-back (local x)
	ctx.fillStyle = '#0c0f0d';
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = 2 * scale;
	ctx.beginPath();
	ctx.ellipse(0, 0, r * 0.62, r, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();

	// Green shoulder panels (the classic suit)
	ctx.fillStyle = GREEN;
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.ellipse(0, side * r * 0.62, r * 0.42, r * 0.3, 0, 0, Math.PI * 2);
		ctx.fill();
	}

	// Arms reaching forward, ring hand on the right (local +y)
	ctx.fillStyle = '#0c0f0d';
	ctx.beginPath();
	ctx.ellipse(r * 0.55, -r * 0.72, r * 0.34, r * 0.18, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(r * 0.6, r * 0.72, r * 0.4, r * 0.18, 0, 0, Math.PI * 2);
	ctx.fill();

	// The ring glow on the right hand
	ctx.save();
	ctx.shadowColor = GREEN;
	ctx.shadowBlur = 14 * scale * pulse;
	ctx.fillStyle = '#d9ffe3';
	ctx.beginPath();
	ctx.arc(r * 0.98, r * 0.72, r * 0.16, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	// Head: hair at the back, face toward the front
	ctx.fillStyle = def.look.skin;
	ctx.beginPath();
	ctx.arc(r * 0.05, 0, r * 0.42, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = def.look.hair;
	ctx.beginPath();
	ctx.arc(-r * 0.04, 0, r * 0.42, Math.PI * 0.55, Math.PI * 1.45);
	ctx.fill();

	// Domino mask: a small green band across the front of the face
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = r * 0.12;
	ctx.beginPath();
	ctx.arc(r * 0.05, 0, r * 0.34, -Math.PI * 0.32, Math.PI * 0.32);
	ctx.stroke();

	ctx.restore();
}

/** Name tag above a Lantern. Not rotated, so it always reads upright. */
export function drawNameTag(ctx: CanvasRenderingContext2D, label: string, x: number, y: number) {
	ctx.save();
	ctx.font = '600 11px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'bottom';
	ctx.fillStyle = 'rgba(216, 245, 224, 0.85)';
	ctx.fillText(label, x, y - LANTERN_RADIUS * 1.9);
	ctx.restore();
}
