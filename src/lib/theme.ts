// The game's green: one colour, everywhere. The UI (CSS variables, set from
// here in +layout.svelte) and everything drawn on the canvas (ring energy,
// glows, the HUD) take their green from this file, and the lighter and darker
// shades are mixed from it, so changing THEME_GREEN changes them all.
//
// Not everything green is the theme: the suits' bottle green and scenery
// (crops, alien skin) are their own colours.

/** The Green Lantern green: ring energy, glows, highlights, the UI accent. */
export const THEME_GREEN = '#3dff6e';

const rgbOf = (hex: string): [number, number, number] => [
	parseInt(hex.slice(1, 3), 16),
	parseInt(hex.slice(3, 5), 16),
	parseInt(hex.slice(5, 7), 16)
];
const hexOf = ([r, g, b]: [number, number, number]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** Mix the theme green toward another colour by `t` (0 = pure theme green). */
const mix = (to: [number, number, number], t: number): [number, number, number] => {
	const [r, g, b] = rgbOf(THEME_GREEN);
	return [r + (to[0] - r) * t, g + (to[1] - g) * t, b + (to[2] - b) * t];
};

const LIGHT_RGB = mix([255, 255, 255], 0.55);
const DIM_RGB = mix([0, 0, 0], 0.52);

/** A pale tint of the theme green: glowing eyes, highlights, light shafts. */
export const GREEN_LIGHT = hexOf(LIGHT_RGB);
/** A dark shade of the theme green: unlit lights, borders, "off" states. */
export const GREEN_DIM = hexOf(DIM_RGB);
/** The white-hot centre of ring energy (almost white, a touch of green). */
export const GREEN_CORE = hexOf(mix([255, 255, 255], 0.9));

const [R, G, B] = rgbOf(THEME_GREEN);
/** The theme green with transparency, for glows and fades: green(0.35). */
export const green = (alpha: number) => `rgba(${R}, ${G}, ${B}, ${alpha})`;
/** The white-hot centre of ring energy, with transparency. */
export const greenCore = (alpha: number) => `rgba(${rgbOf(GREEN_CORE).join(', ')}, ${alpha})`;
/** The pale tint with transparency. */
export const greenLight = (alpha: number) => `rgba(${LIGHT_RGB.map(Math.round).join(', ')}, ${alpha})`;
/** The theme green darkened by `t` (0..1) toward black, for scenery lit by it. */
export const greenShade = (t: number) => hexOf(mix([0, 0, 0], t));
/** The theme green's red, green and blue, for code that mixes its own colours. */
export const THEME_GREEN_RGB = rgbOf(THEME_GREEN);
