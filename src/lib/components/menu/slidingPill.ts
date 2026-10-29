// A Svelte action for a row of tabs: one highlight that slides to whichever
// child is picked (has the `on` class), instead of each tab lighting up on
// its own. The pill is styled by the page (`.host :global(.pill)`); the
// picked tab drops its own background so the pill shows through.

export function slidingPill(node: HTMLElement, selector = '.on') {
	node.classList.add('pill-host');
	const pill = document.createElement('span');
	pill.className = 'pill';
	pill.setAttribute('aria-hidden', 'true');
	node.prepend(pill);
	let placed = false;

	const place = () => {
		const on = node.querySelector<HTMLElement>(`:scope > ${selector}`);
		if (!on) {
			pill.style.opacity = '0';
			return;
		}
		// The first time it just appears where it belongs; after that it slides
		if (!placed) pill.style.transition = 'none';
		pill.style.opacity = '1';
		pill.style.width = `${on.offsetWidth}px`;
		pill.style.height = `${on.offsetHeight}px`;
		pill.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
		if (!placed) {
			void pill.offsetWidth;
			pill.style.transition = '';
			placed = true;
		}
	};

	const classes = new MutationObserver(place);
	classes.observe(node, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
	const sizes = new ResizeObserver(place);
	sizes.observe(node);
	place();
	// Fonts arriving late change the tabs' widths
	document.fonts?.ready.then(place);

	return {
		destroy() {
			classes.disconnect();
			sizes.disconnect();
			pill.remove();
		}
	};
}
