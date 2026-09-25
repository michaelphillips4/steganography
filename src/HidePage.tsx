import { useRef, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import {
  canvasToBlob,
  encryptText,
  hideBytesInImage,
  imageToCanvas,
  loadImage,
} from "../steg";

const PASSWORD_LENGTH = 24;
const PASSWORD_GROUPS = [
  "abcdefghijklmnopqrstuvwxyz",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "0123456789",
  "!@#$%^&*()-_=+[]{};:,.?",
];
const PASSWORD_CHARACTERS = PASSWORD_GROUPS.join("");

function randomIndex(maximum: number): number {
  const limit = Math.floor(256 / maximum) * maximum;
  const randomByte = new Uint8Array(1);

  do {
    crypto.getRandomValues(randomByte);
  } while (randomByte[0] >= limit);

  return randomByte[0] % maximum;
}

function createStrongPassword(): string {
  const characters = PASSWORD_GROUPS.map(
    (group) => group[randomIndex(group.length)]
  );

  while (characters.length < PASSWORD_LENGTH) {
    characters.push(PASSWORD_CHARACTERS[randomIndex(PASSWORD_CHARACTERS.length)]);
  }

  for (let index = characters.length - 1; index > 0; index--) {
    const swapIndex = randomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }

  return characters.join("");
}

function HidePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{ message: string; type: string } | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [generatedImage, setGeneratedImage] = useState<Blob | null>(null);
  const [hasPreview, setHasPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: string }>({
    message: "Select an image, enter text and a password.",
    type: "",
  });

  function invalidateGeneratedImage() {
    setGeneratedImage(null);
    setHasPreview(false);
    setStatus({ message: "Inputs changed. Generate a new image before downloading.", type: "" });
  }

  async function handleHide() {
    invalidateGeneratedImage();

    try {
      if (!message) throw new Error("Enter some text to hide.");
      if (!password) throw new Error("Enter an encryption password.");
      if (!coverImage) throw new Error("Choose an image first.");

      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Canvas not ready.");
      }

      setIsProcessing(true);
      setStatus({ message: "Encrypting and hiding text...", type: "" });

      const image = await loadImage(coverImage);
      const context = imageToCanvas(image, canvas);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const encryptedPayload = await encryptText(message, password);

      hideBytesInImage(imageData, encryptedPayload);
      context.putImageData(imageData, 0, 0);

      const blob = await canvasToBlob(canvas);
      setGeneratedImage(blob);
      setHasPreview(true);

      const capacityBytes = Math.floor((canvas.width * canvas.height * 3) / 8) - 4;
      setStatus({
        message:
          `Text encrypted and hidden successfully.\n` +
          `Payload size: ${encryptedPayload.length} bytes\n` +
          `Approximate image capacity: ${capacityBytes} bytes`,
        type: "success",
      });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Could not process the image.",
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  function handleDownload() {
    if (!generatedImage) return;

    const url = URL.createObjectURL(generatedImage);
    const link = document.createElement("a");
    link.href = url;
    link.download = "steganography-output.png";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleGeneratePassword() {
    invalidateGeneratedImage();
    setPassword(createStrongPassword());
    setCopyFeedback(null);
    setStatus({ message: "Strong password generated.", type: "success" });
  }

  async function handleCopyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopyFeedback({ message: "Password copied to clipboard.", type: "success" });
    } catch {
      setCopyFeedback({
        message: "Could not copy the password. Check browser clipboard permissions.",
        type: "error",
      });
    }
  }

  return (
    <>
      <div className={`status ${status.type}`} role="status" aria-live="polite">
      </div>

      <label htmlFor="message"><b>1 Text to hide</b></label>
      <textarea
        id="message"
        placeholder="Enter the secret text..."
        value={message}
        disabled={isProcessing}
        onChange={(event) => {
          invalidateGeneratedImage();
          setMessage(event.target.value);
        }}
      />

      <label htmlFor="password"><b>2 Create Encryption password</b></label>
      <div role="group" aria-label="Encryption password and actions">
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter a strong password"
          value={password}
          disabled={isProcessing}
          onChange={(event) => {
            invalidateGeneratedImage();
            setPassword(event.target.value);
            setCopyFeedback(null);
          }}
        />
        <button
          type="button"
          className="secondary outline"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          title={showPassword ? "Hide password" : "Show password"}
          disabled={isProcessing}
          onClick={() => setShowPassword((visible) => !visible)}
        >
          {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="secondary outline"
          aria-label="Copy password"
          title="Copy password"
          disabled={!password || isProcessing}
          onClick={handleCopyPassword}
        >
          <Copy aria-hidden="true" />
        </button>
        <button
          type="button"
          className="secondary outline"
          aria-label="Create strong password"
          title="Create strong password"
          disabled={isProcessing}
          onClick={handleGeneratePassword}
        >
          <KeyRound aria-hidden="true" />
        </button>
      </div>
      {copyFeedback ? (
        <div className={`status ${copyFeedback.type}`} role="status" aria-live="polite">
          {copyFeedback.message}
        </div>
      ) : null}

      <label htmlFor="coverImage"><b>3 Choose a PNG or image</b></label>
      <input
        id="coverImage"
        type="file"
        accept="image/*"
        disabled={isProcessing}
        onChange={(event) => {
          invalidateGeneratedImage();
          setCoverImage(event.target.files?.[0] ?? null);
        }}
      />

      <button type="button" disabled={isProcessing} onClick={handleHide}>
        Encrypt and Hide Text
      </button>&nbsp;
      <button
        type="button"
        className="secondary"
        disabled={!generatedImage || isProcessing}
        onClick={handleDownload}
      >
        Download (Stego PNG)
      </button>

      <canvas
        ref={canvasRef}
        className={hasPreview ? "preview-canvas" : "processing-canvas"}
      />
    </>
  );
}

export default HidePage;
