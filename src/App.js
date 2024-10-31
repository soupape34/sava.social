// src/App.js
import React, { useState, useEffect } from "react";
import MoodScreen from "./components/MoodScreen";
import LocationScreen from "./components/LocationScreen";
import MapScreen from "./components/MapScreen";
import FooterLinks from "./components/FooterLinks";
import About from "./components/About";
import { useLoadScript } from "@react-google-maps/api";
import "./App.css";

const GOOGLE_MAPS_LIBRARIES = ["places"];

function App() {
  const [currentScreen, setCurrentScreen] = useState("mood"); // 'mood', 'location', 'map'
  const [moodValue, setMoodValue] = useState(null); // Initialize as null for validation
  const [selectedLocation, setSelectedLocation] = useState(null); // { lat, lng }
  const [showAbout, setShowAbout] = useState(false);

  const [screenHeight, setScreenHeight] = useState(window.innerHeight);

  // Function to update screen height
  const updateScreenHeight = () => {
    setScreenHeight(window.innerHeight);
  };

  useEffect(() => {
    window.addEventListener("resize", updateScreenHeight);
    return () => {
      window.removeEventListener("resize", updateScreenHeight);
    };
  }, []);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: "AIzaSyCGwxvUpG1wG__9jOTFPYFoI6eB1xBNTrQ",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading Maps...</div>;

  return (
    <div className="relative overflow-hidden">
      {currentScreen === "mood" && (
        <MoodScreen
          screenHeight={screenHeight}
          moodValue={moodValue}
          setMoodValue={setMoodValue}
          onNext={() => setCurrentScreen("location")}
        />
      )}

      {currentScreen === "location" && (
        <LocationScreen
          screenHeight={screenHeight}
          moodValue={moodValue}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
          onBack={() => setCurrentScreen("mood")}
          onNext={() => setCurrentScreen("map")}
        />
      )}

      {currentScreen === "map" && (
        <MapScreen
          screenHeight={screenHeight}
          moodValue={moodValue}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
          onBack={() => setCurrentScreen("location")}
        />
      )}

      <FooterLinks onAbout={() => setShowAbout(true)} />

      {showAbout && <About onClose={() => setShowAbout(false)} />}
    </div>
  );
}

export default App;
