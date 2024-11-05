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
  const [currentScreen, setCurrentScreen] = useState("mood");
  const [moodValue, setMoodValue] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showAbout, setShowAbout] = useState(false);

  const [screenHeight, setScreenHeight] = useState(window.innerHeight);

  // Function to update screen height
  const updateScreenHeight = () => {
    setScreenHeight(window.innerHeight);
  };

  // **Hook for handling window resize**
  useEffect(() => {
    window.addEventListener("resize", updateScreenHeight);
    return () => {
      window.removeEventListener("resize", updateScreenHeight);
    };
  }, []);

  // **Load Google Maps script**
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // **Hook to load stored data on initialization**
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD
    const storedData = localStorage.getItem(`moodData-${today}`);
    if (storedData) {
      const { moodValue, location } = JSON.parse(storedData);
      setMoodValue(moodValue);
      setSelectedLocation({ lat: location.gps[0], lng: location.gps[1] });
      setCurrentScreen("map"); // Directly navigate to MapScreen if data exists
    }
  }, []);

  // **Early return if maps fail to load or are still loading**
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
          onBack={() => setCurrentScreen("location")}
        />
      )}

      <FooterLinks onAbout={() => setShowAbout(true)} />

      {showAbout && <About onClose={() => setShowAbout(false)} />}
    </div>
  );
}

export default App;
