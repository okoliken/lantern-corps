// Parallax: fear itself, a yellow storm with a skull in it and tendrils that
// reach out and take hold of people. Drawn around (x, y) at size `s`.

export interface ParallaxPose {
	/** Points its tendrils have hold of, or are reaching for (`k` 0..1 how far out). */
	grabs?: { x: number; y: number; k: number }[];
	/** 0..1, how hard it's being hit (it boils brighter and flinches). */
	hit?: number;
	/** 0..1, rage: the eyes and mouth burn. */
	rage?: number;
	/** How far its loose tendrils wave out (1 = full length). */
	reach?: number;
}

export function drawParallax(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, pose: ParallaxPose = {}) {
	const hit = pose.hit ?? 0;
	const rage = pose.rage ?? 0.5;
	ctx.save();
	ctx.lineCap = 'round';

	// The loose tendrils, waving
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2 + 0.3;
		const len = (220 + 60 * Math.sin(t * 1.3 + i * 2.1)) * s * (pose.reach ?? 1);
		const ex = x + Math.cos(a) * len;
		const ey = y + Math.sin(a) * len * 0.75 + 40 * s;
		const cx = x + Math.cos(a + 0.6 * Math.sin(t * 1.7 + i)) * len * 0.6;
		const cy = y + Math.sin(a + 0.6 * Math.sin(t * 1.7 + i)) * len * 0.5;
		tendril(ctx, x, y, cx, cy, ex, ey, 30 * s, t + i);
	}
	// The ones with hold of someone
	for (const [i, g] of (pose.grabs ?? []).entries()) {
		const ex = x + (g.x - x) * g.k;
		const ey = y + (g.y - y) * g.k;
		const cx = (x + ex) / 2 + Math.sin(t * 2 + i * 1.7) * 70 * s;
		const cy = (y + ey) / 2 - 80 * s;
		tendril(ctx, x, y, cx, cy, ex, ey, 34 * s, t + i * 3);
	}

	// The storm body: churning yellow cloud
	ctx.globalCompositeOperation = 'lighter';
	for (let i = 0; i < 14; i++) {
		const a = t * (0.5 + (i % 3) * 0.2) + i * 1.9;
		const r = (60 + (i % 4) * 28) * s;
		const bx = x + Math.cos(a) * r * 0.9;
		const by = y + Math.sin(a) * r * 0.6;
		const br = (90 + (i % 5) * 18) * s * (1 + hit * 0.15);
		const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
		g.addColorStop(0, `rgba(255, ${200 + hit * 50}, 60, ${0.22 + hit * 0.15})`);
		g.addColorStop(0.5, 'rgba(220, 140, 20, 0.12)');
		g.addColorStop(1, 'rgba(120, 60, 0, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(bx, by, br, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalCompositeOperation = 'source-over';

	// The skull in the middle of it
	const fx = x + Math.sin(t * 0.9) * 6 * s - hit * 14 * s;
	const fy = y - 10 * s;
	ctx.fillStyle = 'rgba(70, 40, 6, 0.85)';
	ctx.beginPath();
	ctx.ellipse(fx, fy, 70 * s, 82 * s, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#e8b830';
	ctx.beginPath();
	ctx.ellipse(fx, fy - 6 * s, 60 * s, 66 * s, 0, 0, Math.PI * 2);
	ctx.fill();
	// Cheekbones in, jaw hanging open
	ctx.fillStyle = '#c98a16';
	ctx.beginPath();
	ctx.moveTo(fx - 58 * s, fy + 4 * s);
	ctx.quadraticCurveTo(fx - 40 * s, fy + 40 * s, fx - 26 * s, fy + 70 * s);
	ctx.lineTo(fx + 26 * s, fy + 70 * s);
	ctx.quadraticCurveTo(fx + 40 * s, fy + 40 * s, fx + 58 * s, fy + 4 * s);
	ctx.fill();
	const jaw = (18 + 10 * Math.sin(t * 3) + rage * 14) * s;
	ctx.fillStyle = '#1a0e02';
	ctx.beginPath();
	ctx.ellipse(fx, fy + 44 * s, 24 * s, jaw * 0.6, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#f6dc80';
	ctx.lineWidth = 4 * s;
	for (let i = -2; i <= 2; i++) {
		ctx.beginPath();
		ctx.moveTo(fx + i * 9 * s, fy + 44 * s - jaw * 0.6);
		ctx.lineTo(fx + i * 9 * s, fy + 44 * s - jaw * 0.6 + 9 * s);
		ctx.stroke();
	}
	// Eye sockets, burning
	for (const side of [-1, 1]) {
		const ex = fx + side * 24 * s;
		const ey = fy - 12 * s;
		ctx.fillStyle = '#1a0e02';
		ctx.beginPath();
		ctx.ellipse(ex, ey, 17 * s, 14 * s, side * -0.35, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalCompositeOperation = 'lighter';
		const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 26 * s);
		g.addColorStop(0, `rgba(255, 250, 200, ${0.6 + rage * 0.4})`);
		g.addColorStop(0.4, `rgba(255, 190, 40, ${0.4 + rage * 0.3})`);
		g.addColorStop(1, 'rgba(255, 120, 0, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(ex, ey, 26 * s, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalCompositeOperation = 'source-over';
	}
	ctx.restore();
}

function tendril(ctx: CanvasRenderingContext2D, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number, t: number) {
	ctx.strokeStyle = 'rgba(90, 50, 6, 0.9)';
	ctx.lineWidth = w;
	ctx.beginPath();
	ctx.moveTo(x0, y0);
	ctx.quadraticCurveTo(cx, cy, x1, y1);
	ctx.stroke();
	ctx.strokeStyle = 'rgba(240, 180, 40, 0.85)';
	ctx.lineWidth = w * 0.55;
	ctx.stroke();
	ctx.strokeStyle = `rgba(255, 240, 160, ${0.4 + 0.3 * Math.sin(t * 5)})`;
	ctx.lineWidth = w * 0.18;
	ctx.stroke();
}
