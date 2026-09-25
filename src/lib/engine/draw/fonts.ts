// The game's two fonts (self-hosted, see src/routes/+layout.svelte):
//   Orbitron  a sci-fi display face for big moments: titles, callouts, banners
//   Exo 2     a readable techy face for everything else: HUD, numbers, labels
// Canvas text needs them spelled out in each ctx.font, so they live here.

const FONT_DISPLAY = "'Orbitron Variable', 'Exo 2 Variable', system-ui, sans-serif";
const FONT_UI = "'Exo 2 Variable', system-ui, sans-serif";

/** A ctx.font string in the display face. */
export const displayFont = (weight: number, size: number) => `${weight} ${size}px ${FONT_DISPLAY}`;

/** A ctx.font string in the UI face. */
export const uiFont = (weight: number, size: number, italic = false) => `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT_UI}`;

/**
 * Canvas text doesn't make the browser download a font, so ask for the ones
 * the game draws with up front (otherwise the first callouts would show in
 * the fallback font).
 */
export function preloadFonts(): Promise<unknown> {
	if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
	return Promise.all([
		document.fonts.load(displayFont(900, 20)),
		document.fonts.load(uiFont(700, 12)),
		document.fonts.load(uiFont(800, 14, true))
	]).catch(() => undefined);
}
