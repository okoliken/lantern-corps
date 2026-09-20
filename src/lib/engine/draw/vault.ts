// The Manhunters' vault (Act 2, The Guardians' Shame): a door the size of a
// building set into dead rock, sealed with the Guardians' light, and the
// three pylons round it that hold the seal.

import { green, greenCore } from '../../theme';

const TAU = Math.PI * 2;
const STEEL = '#39414f';
const STEEL_DARK = '#1c222c';
const STEEL_LIT = '#5a6578';
const MH_EYE = '#ff8a2a';

/**
 * The vault door, seen face-on, rising from the ground at (x, y).
 * `seal` 1..0 is how much of the Guardians' seal is left (it cracks as the
 * Red Lanterns cut at it); `open` 0..1 is the door itself coming apart;
 * `resealed` 0..1 is the Lanterns' new seal going on.
 */
export function drawVaultDoor(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seal: number, open: number, resealed: number) {
	const w = 420;
	const h = 380;
	ctx.save();
	ctx.translate(x, y);

	// The rock face it's set into
	ctx.fillStyle = '#161b24';
	ctx.beginPath();
	ctx.moveTo(-w * 0.85, 0);
	ctx.lineTo(-w * 0.7, -h * 0.9);
	ctx.lineTo(-w * 0.3, -h * 1.25);
	ctx.lineTo(w * 0.35, -h * 1.2);
	ctx.lineTo(w * 0.75, -h * 0.85);
	ctx.lineTo(w * 0.85, 0);
	ctx.closePath();
	ctx.fill();

	// What's behind the door, when it opens: the dark, and eyes in it
	ctx.fillStyle = '#040508';
	ctx.fillRect(-w / 2, -h, w, h);
	if (open > 0) {
		const glow = ctx.createRadialGradient(0, -h * 0.45, 10, 0, -h * 0.45, w * 0.6);
		glow.addColorStop(0, `rgba(255, 138, 42, ${0.35 * open})`);
		glow.addColorStop(1, 'rgba(255, 138, 42, 0)');
		ctx.fillStyle = glow;
		ctx.fillRect(-w / 2, -h, w, h);
		ctx.fillStyle = MH_EYE;
		for (let i = 0; i < 9; i++) {
			const ex = -w * 0.4 + ((i * 97) % 100) * 0.01 * w * 0.8;
			const ey = -h * 0.2 - ((i * 53) % 100) * 0.01 * h * 0.6;
			if (Math.sin(time * 2 + i * 1.7) > -0.3) ctx.fillRect(ex, ey, 9 * open, 2.5);
		}
	}

	// The two halves of the door, sliding apart as it opens
	const gap = open * w * 0.42;
	for (const side of [-1, 1]) {
		ctx.save();
		ctx.translate(side * gap, 0);
		const half = ctx.createLinearGradient(0, -h, side * w * 0.5, 0);
		half.addColorStop(0, STEEL_LIT);
		half.addColorStop(1, STEEL_DARK);
		ctx.fillStyle = half;
		ctx.strokeStyle = '#07090d';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.rect(side < 0 ? -w / 2 : 0, -h, w / 2, h);
		ctx.fill();
		ctx.stroke();
		// Plating and rivets
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
		ctx.lineWidth = 2;
		for (let i = 1; i < 4; i++) {
			ctx.beginPath();
			ctx.moveTo(side < 0 ? -w / 2 : 0, -h + (i * h) / 4);
			ctx.lineTo(side < 0 ? 0 : w / 2, -h + (i * h) / 4);
			ctx.stroke();
		}
		// Half of the Manhunters' mark on each
		ctx.strokeStyle = STEEL;
		ctx.lineWidth = 10;
		ctx.beginPath();
		ctx.arc(0, -h * 0.5, 70, side < 0 ? Math.PI / 2 : -Math.PI / 2, side < 0 ? (Math.PI * 3) / 2 : Math.PI / 2);
		ctx.stroke();
		ctx.restore();
	}

	// The Guardians' old seal: a lattice of green light over the door, cracking
	if (seal > 0 && resealed < 1) {
		ctx.save();
		ctx.globalAlpha = seal * (0.55 + 0.2 * Math.sin(time * 3));
		ctx.strokeStyle = green(0.9);
		ctx.shadowColor = green(1);
		ctx.shadowBlur = 12;
		ctx.lineWidth = 3;
		for (let i = 0; i <= 6; i++) {
			// Fewer strands as it fails
			if (i / 6 > seal + 0.15) continue;
			const px = -w / 2 + (i * w) / 6;
			ctx.beginPath();
			ctx.moveTo(px, -h);
			ctx.lineTo(px + (i % 2 ? 30 : -30) * (1 - seal), 0);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-w / 2, -h + (i * h) / 6);
			ctx.lineTo(w / 2, -h + (i * h) / 6);
			ctx.stroke();
		}
		ctx.restore();
	}
	// The new seal: solid, bright, from the three pylons
	if (resealed > 0) {
		ctx.save();
		ctx.globalAlpha = resealed;
		const shield = ctx.createLinearGradient(0, -h, 0, 0);
		shield.addColorStop(0, greenCore(0.55));
		shield.addColorStop(1, green(0.35));
		ctx.fillStyle = shield;
		ctx.fillRect(-w / 2 - 8, -h - 8, w + 16, h + 8);
		ctx.strokeStyle = greenCore(0.9);
		ctx.shadowColor = green(1);
		ctx.shadowBlur = 20;
		ctx.lineWidth = 4;
		ctx.strokeRect(-w / 2 - 8, -h - 8, w + 16, h + 8);
		ctx.restore();
	}
	ctx.restore();
}

/** The cliff the vault is set into: a wall of dead rock along the top of the map, from x0 to x1, down to `base`. */
export function drawCliff(ctx: CanvasRenderingContext2D, x0: number, x1: number, base: number) {
	const rock = ctx.createLinearGradient(0, 0, 0, base);
	rock.addColorStop(0, '#0b0e14');
	rock.addColorStop(1, '#1b212c');
	ctx.fillStyle = rock;
	ctx.fillRect(x0, 0, x1 - x0, base);
	// Strata and cracks
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
	ctx.lineWidth = 3;
	for (let y = 60; y < base; y += 85) {
		ctx.beginPath();
		for (let x = x0; x <= x1; x += 120) ctx.lineTo(x, y + Math.sin(x * 0.013 + y) * 14);
		ctx.stroke();
	}
	// Where it meets the ground
	ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
	ctx.fillRect(x0, base - 6, x1 - x0, 14);
}

/**
 * A seal pylon: a stone pillar with a lantern-light at the top. `charge` 0..1
 * is how far a Lantern has charged it; `charging` means one is doing it now.
 */
export function drawPylon(ctx: CanvasRenderingContext2D, x: number, y: number, charge: number, charging: boolean, time: number) {
	ctx.save();
	ctx.translate(x, y);
	// Where to stand to charge it
	ctx.strokeStyle = green(charge >= 1 ? 0.5 : 0.25 + (charging ? 0.35 : 0));
	ctx.lineWidth = 2;
	ctx.setLineDash(charge >= 1 ? [] : [10, 8]);
	ctx.lineDashOffset = -time * 20;
	ctx.beginPath();
	ctx.ellipse(0, 0, 110, 42, 0, 0, TAU);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
	ctx.beginPath();
	ctx.ellipse(0, 0, 30, 9, 0, 0, TAU);
	ctx.fill();
	// The pillar
	const stone = ctx.createLinearGradient(-20, 0, 20, 0);
	stone.addColorStop(0, STEEL_LIT);
	stone.addColorStop(1, STEEL_DARK);
	ctx.fillStyle = stone;
	ctx.strokeStyle = '#07090d';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(-22, 0);
	ctx.lineTo(-14, -150);
	ctx.lineTo(14, -150);
	ctx.lineTo(22, 0);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// How charged it is: light climbing the pillar
	ctx.fillStyle = green(0.75);
	ctx.shadowColor = green(1);
	ctx.shadowBlur = 8;
	ctx.fillRect(-4, -150 * charge, 8, 150 * charge);
	// The light at the top
	const lit = charge >= 1 ? 1 : charge * 0.7 + (charging ? 0.2 + 0.1 * Math.sin(time * 12) : 0);
	const glow = ctx.createRadialGradient(0, -168, 2, 0, -168, 46);
	glow.addColorStop(0, greenCore(0.4 + 0.6 * lit));
	glow.addColorStop(0.4, green(0.5 * lit + 0.1));
	glow.addColorStop(1, green(0));
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(0, -168, 46, 0, TAU);
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.fillStyle = STEEL_DARK;
	ctx.beginPath();
	ctx.moveTo(-16, -150);
	ctx.lineTo(0, -186);
	ctx.lineTo(16, -150);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

/** A sealed pylon's beam to the vault door. */
export function drawSealBeam(ctx: CanvasRenderingContext2D, x: number, y: number, doorX: number, doorY: number, time: number) {
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	ctx.strokeStyle = green(0.35 + 0.1 * Math.sin(time * 6));
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.moveTo(x, y - 168);
	ctx.lineTo(doorX, doorY - 190);
	ctx.stroke();
	ctx.strokeStyle = greenCore(0.7);
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.restore();
}
