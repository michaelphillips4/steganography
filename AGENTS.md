# Project Guidelines

## Purpose

This browser app hides encrypted text inside an image and can recover it later. Steganography conceals information within another medium, such as an image. Encryption protects the message contents; steganography aims to conceal the presence of a message. This app uses both.

## Architecture and Approach

1. The browser encrypts text with AES-GCM using a 256-bit key.
2. PBKDF2 with SHA-256 derives the key from the user's password, a random 16-byte salt, and 250,000 iterations. AES-GCM uses a random 12-byte IV.
3. The payload contains the `STPIC1` marker, a 4-byte payload length, the salt, the IV, and ciphertext.
4. Payload bits are stored sequentially in the least significant bits of image RGB channels. Alpha is unchanged, and a 4-byte length header precedes the payload.
5. Canvas loads and processes images; output is exported as PNG.

Processing happens in the browser; images and messages are not uploaded to an application server. Web Crypto requires a secure context, such as HTTPS or localhost.

This LSB approach is intended for lossless image workflows. Resizing, recompressing, or converting the encoded image to a lossy format can corrupt or remove the payload. Steganography is not a replacement for encryption and LSB embedding is not guaranteed to be undetectable or tamper-proof.

## Technology and Structure

- React 19 provides the interface; Vite runs development and production builds.
- React Router provides browser-history navigation: `/hide` is the hide workflow and `/read` is the recovery workflow.
- Pico CSS 2 classless stylesheet is loaded from jsDelivr in `index.html`; project-specific styles are in `styles.css`.
- `src/App.jsx` selects the home, hide, and read views.
- `src/HidePage.jsx` owns the hide form, encryption/embedding flow, PNG preview, and download action.
- `src/ReadPage.jsx` owns image selection, payload extraction, decryption, and recovered text.
- `steg.ts` contains shared encryption, image/canvas, and bit-encoding functions. Keep payload writing and reading compatible when changing its format.
- `src/main.jsx` mounts the React app inside `BrowserRouter`.

## Development Commands

- `npm install` installs dependencies.
- `npm run dev` starts the Vite development server.
- `npm run build` creates a production bundle in `dist/`.
- `npm run preview` serves the production bundle locally.

When deploying browser-history routes, configure the static host to serve `index.html` as the fallback for `/hide` and `/read`.
