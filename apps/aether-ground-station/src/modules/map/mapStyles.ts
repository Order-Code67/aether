import type { StyleSpecification } from "maplibre-gl";

/** Online OSM raster — requires network. */
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

/**
 * Offline base: no external tiles. Markers / measure still work.
 * Local MBTiles / XYZ can be plugged via `localTileUrlTemplate`.
 */
export function offlineStyle(
  localTileUrlTemplate?: string,
): StyleSpecification {
  if (localTileUrlTemplate?.trim()) {
    return {
      version: 8,
      sources: {
        local: {
          type: "raster",
          tiles: [localTileUrlTemplate.trim()],
          tileSize: 256,
          attribution: "Local tiles",
        },
      },
      layers: [
        {
          id: "bg",
          type: "background",
          paint: { "background-color": "#12161f" },
        },
        { id: "local", type: "raster", source: "local" },
      ],
    };
  }
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "bg",
        type: "background",
        paint: { "background-color": "#12161f" },
      },
    ],
  };
}
