type FeatureProperties = {
  kind: "park" | "water";
  source: "osm";
  osmId: string;
  name: string;
};

type PolygonFeature = {
  type: "Feature";
  properties: FeatureProperties;
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
};

type LineStringFeature = {
  type: "Feature";
  properties: FeatureProperties;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
};

export type LocalOsmPoiFeature = PolygonFeature | LineStringFeature;

export const localOsmPoiExtract: {
  type: "FeatureCollection";
  features: LocalOsmPoiFeature[];
} = {
  type: "FeatureCollection",
  // Local OSM extract sample (parks + water areas/lines).
  // Replace/extend this file with your own exported extract for your city.
  features: [
    {
      type: "Feature",
      properties: {
        kind: "park",
        source: "osm",
        osmId: "way/4529654",
        name: "Bois de Vincennes (sample)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [2.4378, 48.8214],
            [2.4712, 48.8214],
            [2.4712, 48.8398],
            [2.4378, 48.8398],
            [2.4378, 48.8214],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        kind: "water",
        source: "osm",
        osmId: "way/13048441",
        name: "Lac Daumesnil (sample)",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [2.4287, 48.8277],
            [2.4344, 48.8277],
            [2.4344, 48.8321],
            [2.4287, 48.8321],
            [2.4287, 48.8277],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        kind: "water",
        source: "osm",
        osmId: "way/5388737",
        name: "Marne river segment (sample)",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [2.4464, 48.7899],
          [2.4573, 48.7908],
          [2.4685, 48.7924],
          [2.4791, 48.7941],
          [2.4894, 48.7969],
        ],
      },
    },
  ],
};
