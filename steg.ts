const MAGIC = new TextEncoder().encode("STPIC1");

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes as Uint8Array<ArrayBuffer>;
}

function concatenateArrays(...arrays: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const result = new Uint8Array(totalLength) as Uint8Array<ArrayBuffer>;

  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const passwordBytes = new TextEncoder().encode(password);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 250000,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(text: string, password: string): Promise<Uint8Array> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt as Uint8Array<ArrayBuffer>);

  const plaintext = new TextEncoder().encode(text);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      plaintext
    )
  ) as Uint8Array<ArrayBuffer>;

  /*
    Payload format:

    6 bytes   magic identifier
    4 bytes   ciphertext length
    16 bytes  salt
    12 bytes  IV
    N bytes   encrypted text
  */
  const payload = new Uint8Array(6 + 4 + 16 + 12 + ciphertext.length) as Uint8Array<ArrayBuffer>;

  payload.set(MAGIC, 0);

  new DataView(payload.buffer).setUint32(6, ciphertext.length, false);

  payload.set(salt, 10);
  payload.set(iv, 26);
  payload.set(ciphertext, 38);

  return payload;
}

export async function decryptPayload(payload: Uint8Array, password: string): Promise<string> {
  if (payload.length < 38) {
    throw new Error("The image does not contain a valid hidden message.");
  }

  for (let i = 0; i < MAGIC.length; i++) {
    if (payload[i] !== MAGIC[i]) {
      throw new Error("No compatible hidden message was found.");
    }
  }

  const dataView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const ciphertextLength = dataView.getUint32(6, false);

  if (38 + ciphertextLength > payload.length) {
    throw new Error("The hidden message appears to be corrupted.");
  }

  const salt = payload.slice(10, 26) as Uint8Array<ArrayBuffer>;
  const iv = payload.slice(26, 38) as Uint8Array<ArrayBuffer>;
  const ciphertext = payload.slice(38, 38 + ciphertextLength) as Uint8Array<ArrayBuffer>;

  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load the selected image."));
    };

    image.src = objectUrl;
  });
}

export function imageToCanvas(image: HTMLImageElement, canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!context) {
    throw new Error("Could not create a canvas context.");
  }

  context.drawImage(image, 0, 0);
  return context;
}

function bytesToBits(bytes: Uint8Array<ArrayBuffer>): number[] {
  const bits: number[] = [];

  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit--) {
      bits.push((byte >> bit) & 1);
    }
  }

  return bits;
}

export function hideBytesInImage(imageData: ImageData, bytes: Uint8Array): void {
  const normalizedBytes = bytes as Uint8Array<ArrayBuffer>;

  /*
    Each RGB channel stores one bit.
    Alpha is left unchanged.

    The first four bytes are stored separately as a
    32-bit payload length header.
  */
  const header = new Uint8Array(4) as Uint8Array<ArrayBuffer>;
  new DataView(header.buffer).setUint32(0, bytes.length, false);

  const allBits = bytesToBits(concatenateArrays(header, normalizedBytes));
  const availableBits = Math.floor(imageData.data.length / 4) * 3;

  if (allBits.length > availableBits) {
    throw new Error("The image is too small for this message.");
  }

  let bitIndex = 0;

  for (let pixelIndex = 0; pixelIndex < imageData.data.length; pixelIndex += 4) {
    for (let channel = 0; channel < 3; channel++) {
      if (bitIndex >= allBits.length) {
        return;
      }

      imageData.data[pixelIndex + channel] =
        (imageData.data[pixelIndex + channel] & 0xfe) | allBits[bitIndex];

      bitIndex += 1;
    }
  }
}

export function readBytesFromImage(imageData: ImageData): Uint8Array<ArrayBuffer> {
  const availableBits = Math.floor(imageData.data.length / 4) * 3;

  if (availableBits < 32) {
    throw new Error("No valid hidden message was found in this image.");
  }

  const readBit = (bitIndex: number) => {
    const pixelIndex = Math.floor(bitIndex / 3) * 4;
    const channel = bitIndex % 3;
    return imageData.data[pixelIndex + channel] & 1;
  };

  const headerBytes = new Uint8Array(4) as Uint8Array<ArrayBuffer>;
  for (let bitIndex = 0; bitIndex < 32; bitIndex++) {
    const byteIndex = Math.floor(bitIndex / 8);
    headerBytes[byteIndex] = (headerBytes[byteIndex] << 1) | readBit(bitIndex);
  }

  const payloadLength = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength).getUint32(0, false);
  const maximumPayloadLength = Math.floor((availableBits - 32) / 8);

  if (payloadLength === 0 || payloadLength > maximumPayloadLength) {
    throw new Error("No valid hidden message was found in this image.");
  }

  const payload = new Uint8Array(payloadLength) as Uint8Array<ArrayBuffer>;
  for (let byteIndex = 0; byteIndex < payloadLength; byteIndex++) {
    let value = 0;
    for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
      value = (value << 1) | readBit(32 + byteIndex * 8 + bitIndex);
    }
    payload[byteIndex] = value;
  }

  return payload;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create PNG output."));
    }, "image/png");
  });
}
