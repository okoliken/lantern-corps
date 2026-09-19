<script lang="ts">
	// Pair your phone as a controller: a QR code for the phone pad (/pad) on
	// this game's room, the address to type if scanning isn't handy, and
	// whether a phone is connected.
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';
	import { padLink } from '$lib/pad/link';

	let url = $state('');
	let qr = $state('');
	let connected = $state(0);
	let problem = $state<'noRelay' | 'notExposed' | null>(null);

	onMount(() => {
		const link = padLink();
		connected = link.state.connected;
		link.onChange = () => (connected = link.state.connected);
		void (async () => {
			try {
				const res = await fetch('/pad-info');
				if (!res.ok) throw new Error();
				const info: { addresses: string[]; port: number; exposed: boolean } = await res.json();
				if (!info.exposed || info.addresses.length === 0) problem = 'notExposed';
				const host = info.addresses[0] ?? location.hostname;
				url = `http://${host}:${info.port}/pad?room=${link.room}`;
				qr = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#d8f5e0', light: '#00000000' } });
			} catch {
				problem = 'noRelay';
			}
		})();
		return () => (link.onChange = null);
	});
</script>

<div class="pairing">
	{#if problem === 'noRelay'}
		<p>The phone pad works while the game runs from <code>npm run dev:pad</code> on this computer.</p>
	{:else}
		<div class="qr" aria-label="QR code for the phone pad">{@html qr}</div>
		<div class="how">
			<p class="status" class:on={connected > 0}>
				{connected > 0 ? `Phone connected${connected > 1 ? ` (${connected})` : ''}` : 'No phone connected'}
			</p>
			<ol>
				<li>Put your phone on the same Wi-Fi as this computer.</li>
				<li>Scan the code with the phone's camera, or open <code>{url}</code></li>
				<li>Turn the phone sideways. The keyboard keeps working too.</li>
			</ol>
			{#if problem === 'notExposed'}
				<p class="warn">
					Your phone can't reach this computer yet: stop the dev server and start it with <code>npm run dev:pad</code>.
				</p>
			{/if}
			<p class="map">
				Left stick moves · right stick aims and fires · □ shot · ✕ construct · ○ shield · △ fly · L1/R1 switch construct · L2
				target · R2 signature · Select backup · Start pause
			</p>
		</div>
	{/if}
</div>

<style>
	.pairing {
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
		flex-wrap: wrap;
	}
	.qr {
		width: 11rem;
		height: 11rem;
		flex: none;
		padding: 0.4rem;
		border: 2px solid var(--suit-lit);
		border-radius: 10px;
		background: #0b1510;
	}
	.qr :global(svg) {
		width: 100%;
		height: 100%;
	}
	.how {
		flex: 1;
		min-width: 14rem;
	}
	.status {
		margin: 0 0 0.6rem;
		font-weight: 700;
		opacity: 0.8;
	}
	.status.on {
		color: var(--green);
		opacity: 1;
	}
	ol {
		margin: 0 0 0.6rem;
		padding-left: 1.2rem;
		line-height: 1.5;
	}
	code {
		word-break: break-all;
		color: var(--green);
	}
	.warn {
		color: #ffb86b;
	}
	.map {
		font-size: 0.8rem;
		opacity: 0.7;
	}
</style>
