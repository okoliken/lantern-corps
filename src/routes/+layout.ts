// The whole game runs in the browser: no server rendering, nothing prerendered.
// The build is a static site (adapter-static) whose index.html answers every route.
export const ssr = false;
export const prerender = false;
