import type { Coordinates } from "@/src/modules/walk-route";

type H3ReactNativeApi = {
  geoToH3: (lat: number, lng: number, res: number) => string;
};

function installUtf16LeTextDecoderCompat() {
  const globalWithDecoder = globalThis as {
    TextDecoder?: new (label?: string) => { decode: (input?: BufferSource) => string };
  };

  const NativeTextDecoder = globalWithDecoder.TextDecoder;
  if (!NativeTextDecoder) {
    return;
  }
  const SafeTextDecoder = NativeTextDecoder;

  try {
    // If this does not throw, no compatibility shim is needed.
    new SafeTextDecoder("utf-16le");
    return;
  } catch {
    // Keep going and patch only this missing encoding.
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

      const bytes =
        input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);

      let output = "";
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        const codeUnit = bytes[i] | (bytes[i + 1] << 8);
        output += String.fromCharCode(codeUnit);
      }

      return output;
    }
  }

  globalWithDecoder.TextDecoder =
    TextDecoderCompat as unknown as typeof globalWithDecoder.TextDecoder;
}

installUtf16LeTextDecoderCompat();

const { geoToH3 } = require("h3-reactnative/dist/browser/h3-js.js") as H3ReactNativeApi;

const DEFAULT_H3_RESOLUTION = 11;

export function extractTraversedH3Cells(
  polyline: Coordinates[],
  resolution = DEFAULT_H3_RESOLUTION,
): string[] {
  const uniqueCells = new Set<string>();

  for (const point of polyline) {
    uniqueCells.add(geoToH3(point.latitude, point.longitude, resolution));
  }

  return Array.from(uniqueCells);
}
