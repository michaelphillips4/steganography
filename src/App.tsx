import { useLocation, useNavigate } from "react-router-dom";
import HidePage from "./HidePage";
import ReadPage from "./ReadPage";

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      {location.pathname === "/hide" ? <HidePage /> : null}
      {location.pathname === "/read" ? <ReadPage /> : null}
      {location.pathname !== "/hide" && location.pathname !== "/read" ? (
        <main>
          <h1>Encrypted Image Steganography</h1>
          <ul>
            <li>
              <button type="button" onClick={() => navigate("/hide")}>
                Hide text in an image
              </button>
            </li>
            <li>
              <button
                type="button"
                className="secondary"
                onClick={() => navigate("/read")}
              >
                Read text from an image
              </button>
            </li>
          </ul>
        </main>
      ) : null}

      <footer>
        <a href="https://www.area2.co.uk">Home</a>
      </footer>
    </>
  );
}

export default App;
