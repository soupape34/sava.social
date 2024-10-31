// src/App.js
import React, { useState } from "react";
import MoodScreen from "./components/MoodScreen";
import LocationScreen from "./components/LocationScreen";
import MapScreen from "./components/MapScreen";
import FooterLinks from "./components/FooterLinks";
import About from "./components/About";
import { useLoadScript } from "@react-google-maps/api";
import "./App.css";

function App() {
  const [currentScreen, setCurrentScreen] = useState("mood"); // 'mood', 'location', 'map'
  const [moodValue, setMoodValue] = useState(null); // Initialize as null for validation
  const [selectedLocation, setSelectedLocation] = useState(null); // { lat, lng }
  const [showAbout, setShowAbout] = useState(false);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY, // Ensure this is set in .env
    libraries: ["places"],
  });

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading Maps...</div>;

  return (
    <div className="relative overflow-hidden">
      {currentScreen === "mood" && (
        <MoodScreen
          moodValue={moodValue}
          setMoodValue={setMoodValue}
          onNext={() => setCurrentScreen("location")}
        />
      )}

      {currentScreen === "location" && (
        <LocationScreen
          moodValue={moodValue}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
          onBack={() => setCurrentScreen("mood")}
          onNext={() => setCurrentScreen("map")}
        />
      )}

      {currentScreen === "map" && (
        <MapScreen
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
