import { webcrypto } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  decryptPayload,
  encryptText,
  hideBytesInImage,
  readBytesFromImage,
} from "../steg";

function createImageData(pixelCount: number): ImageData {
  const data = new Uint8ClampedArray(pixelCount * 4);
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    data[pixelIndex * 4 + 3] = 255;
  }
  return { data } as ImageData;
}

describe("steganography payload", () => {
  beforeAll(() => {
    vi.stubGlobal("crypto", webcrypto);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("embeds and recovers bytes while preserving alpha", () => {
    const imageData = createImageData(40);
    const originalAlpha = Array.from(
      { length: imageData.data.length / 4 },
      (_, pixelIndex) => imageData.data[pixelIndex * 4 + 3]
    );
    const payload = new Uint8Array([0, 1, 127, 128, 255]);

    hideBytesInImage(imageData, payload);

    expect(Array.from(readBytesFromImage(imageData))).toEqual(Array.from(payload));
    expect(
      Array.from(
        { length: imageData.data.length / 4 },
        (_, pixelIndex) => imageData.data[pixelIndex * 4 + 3]
      )
    ).toEqual(originalAlpha);
  });

  it("rejects a payload that exceeds image capacity", () => {
    expect(() => hideBytesInImage(createImageData(8), new Uint8Array([1]))).toThrow(
      "The image is too small for this message."
    );
  });

  it("rejects an image with no payload", () => {
    expect(() => readBytesFromImage(createImageData(16))).toThrow(
      "No valid hidden message was found in this image."
    );
  });

  it("encrypts and decrypts Unicode text with the correct password", async () => {
    const payload = await encryptText("Hidden text: café 🔐", "correct horse battery staple");

    await expect(decryptPayload(payload, "correct horse battery staple")).resolves.toBe(
      "Hidden text: café 🔐"
    );
  });

  it("rejects decryption with an incorrect password", async () => {
    const payload = await encryptText("secret", "correct password");

    await expect(decryptPayload(payload, "incorrect password")).rejects.toThrow();
  });
});
