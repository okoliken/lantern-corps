<script lang="ts">
	// The phone pad: a PS-style controller on your phone for the game running
	// on your computer, PPSSPP-style. Open it from the QR code in the game's
	// pause menu (Phone pad): both join the same room on the dev server's
	// relay, and everything you press here goes straight to the game.
	//
	// Left stick moves, right stick aims (and fires), the face buttons, the
	// shoulders, Select and Start. See $lib/engine/pad.ts for what each does.
	import { onMount } from 'svelte';
	import { PAD_LABELS, type PadButton } from '$lib/engine/pad';

	const room = (new URLSearchParams(location.search).get('room') ?? '').toUpperCase();
	let status = $state<'connecting' | 'connected' | 'noRoom'>(room ? 'connecting' : 'noRoom');
	let games = $state(0);

	// Sticks: -1..1 each way, and where they're drawn
	const STICK_R = 0.16; // of the screen height
	let left = $state({ x: 0, y: 0, cx: 0.18, cy: 0.66, active: false });
	let right = $state({ x: 0, y: 0, cx: 0.62, cy: 0.72, active: false });
	let pressed = $state<Record<string, boolean>>({});

	let socket: WebSocket | null = null;
	let dirty = false;

	function send(msg: object) {
		if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
	}

	function connect() {
		if (!room) return;
		const proto = location.protocol === 'https:' ? 'wss' : 'ws';
		const ws = new WebSocket(`${proto}://${location.host}/pad-ws?role=pad&room=${room}`);
		socket = ws;
		ws.onopen = () => {
			status = 'connected';
			dirty = true;
		};
		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(String(event.data));
				if (msg.t === 'buzz') navigator.vibrate?.(msg.ms ?? 30);
			} catch {
				// not for us
			}
		};
		ws.onclose = () => {
			status = 'connecting';
			socket = null;
			setTimeout(connect, 1000);
		};
	}

	// ---- Buttons ----
	function down(b: PadButton) {
		if (pressed[b]) return;
		pressed[b] = true;
		navigator.vibrate?.(8);
		send({ t: 'down', b });
	}
	function up(b: PadButton) {
		if (!pressed[b]) return;
		pressed[b] = false;
		send({ t: 'up', b });
	}

	// ---- Touches: which finger is on which stick or button ----
	const owners = new Map<number, 'left' | 'right' | PadButton>();

	function stickFrom(e: PointerEvent, stick: typeof left) {
		const h = window.innerHeight;
		const r = STICK_R * h;
		let dx = (e.clientX - stick.cx * window.innerWidth) / r;
		let dy = (e.clientY - stick.cy * h) / r;
		const d = Math.hypot(dx, dy);
		if (d > 1) {
			dx /= d;
			dy /= d;
		}
		stick.x = dx;
		stick.y = dy;
		dirty = true;
	}

	function onDown(e: PointerEvent) {
		e.preventDefault();
		void goFullscreen();
		const el = (e.target as HTMLElement).closest('[data-btn]') as HTMLElement | null;
		if (el) {
			const b = el.dataset.btn as PadButton;
			owners.set(e.pointerId, b);
			down(b);
			return;
		}
		const w = window.innerWidth;
		const h = window.innerHeight;
		const side = e.clientX < w * 0.45 ? 'left' : 'right';
		const stick = side === 'left' ? left : right;
		if (stick.active) return;
		owners.set(e.pointerId, side);
		// The stick comes to your thumb (a floating stick), staying clear of the edges
		stick.cx = Math.min(Math.max(e.clientX / w, 0.1), 0.9);
		stick.cy = Math.min(Math.max(e.clientY / h, 0.25), 0.85);
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
			stick.x = stick.y = 0;
			stick.active = false;
			// Back to its resting place
			if (who === 'left') Object.assign(stick, { cx: 0.18, cy: 0.66 });
			else Object.assign(stick, { cx: 0.62, cy: 0.72 });
			dirty = true;
		} else up(who);
	}

	async function goFullscreen() {
		try {
			if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
			await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
		} catch {
			// Not allowed here (iPhone Safari): it still works, just with the browser bars
		}
	}

	onMount(() => {
		connect();
		// Stick positions go out once a frame, and only when they changed
		let raf = 0;
		const tick = () => {
			if (dirty) {
				dirty = false;
				const r = (v: number) => Math.round(v * 100) / 100;
				send({ t: 'sticks', lx: r(left.x), ly: r(left.y), rx: r(right.x), ry: r(right.y) });
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		// Keep the screen on while playing
		let lock: { release: () => Promise<void> } | null = null;
		void (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
			?.request('screen')
			.then((l) => (lock = l))
			.catch(() => {});
		return () => {
			cancelAnimationFrame(raf);
			socket?.close();
			void lock?.release();
		};
	});

	const face: { b: PadButton; symbol: string; x: number; y: number; color: string }[] = [
		{ b: 'triangle', symbol: '△', x: 0, y: -1, color: '#3fe0b0' },
		{ b: 'circle', symbol: '○', x: 1, y: 0, color: '#ff5a6e' },
		{ b: 'cross', symbol: '✕', x: 0, y: 1, color: '#6fa8ff' },
		{ b: 'square', symbol: '□', x: -1, y: 0, color: '#ff7fd0' }
	];
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
	<title>Lantern Corps · Pad</title>
</svelte:head>

<div
	class="pad"
	role="application"
	aria-label="Game controller"
	onpointerdown={onDown}
	onpointermove={onMove}
	onpointerup={onUp}
	onpointercancel={onUp}
	oncontextmenu={(e) => e.preventDefault()}
>
	<div class="status" class:ok={status === 'connected'}>
		{#if status === 'noRoom'}
			Open this from the QR code in the game's pause menu (Phone pad)
		{:else if status === 'connected'}
			● Connected · {room}
		{:else}
			Connecting to {room}…
		{/if}
	</div>

	<!-- Shoulders -->
	<button class="shoulder l2" data-btn="l2" class:on={pressed.l2}>L2<small>{PAD_LABELS.l2}</small></button>
	<button class="shoulder l1" data-btn="l1" class:on={pressed.l1}>L1<small>{PAD_LABELS.l1}</small></button>
	<button class="shoulder r2" data-btn="r2" class:on={pressed.r2}>R2<small>{PAD_LABELS.r2}</small></button>
	<button class="shoulder r1" data-btn="r1" class:on={pressed.r1}>R1<small>{PAD_LABELS.r1}</small></button>

	<!-- Select and Start -->
	<button class="pill select" data-btn="select" class:on={pressed.select}>SELECT<small>{PAD_LABELS.select}</small></button>
	<button class="pill start" data-btn="start" class:on={pressed.start}>START<small>{PAD_LABELS.start}</small></button>

	<!-- Sticks -->
	{#each [left, right] as stick, i (i)}
		<div class="stick" class:active={stick.active} style:left="{stick.cx * 100}vw" style:top="{stick.cy * 100}vh">
			<div class="knob" style:transform="translate({stick.x * STICK_R * 100}vh, {stick.y * STICK_R * 100}vh)"></div>
			<span class="stick-label">{i === 0 ? 'Move' : 'Aim · fire'}</span>
		</div>
	{/each}

	<!-- Face buttons -->
	<div class="face">
		{#each face as f (f.b)}
			<button class="round" data-btn={f.b} class:on={pressed[f.b]} style:--x={f.x} style:--y={f.y} style:--c={f.color}>
				<span>{f.symbol}</span>
				<small>{PAD_LABELS[f.b]}</small>
			</button>
		{/each}
	</div>

	<div class="rotate">Turn your phone sideways</div>
</div>

<style>
	.pad {
		position: fixed;
		inset: 0;
		overflow: hidden;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		overscroll-behavior: none;
		background: radial-gradient(ellipse at 50% 40%, #0a1a12 0%, #03060a 70%);
		color: #d8f5e0;
		font-family: var(--font-ui);
	}
	button {
		position: absolute;
		display: grid;
		place-items: center;
		align-content: center;
		margin: 0;
		padding: 0;
		border: 2px solid rgba(216, 245, 224, 0.35);
		background: rgba(216, 245, 224, 0.06);
		color: rgba(216, 245, 224, 0.85);
		font: 800 3.2vh var(--font-display);
		letter-spacing: 0.05em;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
	}
	button small {
		font: 600 1.8vh var(--font-ui);
		letter-spacing: 0;
		opacity: 0.65;
		text-transform: none;
	}
	button.on {
		background: color-mix(in srgb, var(--green) 30%, transparent);
		border-color: var(--green);
	}
	.status {
		position: absolute;
		top: 17vh;
		left: 50%;
		transform: translateX(-50%);
		font-size: 2.2vh;
		opacity: 0.7;
		white-space: nowrap;
	}
	.status.ok {
		color: var(--green);
		opacity: 1;
	}

	.shoulder {
		width: 17vw;
		height: 10vh;
		border-radius: 1.4vh;
	}
	.l2 {
		top: 2vh;
		left: 2vw;
	}
	.l1 {
		top: 14vh;
		left: 2vw;
	}
	.r2 {
		top: 2vh;
		right: 2vw;
	}
	.r1 {
		top: 14vh;
		right: 2vw;
	}
	.pill {
		top: 4vh;
		width: 12vw;
		height: 8vh;
		border-radius: 5vh;
		font-size: 1.9vh;
	}
	.select {
		left: 36vw;
	}
	.start {
		right: 36vw;
	}

	.stick {
		position: absolute;
		width: 32vh;
		height: 32vh;
		margin: -16vh 0 0 -16vh;
		border-radius: 50%;
		border: 2px solid rgba(216, 245, 224, 0.25);
		background: rgba(216, 245, 224, 0.04);
		pointer-events: none;
	}
	.stick.active {
		border-color: color-mix(in srgb, var(--green) 60%, transparent);
	}
	.knob {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 14vh;
		height: 14vh;
		margin: -7vh 0 0 -7vh;
		border-radius: 50%;
		background: rgba(216, 245, 224, 0.18);
		border: 2px solid rgba(216, 245, 224, 0.5);
	}
	.stick.active .knob {
		background: color-mix(in srgb, var(--green) 35%, transparent);
		border-color: var(--green);
	}
	.stick-label {
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translate(-50%, 0.6vh);
		font-size: 1.8vh;
		opacity: 0.5;
		white-space: nowrap;
	}

	.face {
		position: absolute;
		left: 84vw;
		top: 55vh;
		width: 0;
		height: 0;
	}
	.round {
		width: 15vh;
		height: 15vh;
		margin: -7.5vh 0 0 -7.5vh;
		left: calc(var(--x) * 15vh);
		top: calc(var(--y) * 15vh);
		border-radius: 50%;
		border-color: color-mix(in srgb, var(--c) 60%, transparent);
	}
	.round span {
		color: var(--c);
		font: 400 5.5vh system-ui, sans-serif;
		line-height: 1;
	}
	.round.on {
		background: color-mix(in srgb, var(--c) 35%, transparent);
		border-color: var(--c);
	}

	.rotate {
		display: none;
	}
	@media (orientation: portrait) {
		.rotate {
			display: grid;
			place-items: center;
			position: absolute;
			inset: 0;
			background: #03060a;
			font-size: 1.3rem;
			color: var(--green);
		}
	}
</style>
