<script lang="ts">
	// Behind every menu: a flat green field tiled with ring doodles (emblems,
	// rings, stars, chevrons) that drift slowly, and comic halftone dots at the top.
	const tile = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" fill="none" stroke="#3dff6e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
		<g transform="translate(34 34)"><circle r="16"/><circle r="6"/><path d="M-19 -9h38M-19 9h38"/></g>
		<g transform="translate(128 44)"><circle r="9"/></g>
		<path d="M118 120l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z"/>
		<path d="M24 128l12 10 12-10"/>
		<g transform="translate(80 92)"><path d="M-6 0h12M0 -6v12"/></g>
		<path d="M150 160c6-6 14-6 20 0"/>
	</svg>`);
</script>

<div class="backdrop" aria-hidden="true" style:--tile="url('data:image/svg+xml,{tile}')">
	<div class="doodles"></div>
	<div class="dots"></div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		background: #0c3a24;
	}
	.doodles {
		position: absolute;
		inset: -180px;
		background-image: var(--tile);
		background-size: 180px 180px;
		opacity: 0.16;
		animation: drift 60s linear infinite;
	}
	/* Comic-print halftone, heaviest at the top and fading down */
	.dots {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, rgba(61, 255, 110, 0.22) 1.6px, transparent 2px);
		background-size: 14px 14px;
		-webkit-mask-image: radial-gradient(ellipse 70% 55% at 50% 0%, #000 0%, transparent 70%);
		mask-image: radial-gradient(ellipse 70% 55% at 50% 0%, #000 0%, transparent 70%);
	}
	@keyframes drift {
		to {
			transform: translate(180px, 180px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.doodles {
			animation: none;
		}
	}
</style>
