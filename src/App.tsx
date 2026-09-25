import { Link, useLocation } from "react-router-dom";
import HidePage from "./HidePage";
import ReadPage from "./ReadPage";

function App() {
  const location = useLocation();

  return (
    <>
      <nav aria-label="Main navigation">
        <ul>
          <li>
            <Link to="/" aria-current={location.pathname === "/" ? "page" : undefined}>
              Home 
            </Link>
          </li>
          <li>
            <Link to="/hide" aria-current={location.pathname === "/hide" ? "page" : undefined}>
              Encrypt Text 
            </Link>
          </li>
          <li>
            <Link to="/read" aria-current={location.pathname === "/read" ? "page" : undefined}>
              Decrypt Text
            </Link>
          </li>
        </ul>
      </nav>

     
        {location.pathname === "/" ? (
          <p>
            This is a simple web application that allows you to hide text inside an image using
            steganography. You can also read the hidden text from an image.
          </p>
        ) : null}
        {location.pathname === "/hide" ? <HidePage /> : null}
        {location.pathname === "/read" ? <ReadPage /> : null}
     
    </>
  );
}

export default App;
