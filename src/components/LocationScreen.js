// src/components/LocationScreen.js
import React, { useState } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";
import { getMoodEmoji } from "../utils/moodEmojis";
import mapStyle from "../utils/mapStyle";

const LocationScreen = ({
  screenHeight,
  moodValue,
  selectedLocation,
  setSelectedLocation,
  onBack,
  onNext,
}) => {
  const [map, setMap] = useState(null);
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete();

  const handleInput = (e) => {
    setValue(e.target.value);
  };

  const handleSelect = async (description) => {
    setValue(description, false);
    clearSuggestions();

    try {
      const results = await getGeocode({ address: description });
      const { lat, lng } = await getLatLng(results[0]);
      setSelectedLocation({ lat, lng });
      map.panTo({ lat, lng });
      map.setZoom(15);
    } catch (error) {
      console.log("Error: ", error);
    }
  };

  const renderSuggestions = () =>
    data.map((suggestion) => {
      const {
        place_id,
        structured_formatting: { main_text, secondary_text },
        description,
      } = suggestion;
      return (
        <li
          key={place_id}
          onClick={() => handleSelect(description)}
          className="px-2 py-1 cursor-pointer hover:bg-gray-200"
        >
          <strong>{main_text}</strong> <small>{secondary_text}</small>
        </li>
      );
    });

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setSelectedLocation({ lat, lng });
  };

  const createEmojiMarkerIcon = (emoji) => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
          <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="30">${emoji}</text>
      </svg>
      `;
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(40, 40),
      anchor: new window.google.maps.Point(20, 20),
    };
  };

  return (
    <div
      style={{ minHeight: `${screenHeight}px` }}
      className="flex flex-col items-center justify-center "
    >
      {/* Title */}
      <h2 className="mb-4 text-3xl font-semibold">Pick your location</h2>

      {/* Map */}
      <div className="relative w-full mb-4 h-3/5">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={selectedLocation || { lat: 0, lng: 0 }}
          zoom={selectedLocation ? 15 : 2}
          options={{ disableDefaultUI: true, styles: mapStyle }}
          onLoad={(map) => setMap(map)}
          onClick={handleMapClick}
        >
          {selectedLocation && (
            <Marker
              position={selectedLocation}
              icon={createEmojiMarkerIcon(getMoodEmoji(moodValue))}
            />
          )}
        </GoogleMap>
      </div>

      {/* City Input */}
      <div className="relative w-3/4 mb-4 md:w-1/2">
        <input
          type="text"
          placeholder="Enter your city"
          value={value}
          onChange={handleInput}
          disabled={!ready}
          className="w-full p-2 border rounded focus:outline-none focus:border-blue-500"
        />
        {status === "OK" && (
          <ul className="absolute left-0 right-0 z-10 mt-1 overflow-auto bg-white border rounded-lg top-full max-h-60">
            {renderSuggestions()}
          </ul>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="absolute flex justify-between px-4 bottom-4 left-4 right-4">
        {/* Back Button on Bottom Left */}
        <button
          onClick={onBack}
          className="p-2 text-white rounded-full shadow-lg bg-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* Next Button on Bottom Right */}

        {selectedLocation && (
          <button
            onClick={onNext}
            className="p-2 text-white rounded-full shadow-lg bg-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default LocationScreen;
