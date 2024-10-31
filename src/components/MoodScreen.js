// src/components/MoodScreen.js
import React, { useEffect, useState, useRef } from "react";
import { getMoodEmoji } from "../utils/moodEmojis";

const MoodScreen = ({ moodValue, setMoodValue, onNext }) => {
  const [isPressed, setIsPressed] = useState(false);
  const moodIntervalRef = useRef(null);

  // Function to increment mood
  const incrementMood = () => {
    setMoodValue((prev) => (prev < 5 ? prev + 1 : 1));
  };

  // Start incrementing on press
  const startIncrementing = () => {
    setIsPressed(true);
    incrementMood();
    moodIntervalRef.current = setInterval(() => {
      incrementMood();
    }, 500); // Adjust speed as needed
  };

  // Stop incrementing on release
  const stopIncrementing = () => {
    setIsPressed(false);
    if (moodIntervalRef.current) {
      clearInterval(moodIntervalRef.current);
      moodIntervalRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (moodIntervalRef.current) {
        clearInterval(moodIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      {/* App Name */}
      <h1 className="mb-8 text-5xl font-semibold">SAVA?</h1>

      {/* Mood Display */}
      <div className="flex flex-col items-center mb-4 space-y-4">
        {/* Smiley Face */}
        <div className="flex items-center justify-center w-32 h-32 text-6xl">
          {getMoodEmoji(moodValue)}
        </div>

        {/* Mood Button */}
        <button
          className={`w-32 h-32 bg-yellow-400 rounded-full focus:outline-none shadow-lg flex items-center justify-center text-xl transition-transform ${
            isPressed ? "pressed" : "animate-pulse-custom"
          }`}
          onMouseDown={startIncrementing}
          onMouseUp={stopIncrementing}
          onTouchStart={startIncrementing}
          onTouchEnd={stopIncrementing}
        >
          Push
        </button>
      </div>

      {/* Navigation Buttons */}
      <div className="absolute flex justify-between px-4 bottom-4 left-4 right-4">
        {/* Empty div to occupy left space */}
        <div></div>

        {/* Next Button on Bottom Right */}
        {moodValue && (
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

export default MoodScreen;
