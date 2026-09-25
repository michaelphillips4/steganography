import { useRef, useState } from "react";
import {
  canvasToBlob,
  encryptText,
  hideBytesInImage,
  imageToCanvas,
  loadImage,
} from "../steg";

function HidePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
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

  return (
    <>
      <h1>Hide text in an image</h1>
      <div className={`status ${status.type}`} role="status" aria-live="polite">
        {status.message}
      </div>

      <label htmlFor="message">Text to hide</label>
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

      <label htmlFor="password">Encryption password</label>
      <input
        id="password"
        type="password"
        placeholder="Enter a strong password"
        value={password}
        disabled={isProcessing}
        onChange={(event) => {
          invalidateGeneratedImage();
          setPassword(event.target.value);
        }}
      />

      <label htmlFor="coverImage">Choose a PNG or image</label>
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
        Download Stego PNG
      </button>

      <canvas
        ref={canvasRef}
        className={hasPreview ? "preview-canvas" : "processing-canvas"}
      />
    </>
  );
}

export default HidePage;
