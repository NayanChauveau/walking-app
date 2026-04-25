import type { Coordinates } from "@/src/modules/walk-route";

import type { TraversedCellsPort } from "../../application/ports/TraversedCellsPort";

type H3ReactNativeApi = {
  geoToH3: (lat: number, lng: number, res: number) => string;
};

const DEFAULT_H3_RESOLUTION = 11;

function decodeUtf16Le(input: BufferSource): string {
  const bytes =
    input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);

  let output = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    output += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
  }

  return output;
}

function installUtf16LeCompatForTextDecoder() {
  const globalWithDecoder = globalThis as {
    TextDecoder?: new (label?: string) => { decode: (input?: BufferSource) => string };
  };

  const NativeTextDecoder = globalWithDecoder.TextDecoder;
  if (!NativeTextDecoder) {
    return;
  }
  const SafeTextDecoder = NativeTextDecoder;

  try {
    new SafeTextDecoder("utf-16le");
    return;
  } catch {
    // Patch only the missing utf-16le decoding path.
  }

  class TextDecoderCompat {
    private readonly label: string;

    constructor(label = "utf-8") {
      this.label = label.toLowerCase();
    }

    decode(input?: BufferSource): string {
      if (this.label !== "utf-16le" && this.label !== "utf-16") {
        return new SafeTextDecoder(this.label).decode(input);
      }

      if (!input) {
        return "";
      }

      return decodeUtf16Le(input);
    }
  }

  globalWithDecoder.TextDecoder =
    TextDecoderCompat as unknown as typeof globalWithDecoder.TextDecoder;
}

installUtf16LeCompatForTextDecoder();

const { geoToH3 } = require("h3-reactnative/dist/browser/h3-js.js") as H3ReactNativeApi;

export class H3ReactNativeTraversedCellsAdapter implements TraversedCellsPort {
  extractFromPolyline(input: {
    polyline: Coordinates[];
    resolution?: number;
  }): string[] {
    const uniqueCells = new Set<string>();
    const resolution = input.resolution ?? DEFAULT_H3_RESOLUTION;

    for (const point of input.polyline) {
      uniqueCells.add(geoToH3(point.latitude, point.longitude, resolution));
    }

    return Array.from(uniqueCells);
  }
}
