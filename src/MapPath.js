// Shared world-map numbers.
//
// The chapter maps no longer come from here: every world spot, road leg,
// secret and gate lives in the chapter layouts in src/maps, and the road is
// drawn by src/maps/routeRender.js. What is left is the world map's header
// strip, shared with anything drawn under it.

// WorldMapScene.createHeader paints the bar over y 0 to MAP_HEADER_H and fades
// it out by MAP_HEADER_FADE_END. Anything drawn under the header (the Home
// Ground paper map's peaks) keeps below the fade.
export const MAP_HEADER_H = 220;
export const MAP_HEADER_FADE_END = 260;
