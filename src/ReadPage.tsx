import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  decryptPayload,
  imageToCanvas,
  loadImage,
  readBytesFromImage,
} from "../steg";

function ReadPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stegoImage, setStegoImage] = useState<File | null>(null);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState<{ message: string; type: string }>({
    message: "Select an image and enter the password used during encryption.",
    type: "",
  });

  async function handleRead() {
    try {
      if (!stegoImage) throw new Error("Choose an image first.");
      if (!decryptPassword) throw new Error("Enter the decryption password.");

      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Canvas not ready.");
      }

      setStatus({ message: "Reading and decrypting text...", type: "" });
      setResult("");

      const image = await loadImage(stegoImage);
      const context = imageToCanvas(image, canvas);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const payload = readBytesFromImage(imageData);
      setResult(await decryptPayload(payload, decryptPassword));
      setStatus({
        message: "Text recovered and decrypted successfully.",
        type: "success",
      });
    } catch {
      setStatus({
        message: "Could not decrypt the image. Check the image and password.",
        type: "error",
      });
    }
  }

  return (
    <main className="tool-page">
      <nav className="page-navigation" aria-label="Page navigation">
        <button type="button" className="secondary" onClick={() => navigate("/")}>
          Back
        </button>
      </nav>
      <h1>Read text from an image</h1>
      <div className={`status ${status.type}`} role="status" aria-live="polite">
        {status.message}
      </div>

      <label htmlFor="stegoImage">Choose an image containing hidden text</label>
      <input
        id="stegoImage"
        type="file"
        accept="image/*"
        onChange={(event) => setStegoImage(event.target.files?.[0] ?? null)}
      />

      <label htmlFor="decryptPassword">Decryption password</label>
      <input
        id="decryptPassword"
        type="password"
        placeholder="Enter the same password"
        value={decryptPassword}
        onChange={(event) => setDecryptPassword(event.target.value)}
      />

      <button type="button" onClick={handleRead}>
        Read and Decrypt Text
      </button>
      <canvas ref={canvasRef} className="processing-canvas" />

      <label htmlFor="result">Recovered text</label>
      <textarea id="result" value={result} readOnly />
    </main>
  );
}

export default ReadPage;