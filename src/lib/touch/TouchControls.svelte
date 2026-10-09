<script lang="ts">
	// Touch controls drawn over the game, for playing on a phone or tablet's
	// own screen: the same controller as the phone pad (/pad), laid out to
	// leave the fight visible.
	//
	//   left side      a floating stick: put your thumb down anywhere and push
	//   right side     a floating aim stick (it fires as you aim); the ring
	//                  auto-aims too, so □ on its own shoots whatever is nearest
	//   face buttons   □ shot  ✕ construct  ○ shield  △ fly
	//   above them     ◀ ▶ previous / next construct, ◎ lock a target, and the
	//                  signature, lit up when it's ready
	//   the hotbar     tap a construct's slot (top left) to use it; hold it for
	//                  the beam and the guns
	//   bottom middle  Backup and Pause
	//
	// It writes straight into a PadState that the first Lantern reads through
	// PadInput, just as the phone pad does over the network.
	import { onMount } from 'svelte';
	import type { Game } from '$lib/engine/game';
	import type { PadButton, PadMessage, PadState } from '$lib/engine/pad';
	import { goFullscreen, keepAwake, stopZooming } from './phone';
	import { HUD_CHIP } from '$lib/engine/draw/effects';

	/** Seconds the full hotbar stays open if nothing is picked from it. */
	const HOTBAR_OPEN = 5;

	interface Props {
		game: Game;
		state: PadState;
		canvas: HTMLCanvasElement;
	}

	let { game, state: pad, canvas }: Props = $props();

	const apply = (msg: PadMessage) => pad.apply(msg);

	// ---- Sticks: -1..1 each way; where they rest, as a share of the screen ----
	const REST = { left: { cx: 0.13, cy: 0.74 }, right: { cx: 0.6, cy: 0.78 } };
	let left = $state({ x: 0, y: 0, ...REST.left, active: false });
	let right = $state({ x: 0, y: 0, ...REST.right, active: false });
	let pressed = $state<Record<string, boolean>>({});
	/** The signature is ready (lights up R2), and whether there's backup to call. */
	let surgeReady = $state(false);
	/** Only while the fight is on: behind a briefing, a scene, the pause menu or the results they'd be in the way. */
	let live = $state(false);
	let size = $state({ w: 0, h: 0 });
	/** How big the stick circle is, in px. */
	const stickR = $derived(Math.max(46, Math.min(70, size.h * 0.15)));

	type Owner = 'left' | 'right' | PadButton | { slot: number };
	const owners = new Map<number, Owner>();

	function down(b: PadButton) {
		if (pressed[b]) return;
		pressed[b] = true;
		navigator.vibrate?.(8);
		apply({ t: 'down', b });
		// Start is Esc: pause (and it unpauses from the pause menu's own button)
		if (b === 'start') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
	}
	function up(b: PadButton) {
		if (!pressed[b]) return;
		pressed[b] = false;
		apply({ t: 'up', b });
	}

	function sendSticks() {
		const held = (Object.keys(pressed) as PadButton[]).filter((b) => pressed[b]);
		apply({ t: 'sticks', lx: left.x, ly: left.y, rx: right.x, ry: right.y, held });
	}

	function stickFrom(e: PointerEvent, stick: typeof left) {
		let dx = (e.clientX - stick.cx * size.w) / stickR;
		let dy = (e.clientY - stick.cy * size.h) / stickR;
		const d = Math.hypot(dx, dy);
		if (d > 1) {
			dx /= d;
			dy /= d;
		}
		stick.x = dx;
		stick.y = dy;
		sendSticks();
	}

	/** A construct slot (or the shield box) on the HUD under this point, if any. */
	function slotAt(x: number, y: number): number | null {
		const r = canvas.getBoundingClientRect();
		const px = x - r.left;
		const py = y - r.top;
		const pad = 4;
		const hit = game.hudSlots.find((s) => px >= s.x - pad && px <= s.x + s.w + pad && py >= s.y - pad && py <= s.y + s.h + pad);
		return hit ? hit.slot : null;
	}

	function onDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		e.preventDefault();
		void goFullscreen();
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			// not supported: bubbling still gets it
		}
		const el = (e.target as HTMLElement).closest('[data-btn]') as HTMLElement | null;
		if (el) {
			const b = el.dataset.btn as PadButton;
			owners.set(e.pointerId, b);
			down(b);
			return;
		}
		// The hotbar: a construct's slot uses it; the shield box is the shield
		const slot = slotAt(e.clientX, e.clientY);
		if (slot !== null) {
			navigator.vibrate?.(8);
			if (slot === HUD_CHIP) {
				// The construct chip opens the full hotbar (and closes it again)
				game.hotbarOpenUntil = game.time < game.hotbarOpenUntil ? 0 : game.time + HOTBAR_OPEN;
			} else if (slot < 0) {
				owners.set(e.pointerId, 'circle');
				down('circle');
			} else {
				owners.set(e.pointerId, { slot });
				apply({ t: 'select', slot });
				// Picked: it folds away again
				game.hotbarOpenUntil = 0;
			}
			return;
		}
		const side = e.clientX < size.w * 0.42 ? 'left' : 'right';
		const stick = side === 'left' ? left : right;
		if (stick.active) return;
		owners.set(e.pointerId, side);
		// The stick comes to your thumb, staying clear of the edges
		stick.cx = Math.min(Math.max(e.clientX / size.w, 0.08), 0.92);
		stick.cy = Math.min(Math.max(e.clientY / size.h, 0.3), 0.88);
		stick.active = true;
		stickFrom(e, stick);
	}

	function onMove(e: PointerEvent) {
		const who = owners.get(e.pointerId);
		if (who === 'left') stickFrom(e, left);
		else if (who === 'right') stickFrom(e, right);
	}

	function onUp(e: PointerEvent) {
		const who = owners.get(e.pointerId);
		owners.delete(e.pointerId);
		if (!who) return;
		if (who === 'left' || who === 'right') {
			const stick = who === 'left' ? left : right;
			Object.assign(stick, { x: 0, y: 0, active: false }, REST[who]);
			sendSticks();
		} else if (typeof who === 'object') apply({ t: 'unselect' });
		else up(who);
	}

	/** Every finger is off the glass (or the page was hidden): nothing can still be held. */
	function letGoOfEverything() {
		owners.clear();
		Object.assign(left, { x: 0, y: 0, active: false }, REST.left);
		Object.assign(right, { x: 0, y: 0, active: false }, REST.right);
		for (const b of Object.keys(pressed) as PadButton[]) up(b);
		apply({ t: 'unselect' });
		sendSticks();
	}

	onMount(() => {
		pad.connected = 1;
		const allowZoom = stopZooming({ allowScroll: true });
		const sleep = keepAwake();
		// How far the notch reaches in (only CSS knows): the HUD keeps clear of it
		const probe = document.createElement('div');
		probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;padding-left:env(safe-area-inset-left);pointer-events:none;visibility:hidden';
		document.body.appendChild(probe);
		const measure = () => {
			size = { w: window.innerWidth, h: window.innerHeight };
			game.safeLeft = parseFloat(getComputedStyle(probe).paddingLeft) || 0;
		};
		measure();
		window.addEventListener('resize', measure);
		// Keep the state fresh (it lets go of a stick it hasn't heard about for half a second), and watch the surge meter
		const beat = setInterval(() => {
			sendSticks();
			const me = game.players[0];
			surgeReady = !!me && me.surge >= 100;
			const state = (game.director as { state?: string } | null)?.state;
			const over = state === 'won' || state === 'lost';
			// Any dialog on the page (a briefing, the pause menu, a results screen) gets the screen to itself
			const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
			const next = !game.paused && !over && !dialog;
			if (live && !next) letGoOfEverything();
			live = next;
		}, 60);
		const touchEnd = (e: TouchEvent) => {
			if (e.touches.length === 0) letGoOfEverything();
		};
		const hidden = () => {
			if (document.hidden) letGoOfEverything();
		};
		document.addEventListener('touchend', touchEnd);
		document.addEventListener('touchcancel', touchEnd);
		document.addEventListener('visibilitychange', hidden);
		return () => {
			clearInterval(beat);
			probe.remove();
			window.removeEventListener('resize', measure);
			document.removeEventListener('touchend', touchEnd);
			document.removeEventListener('touchcancel', touchEnd);
			document.removeEventListener('visibilitychange', hidden);
			allowZoom();
			sleep();
			pad.connected = 0;
			pad.release();
		};
	});

	const face: { b: PadButton; symbol: string; label: string; x: number; y: number; color: string }[] = [
		{ b: 'triangle', symbol: '△', label: 'Fly', x: 0, y: -1, color: '#3fe0b0' },
		{ b: 'circle', symbol: '○', label: 'Shield', x: 1, y: 0, color: '#ff5a6e' },
		{ b: 'cross', symbol: '✕', label: 'Construct', x: 0, y: 1, color: '#6fa8ff' },
		{ b: 'square', symbol: '□', label: 'Shot', x: -1, y: 0, color: '#ff7fd0' }
	];
</script>

{#if live}
<div
	class="touch"
	role="application"
	aria-label="Touch controls"
	onpointerdown={onDown}
	onpointermove={onMove}
	onpointerup={onUp}
	onpointercancel={onUp}
	oncontextmenu={(e) => e.preventDefault()}
>
	<!-- Sticks: faint where they rest, solid under a thumb -->
	{#each [left, right] as stick, i (i)}
		<div class="stick" class:active={stick.active} class:aim={i === 1} style:left="{stick.cx * 100}%" style:top="{stick.cy * 100}%" style:--r="{stickR}px">
			<div class="knob" style:transform="translate({stick.x * stickR * 0.6}px, {stick.y * stickR * 0.6}px)"></div>
		</div>
	{/each}

	<!-- Face buttons, bottom right -->
	<div class="face">
		{#each face as f (f.b)}
			<button
				data-btn={f.b}
				class:down={pressed[f.b]}
				style:--c={f.color}
				style:left="calc(50% + {f.x} * var(--gap))"
				style:top="calc(50% + {f.y} * var(--gap))"
				aria-label={f.label}
			>
				<span class="sym">{f.symbol}</span>
			</button>
		{/each}
	</div>

	<!-- Tucked beside the face buttons: lock a target, the signature (constructs: tap the slot at the top) -->
	<div class="shoulders">
		<button data-btn="l2" class="small" class:down={pressed.l2} aria-label="Lock a target">◎</button>
		<button data-btn="r2" class="sig" class:down={pressed.r2} class:ready={surgeReady} aria-label="Signature">★</button>
	</div>

	<!-- One pause, top left where you expect it; backup next to it -->
	<div class="system">
		<button data-btn="start" class="pausebtn" class:down={pressed.start} aria-label="Pause">❚❚</button>
		<button data-btn="select" class="pill" class:down={pressed.select}>Backup</button>
	</div>

</div>
{/if}



<style>
	/* with touch controls up, their own Pause button does the job: the corner one sits under this layer and can't be tapped */
	:global(button.pause[aria-label='Pause']) {
		display: none;
	}
	.touch {
		position: absolute;
		inset: 0;
		z-index: 4;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		--btn: clamp(44px, 12vh, 60px);
		--gap: calc(var(--btn) * 0.95);
	}
	.stick {
		position: absolute;
		width: calc(var(--r) * 2);
		height: calc(var(--r) * 2);
		margin: calc(var(--r) * -1) 0 0 calc(var(--r) * -1);
		border-radius: 50%;
		border: 2px solid rgba(61, 255, 110, 0.18);
		background: rgba(15, 79, 52, 0.12);
		pointer-events: none;
		display: grid;
		place-items: center;
	}
	.stick.aim {
		border-color: rgba(255, 127, 208, 0.16);
		background: rgba(255, 127, 208, 0.05);
	}
	/* Resting, the aim stick is only a hint: most of the time the ring aims itself */
	.stick.aim:not(.active) {
		opacity: 0;
	}
	.stick.active {
		border-color: rgba(61, 255, 110, 0.5);
		background: rgba(15, 79, 52, 0.28);
	}
	.stick.aim.active {
		border-color: rgba(255, 127, 208, 0.5);
		background: rgba(255, 127, 208, 0.12);
	}
	.knob {
		width: 44%;
		height: 44%;
		border-radius: 50%;
		background: rgba(61, 255, 110, 0.35);
		box-shadow: 0 0 14px rgba(61, 255, 110, 0.35);
	}
	.aim .knob {
		background: rgba(255, 127, 208, 0.35);
		box-shadow: 0 0 14px rgba(255, 127, 208, 0.3);
	}
	.hint {
		position: absolute;
		bottom: -1.3rem;
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0.45;
	}
	button {
		font: inherit;
		color: var(--text);
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
	}
	.face {
		position: absolute;
		right: calc(max(env(safe-area-inset-right), 0px) + var(--btn) * 0.55);
		bottom: calc(var(--btn) * 0.55);
		width: calc(var(--gap) * 2 + var(--btn));
		height: calc(var(--gap) * 2 + var(--btn));
	}
	.face button {
		position: absolute;
		width: var(--btn);
		height: var(--btn);
		margin: calc(var(--btn) / -2) 0 0 calc(var(--btn) / -2);
		border-radius: 50%;
		border: 2px solid color-mix(in srgb, var(--c) 70%, transparent);
		background: rgba(3, 6, 10, 0.45);
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0;
		padding: 0;
	}
	.face .sym {
		color: var(--c);
		font-size: calc(var(--btn) * 0.42);
		line-height: 1;
	}
	.face small {
		font-size: 0.55rem;
		opacity: 0.7;
		line-height: 1;
	}
	.face button.down {
		background: color-mix(in srgb, var(--c) 35%, rgba(3, 6, 10, 0.6));
		transform: scale(0.92);
	}
	.shoulders {
		position: absolute;
		right: calc(max(env(safe-area-inset-right), 0px) + var(--btn) * 0.55 + var(--gap) * 2 + var(--btn) + 6px);
		bottom: calc(var(--btn) * 0.55 + var(--gap) * 0.6);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.small,
	.sig {
		width: calc(var(--btn) * 0.7);
		height: calc(var(--btn) * 0.7);
		border-radius: 50%;
		border: 1px solid var(--suit-lit);
		background: rgba(3, 6, 10, 0.5);
		font-size: 1.05rem;
		padding: 0;
	}
	.sig {
		color: rgba(216, 245, 224, 0.4);
	}
	.sig.ready {
		color: var(--green);
		border-color: var(--green);
		box-shadow: 0 0 14px color-mix(in srgb, var(--green) 55%, transparent);
		animation: glow 0.9s ease-in-out infinite alternate;
	}
	@keyframes glow {
		to {
			box-shadow: 0 0 22px color-mix(in srgb, var(--green) 80%, transparent);
		}
	}
	.small.down,
	.sig.down {
		background: var(--suit);
	}
	.system {
		position: absolute;
		left: calc(max(env(safe-area-inset-left), 0px) + 10px);
		top: max(env(safe-area-inset-top), 10px);
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.pausebtn {
		width: 40px;
		height: 32px;
		border-radius: 8px;
		border: 1px solid var(--suit-lit);
		background: rgba(3, 6, 10, 0.6);
		color: var(--green);
		font-size: 0.85rem;
		padding: 0;
	}
	.pausebtn.down {
		background: var(--suit);
	}
	.pill {
		padding: 0.25rem 0.7rem;
		border-radius: 999px;
		position: fixed;
		left: 50%;
		bottom: max(env(safe-area-inset-bottom), 8px);
		transform: translateX(-50%);
		opacity: 0.8;
		border: 1px solid var(--suit-lit);
		background: rgba(3, 6, 10, 0.55);
		font-size: 0.75rem;
	}
	.pill.down {
		background: var(--suit);
	}
</style>
