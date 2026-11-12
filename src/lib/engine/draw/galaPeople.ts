// The people at the Ferris Aircraft gala, on the same skeleton as the
// Lanterns: Carol Ferris in her gown, and the guests in dinner jackets and
// evening dresses. Champagne, then panic.

import { HOVER_SPACE, drawLantern, type Figure, type LanternPose } from './lantern';

export const CAROL: Figure = {
	id: 'carol',
	look: { skin: '#f0c6a4', hair: '#4a2a18', hairStyle: 'long', mask: false },
	bulk: 0.86,
	outfit: { top: '#8c1528', topLit: '#b8233c', trousers: '#8c1528', boots: '#2a0a10', dress: '#a3172b' }
};

export interface Guest {
	dx: number;
	dy: number;
	figure: Figure;
	scale: number;
}

const SKINS = ['#e0b08a', '#8d5a3a', '#c48e66', '#f1cfae', '#5e3b26', '#a9714b'];
const HAIRS = ['#1a1410', '#4a2a18', '#7a5a3a', '#c9a35a', '#8c8478', '#2a1a10'];
const GOWNS = ['#1d3a66', '#5a1e4a', '#c8a43a', '#1a1a1e', '#2f6a5a', '#e6e0d4'];
const JACKETS = ['#16161c', '#1d1d26', '#2a2230', '#14243a', '#e8e2d4'];

export const GUESTS: Guest[] = (() => {
	const out: Guest[] = [];
	for (let i = 0; i < 22; i++) {
		const a = i * 2.39996;
		const r = 70 + 26 * Math.sqrt(i) * 3;
		const skin = SKINS[(i * 3) % SKINS.length];
		const hair = HAIRS[(i * 5) % HAIRS.length];
		const woman = i % 3 === 1;
		const figure: Figure = woman
			? {
					id: `guest${i}`,
					look: { skin, hair, hairStyle: i % 2 ? 'long' : 'bob', mask: false },
					bulk: 0.84,
					outfit: { top: GOWNS[i % GOWNS.length], topLit: GOWNS[i % GOWNS.length], trousers: GOWNS[i % GOWNS.length], boots: '#14100c', dress: GOWNS[i % GOWNS.length] }
				}
			: {
					id: `guest${i}`,
					look: { skin, hair, hairStyle: i % 4 === 0 ? 'swept' : 'cropped', mask: false },
					bulk: 0.95 + (i % 3) * 0.06,
					outfit: { top: JACKETS[i % JACKETS.length], topLit: JACKETS[i % JACKETS.length], trousers: '#121216', boots: '#0b0b0d', shirt: '#f2efe6', tie: '#0b0b0d' }
				};
		out.push({ dx: Math.cos(a) * r * 1.5, dy: 60 + Math.sin(a) * r * 0.55, figure, scale: woman ? 0.92 : 0.98 });
	}
	return out;
})();

function stand(dir: 1 | -1): LanternPose {
	return { dir, walkPhase: 0, altitude: 0, hoverHeight: HOVER_SPACE, lean: 0, glow: false, shadow: true, firing: false, aimX: dir, aimY: 0 };
}

/** A guest: chatting, glass up, or (when it goes wrong) flinching back with their arms up. */
export function drawGuest(ctx: CanvasRenderingContext2D, x: number, y: number, g: Guest, time: number, panic: boolean, i: number, scale = 1) {
	const dir: 1 | -1 = panic ? (Math.sin(time * 0.7 + i) > 0 ? 1 : -1) : i % 2 ? 1 : -1;
	const pose = stand(dir);
	if (panic) {
		pose.hurt = 0.55 + 0.3 * Math.sin(time * 7 + i * 1.3);
		pose.walkPhase = time * 9 + i;
	} else {
		// A glass raised now and then, a nod
		const sip = Math.max(0, Math.sin(time * 0.8 + i * 1.7));
		pose.firing = sip > 0.85;
		pose.aimX = dir * 0.4;
		pose.aimY = -0.9;
	}
	drawLantern(ctx, g.figure, x, y, pose, time + i, g.scale * scale);
}

/** Carol in her gala gown: on her feet, or held up in the air in his yellow grip. */
export function drawCarol(ctx: CanvasRenderingContext2D, x: number, y: number, alt: number, time: number, up: boolean, gripped: boolean, catchRange = 160, scale = 0.95, dir: 1 | -1 = 1) {
	ctx.save();
	if (up) {
		// Her shadow, and the ring round it: where to be when she falls
		ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
		ctx.beginPath();
		ctx.ellipse(x, y, 14 + alt * 0.03, 5 + alt * 0.01, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = `rgba(120, 255, 160, ${0.5 + 0.3 * Math.sin(time * 8)})`;
		ctx.lineWidth = 3;
		ctx.setLineDash([10, 8]);
		ctx.beginPath();
		ctx.ellipse(x, y, catchRange, catchRange * 0.45, 0, 0, Math.PI * 2);
		ctx.stroke();
		ctx.setLineDash([]);
	}
	if (gripped) {
		ctx.globalCompositeOperation = 'lighter';
		const g = ctx.createRadialGradient(x, y - alt - 50, 4, x, y - alt - 50, 80);
		g.addColorStop(0, 'rgba(255, 220, 90, 0.5)');
		g.addColorStop(1, 'rgba(255, 180, 0, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(x, y - alt - 50, 80, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalCompositeOperation = 'source-over';
	}
	const pose = stand(dir);
	pose.shadow = !up;
	if (up) {
		// Kicking, reaching for the ground
		pose.hurt = 0.6 + 0.3 * Math.sin(time * 7);
		pose.walkPhase = time * 6;
	}
	drawLantern(ctx, CAROL, x, y - alt, pose, time, scale);
	ctx.restore();
}
