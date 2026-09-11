const MAGIC = new TextEncoder().encode("STPIC1");

const messageInput = document.getElementById("message");
const passwordInput = document.getElementById("password");
const coverImageInput = document.getElementById("coverImage");
const hideButton = document.getElementById("hideButton");
const downloadButton = document.getElementById("downloadButton");
const hideCanvas = document.getElementById("hideCanvas");
const hideStatus = document.getElementById("hideStatus");

const stegoImageInput = document.getElementById("stegoImage");
const decryptPasswordInput = document.getElementById("decryptPassword");
const readButton = document.getElementById("readButton");
const readCanvas = document.getElementById("readCanvas");
const resultInput = document.getElementById("result");
const readStatus = document.getElementById("readStatus");

let generatedImageBlob = null;

function setStatus(element, message, type = "") {
    element.textContent = message;
    element.className = "status " + type;
}

function randomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

function concatenateArrays(...arrays) {
    const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
    const result = new Uint8Array(totalLength);

    let offset = 0;

    for (const array of arrays) {
        result.set(array, offset);
        offset += array.length;
    }

    return result;
}

async function deriveKey(password, salt) {
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
            hash: "SHA-256"
        },
        baseKey,
        {
            name: "AES-GCM",
            length: 256
        },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptText(text, password) {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await deriveKey(password, salt);

    const plaintext = new TextEncoder().encode(text);

    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv
            },
            key,
            plaintext
        )
    );

    /*
      Payload format:
  
      6 bytes   magic identifier
      4 bytes   ciphertext length
      16 bytes  salt
      12 bytes  IV
      N bytes   encrypted text
    */
    const payload = new Uint8Array(
        6 + 4 + 16 + 12 + ciphertext.length
    );

    payload.set(MAGIC, 0);

    new DataView(payload.buffer).setUint32(
        6,
        ciphertext.length,
        false
    );

    payload.set(salt, 10);
    payload.set(iv, 26);
    payload.set(ciphertext, 38);

    return payload;
}

async function decryptPayload(payload, password) {
    if (payload.length < 38) {
        throw new Error("The image does not contain a valid hidden message.");
    }

    for (let i = 0; i < MAGIC.length; i++) {
        if (payload[i] !== MAGIC[i]) {
            throw new Error("No compatible hidden message was found.");
        }
    }

    const dataView = new DataView(
        payload.buffer,
        payload.byteOffset,
        payload.byteLength
    );

    const ciphertextLength = dataView.getUint32(6, false);

    if (38 + ciphertextLength > payload.length) {
        throw new Error("The hidden message appears to be corrupted.");
    }

    const salt = payload.slice(10, 26);
    const iv = payload.slice(26, 38);
    const ciphertext = payload.slice(38, 38 + ciphertextLength);

    const key = await deriveKey(password, salt);

    const plaintext = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv
        },
        key,
        ciphertext
    );

    return new TextDecoder().decode(plaintext);
}

function loadImage(file) {
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

function imageToCanvas(image, canvas) {
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const context = canvas.getContext("2d", {
        willReadFrequently: true
    });

    context.drawImage(image, 0, 0);
    return context;
}

function bytesToBits(bytes) {
    const bits = [];

    for (const byte of bytes) {
        for (let bit = 7; bit >= 0; bit--) {
            bits.push((byte >> bit) & 1);
        }
    }

    return bits;
}

function bitsToBytes(bits) {
    const byteCount = Math.floor(bits.length / 8);
    const bytes = new Uint8Array(byteCount);

    for (let i = 0; i < byteCount; i++) {
        let value = 0;

        for (let bit = 0; bit < 8; bit++) {
            value = (value << 1) | bits[i * 8 + bit];
        }

        bytes[i] = value;
    }

    return bytes;
}

function hideBytesInImage(imageData, bytes) {
    const bits = bytesToBits(bytes);

    /*
      Each RGB channel stores one bit.
      Alpha is left unchanged.
  
      The first four bytes are stored separately as a
      32-bit payload length header.
    */
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, bytes.length, false);

    const allBits = bytesToBits(
        concatenateArrays(header, bytes)
    );

    const availableBits = Math.floor(imageData.data.length / 4) * 3;

    if (allBits.length > availableBits) {
        throw new Error(
            "The image is too small for this message."
        );
    }

    let bitIndex = 0;

    for (let pixelIndex = 0; pixelIndex < imageData.data.length; pixelIndex += 4) {
        for (let channel = 0; channel < 3; channel++) {
            if (bitIndex >= allBits.length) {
                return;
            }

            imageData.data[pixelIndex + channel] =
                (imageData.data[pixelIndex + channel] & 0xFE) |
                allBits[bitIndex];

            bitIndex++;
        }
    }
}

function readBytesFromImage(imageData) {
    const bits = [];

    for (let pixelIndex = 0; pixelIndex < imageData.data.length; pixelIndex += 4) {
        for (let channel = 0; channel < 3; channel++) {
            bits.push(imageData.data[pixelIndex + channel] & 1);
        }
    }

    const headerBits = bits.slice(0, 32);
    const headerBytes = bitsToBytes(headerBits);

    const payloadLength = new DataView(
        headerBytes.buffer
    ).getUint32(0, false);

    const maximumPayloadLength = Math.floor(
        (bits.length - 32) / 8
    );

    if (
        payloadLength === 0 ||
        payloadLength > maximumPayloadLength
    ) {
        throw new Error(
            "No valid hidden message was found in this image."
        );
    }

    const payloadBits = bits.slice(
        32,
        32 + payloadLength * 8
    );

    return bitsToBytes(payloadBits);
}

function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => {
                if (blob) resolve(blob);
                else reject(new Error("Could not create PNG output."));
            },
            "image/png"
        );
    });
}

hideButton.addEventListener("click", async () => {
    try {
        const text = messageInput.value;
        const password = passwordInput.value;
        const file = coverImageInput.files[0];

        if (!text) {
            throw new Error("Enter some text to hide.");
        }

        if (!password) {
            throw new Error("Enter an encryption password.");
        }

        if (!file) {
            throw new Error("Choose an image first.");
        }

        setStatus(hideStatus, "Encrypting and hiding text...");

        const image = await loadImage(file);
        const context = imageToCanvas(image, hideCanvas);
        const imageData = context.getImageData(
            0,
            0,
            hideCanvas.width,
            hideCanvas.height
        );

        const encryptedPayload = await encryptText(text, password);

        hideBytesInImage(imageData, encryptedPayload);
        context.putImageData(imageData, 0, 0);

        generatedImageBlob = await canvasToBlob(hideCanvas);
        downloadButton.disabled = false;

        const capacityBytes =
            Math.floor(
                (hideCanvas.width * hideCanvas.height * 3) / 8
            ) - 4;

        setStatus(
            hideStatus,
            `Text encrypted and hidden successfully.\n` +
            `Payload size: ${encryptedPayload.length} bytes\n` +
            `Approximate image capacity: ${capacityBytes} bytes`,
            "success"
        );
    } catch (error) {
        setStatus(hideStatus, error.message, "error");
    }
});

downloadButton.addEventListener("click", () => {
    if (!generatedImageBlob) return;

    const url = URL.createObjectURL(generatedImageBlob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "steganography-output.png";
    link.click();

    URL.revokeObjectURL(url);
});

readButton.addEventListener("click", async () => {
    try {
        const file = stegoImageInput.files[0];
        const password = decryptPasswordInput.value;

        if (!file) {
            throw new Error("Choose an image first.");
        }

        if (!password) {
            throw new Error("Enter the decryption password.");
        }

        setStatus(readStatus, "Reading and decrypting text...");
        resultInput.value = "";

        const image = await loadImage(file);
        const context = imageToCanvas(image, readCanvas);

        const imageData = context.getImageData(
            0,
            0,
            readCanvas.width,
            readCanvas.height
        );

        const payload = readBytesFromImage(imageData);
        const recoveredText = await decryptPayload(payload, password);

        resultInput.value = recoveredText;

        setStatus(
            readStatus,
            "Text recovered and decrypted successfully.",
            "success"
        );
    } catch (error) {
        setStatus(
            readStatus,
            "Could not decrypt the image. Check the image and password.",
            "error"
        );
    }
});
