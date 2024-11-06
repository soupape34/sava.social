// src/components/MapScreen.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api"; // Removed Circle
import { getMoodEmoji } from "../utils/moodEmojis";
import mapStyle from "../utils/mapStyle";
import "react-datepicker/dist/react-datepicker.css";

import {
  Item,
  Set as Area,
  Collection,
  Space,
  API,
  Network,
  parent,
} from "js-indexus-sdk";

// Define emojis for values 1 to 5
const moodEmojis = {
  1: "😞",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😁",
};

// Function to map mood to color using a gradient from black to yellow
const getColorByMood = (mood, alpha = 1) => {
  // Clamp mood between 1 and 5
  const clampedMood = Math.max(1, Math.min(mood, 5));

  // Map mood to percentage (1 -> 0%, 5 -> 100%)
  const percentage = ((clampedMood - 1) / 4) * 100;

  // Define gradient color stops
  const colorStops = [
    { percentage: 0, color: { r: 2, g: 0, b: 36 } }, // rgba(2,0,36,1) at 0%
    { percentage: 35, color: { r: 121, g: 22, b: 9 } }, // rgba(121,22,9,1) at 35%
    { percentage: 100, color: { r: 0, g: 212, b: 255 } }, // rgba(0,212,255,1) at 100%
  ];

  // Find the two color stops between which the percentage falls
  let lower = colorStops[0];
  let upper = colorStops[0];
  for (let i = 0; i < colorStops.length; i++) {
    if (percentage <= colorStops[i].percentage) {
      upper = colorStops[i];
      lower = colorStops[i - 1] || colorStops[0];
      break;
    }
    lower = colorStops[i];
  }

  // If percentage exceeds the last color stop
  if (percentage > colorStops[colorStops.length - 1].percentage) {
    lower = colorStops[colorStops.length - 1];
    upper = colorStops[colorStops.length - 1];
  }

  // If both stops are the same, return the color directly
  if (lower.percentage === upper.percentage) {
    return `rgba(${lower.color.r}, ${lower.color.g}, ${lower.color.b}, ${alpha})`;
  }

  // Calculate the interpolation factor between the two stops
  const range = upper.percentage - lower.percentage;
  const fraction = (percentage - lower.percentage) / range;

  // Interpolate RGB values
  const r = Math.round(
    lower.color.r + fraction * (upper.color.r - lower.color.r)
  );
  const g = Math.round(
    lower.color.g + fraction * (upper.color.g - lower.color.g)
  );
  const b = Math.round(
    lower.color.b + fraction * (upper.color.b - lower.color.b)
  );

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Function to map count to marker size
const getSizeByCount = (count) => {
  const minSize = 40;
  const maxSize = 80;
  const size = Math.min(maxSize, minSize + count * 5);
  return size;
};

const randomizeLocation = (selectedLocation, maxOffsetMeters = 10) => {
  const { lat, lng } = selectedLocation;
  const earthRadius = 6378137; // Earth's radius in meters

  // Convert maximum offset from meters to degrees
  const maxOffsetDegreesLat = (maxOffsetMeters / earthRadius) * (180 / Math.PI);
  const maxOffsetDegreesLng =
    (maxOffsetMeters / (earthRadius * Math.cos((lat * Math.PI) / 180))) *
    (180 / Math.PI);

  // Generate random offsets within the range
  const offsetLat = (Math.random() - 0.5) * 2 * maxOffsetDegreesLat;
  const offsetLng = (Math.random() - 0.5) * 2 * maxOffsetDegreesLng;

  return [lat + offsetLat, lng + offsetLng];
};

const MapScreen = ({
  screenHeight,
  moodValue,
  setMoodValue,
  selectedLocation,
  setSelectedLocation,
  onBack,
}) => {
  const mapRef = useRef(null);
  const networkRef = useRef(null); // Ref to store Network instance
  const collectionRef = useRef(null); // Ref to store Collection instance

  const [markers, setMarkers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [averageScore, setAverageScore] = useState(5.0);
  const [indexingError, setIndexingError] = useState(null);

  const zoomTimeoutRef = useRef(null);
  const moveTimeoutRef = useRef(null);

  // Create Emoji Marker Icon
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

  // Create Area Label Marker Icon (for counts) with dynamic color and size
  const createAreaLabelIcon = (count, mood) => {
    const color = getColorByMood(mood);
    const size = getSizeByCount(count);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${
      size / 4
    }" fill="${color}" stroke="white" stroke-width="3" />
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${
          size / 6
        }" fill="white" font-family="Arial">${count}</text>
      </svg>
    `;
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size / 2, size / 2),
    };
  };

  // **New Function to Clear Map Markers and Areas**
  const clearMap = useCallback(() => {
    setMarkers([]);
    setAreas([]);
  }, []);

  // **Initialize Indexus (networkRef and collectionRef)**
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initializeIndexus = async () => {
      if (!moodValue || !selectedLocation) {
        console.warn("Mood value or location not provided.");
        return;
      }

      setIndexingError(null);

      const location = {
        gps: randomizeLocation(selectedLocation, 30),
        time: [new Date().getTime()],
      };

      const api = new API();

      const network = new Network("https", api, [
        "bootstrap.testnet.indexus.network|21000",
      ]);

      const collections = [
        new Collection("LDE2MCwxMjYsMjQ5LDENjYsMTAy", [
          {
            name: "gps",
            type: "spherical",
            args: [-90, -180, 90, 180],
          },
        ]),
        new Collection("yLDE2MCwxMjYsMjQ5LDENjYsMTA", [
          {
            name: "gps",
            type: "spherical",
            args: [-90, -180, 90, 180],
          },
          {
            name: "time",
            type: "linear",
            args: [-126230400 * 16 * 16 * 8, 126230400 * 16 * 16 * 8],
          },
        ]),
      ];

      networkRef.current = network;
      collectionRef.current = collections[0];

      const today = new Date().toISOString().split("T")[0];
      const storedData = localStorage.getItem(`moodData-${today}`);

      if (storedData) {
        return;
      }

      for (let i = 0; i < collections.length; i++) {
        const collection = collections[i];

        const space = new Space(
          collection.dimensions(),
          collection.mask(),
          collection.offset()
        );

        const point = [];
        const metrics = [moodValue];

        for (let j = 0; j < space.size(); j++) {
          const dimension = space.dimension(j);
          const coordinates = location[dimension.name()];

          point.push(dimension.newPoint(coordinates));
          metrics.push(...coordinates);
        }

        try {
          await network.addItem(
            collection.name(),
            "@",
            space.encode(point, 27),
            metrics,
            moodValue.toString()
          );
        } catch (error) {
          console.error("Error initializing Indexus:", error);
          setIndexingError(
            error.message || "An error occurred during initialization."
          );
        }
      }

      localStorage.setItem(
        `moodData-${today}`,
        JSON.stringify({ moodValue, location })
      );
    };

    initializeIndexus();
  }, [moodValue, selectedLocation]);

  // Define the refresh function
  const refresh = useCallback(() => {
    const fetchSets = async () => {
      const collection = collectionRef.current;
      const network = networkRef.current;
      // Removed loadedHashes since caching is disabled

      if (!collection || !network) {
        return;
      }

      // **Clear existing markers and areas**
      clearMap();

      // Initialize Space
      const space = new Space(
        collection.dimensions(),
        collection.mask(),
        collection.offset()
      );

      // Calculate encoded corners
      if (mapRef.current) {
        const bounds = mapRef.current.getBounds();
        if (bounds) {
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();

          const points = [
            space.newPoint([[sw.lat(), sw.lng()]]), // Bottom-left
            space.newPoint([[sw.lat(), ne.lng()]]), // Bottom-right
            space.newPoint([[ne.lat(), sw.lng()]]), // Top-left
            space.newPoint([[ne.lat(), ne.lng()]]), // Top-right
          ];
          let hashes = points.map((point) => space.encode(point, 27));
          let selected = {};

          for (let i = 0; i < 27; i++) {
            const m = {};
            const borders = hashes.map((hash) => {
              let v = "@";
              if (i > 0) {
                v = hash.substring(0, i);
              }
              m[v] = true;
              return space.decode(v);
            });

            const keys = Object.keys(m);
            if (keys.length === 2) {
              if (
                borders[0][0].east !== borders[1][0].west &&
                borders[0][0].north !== borders[2][0].south
              ) {
                break;
              }
            }
            if (keys.length === 4) {
              if (
                borders[0][0].north !== borders[3][0].south ||
                borders[0][0].east !== borders[3][0].west
              ) {
                break;
              }
            }
            selected = { ...m };
          }

          try {
            const result = [];

            while (Object.keys(selected).length > 0) {
              const selectedHashes = Object.keys(selected);
              selected = {};

              for (const hash of selectedHashes) {
                // Always fetch the set for the hash
                const set = await network.getSet(collection.name(), hash);

                if (set.length === 0) {
                  const tmp = parent(hash);
                  if (tmp.length > 0) {
                    selected[tmp] = true;
                  }
                } else {
                  set.forEach((elm) => {
                    elm._parent = hash;
                    result.push(elm);
                  });
                  // Removed caching behavior
                }
              }
            }

            // Separate Items and Sets
            const fetchedItems = result.filter(
              (element) => element instanceof Item
            );
            const fetchedSets = result.filter(
              (element) => element instanceof Area
            );

            // **Get Current Map Bounds for Visibility Calculation**
            const currentBounds = mapRef.current.getBounds();

            // Process Items to create markers
            const newMarkers = fetchedItems
              .map((item) => {
                // Decode the hash to get latitude and longitude
                const decodedPoints = space.decode(item._hash); // Assuming decode returns [{ east, north, south, west }]
                if (!decodedPoints || decodedPoints.length === 0) return null;
                const { east, north, south, west } = decodedPoints[0];

                // Get the mood value from _id
                const mood = parseInt(item._id, 10); // Ensure it's an integer

                const position = {
                  lat: (north + south) / 2,
                  lng: (east + west) / 2,
                };

                // Determine visibility based on current map bounds
                const isVisible = currentBounds.contains(
                  new window.google.maps.LatLng(position.lat, position.lng)
                );

                return {
                  hash: item._hash,
                  position: position,
                  emoji: moodEmojis[mood] || "❓", // Use emoji or a default if undefined
                  mood: mood,
                  title: mood === 0 ? "All Moods" : `Mood: ${mood}`,
                  visible: isVisible, // Set visibility
                };
              })
              .filter((marker) => marker !== null); // Remove any null markers

            // Process Sets to create areas
            const newAreas = fetchedSets
              .map((setObj) => {
                const hash = setObj._hash;
                const count = setObj._count || 1; // Default to 1 if not available
                const metrics = setObj._metrics;

                // Calculate center point
                const mood = metrics[0] / count;
                const centerLat = metrics[1] / count;
                const centerLng = metrics[2] / count;

                const center = { lat: centerLat, lng: centerLng };

                // Determine visibility based on current map bounds
                const isVisible = currentBounds.contains(
                  new window.google.maps.LatLng(center.lat, center.lng)
                );

                return {
                  hash,
                  center: center,
                  mood,
                  count: count,
                  visible: isVisible, // Set visibility
                };
              })
              .filter((area) => area !== null); // Remove any null areas

            // **Calculate Overall Average Mood**
            // Filter only the visible areas and markers
            const visibleMarkers = newMarkers.filter(
              (marker) => marker.visible
            );
            const visibleAreas = newAreas.filter((area) => area.visible);

            const totalMood =
              visibleAreas.reduce(
                (acc, area) => acc + area.mood * area.count,
                0
              ) + visibleMarkers.reduce((acc, marker) => acc + marker.mood, 0);
            const totalCount =
              visibleAreas.reduce((acc, area) => acc + area.count, 0) +
              visibleMarkers.reduce((acc, marker) => acc + 1, 0);
            const overallAverage = totalCount > 0 ? totalMood / totalCount : 0;

            setAverageScore(overallAverage.toFixed(2));

            // **Update markers state by replacing existing markers with new markers**
            setMarkers(newMarkers);

            // **Update areas state by replacing existing areas with new areas**
            setAreas(newAreas);
          } catch (error) {
            console.error("Error fetching sets from Indexus:", error);
          }
        }
      }
    };

    fetchSets();
  }, [clearMap]); // Removed 'collections' from dependencies as it's a constant

  // Handle map load
  const onMapLoad = useCallback(
    (map) => {
      mapRef.current = map;

      // Handler for zoom changes with debounce
      const handleZoomChanged = () => {
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
        // Set a new timeout to call refresh after 1 second of no zoom changes
        zoomTimeoutRef.current = setTimeout(() => {
          refresh();
        }, 1000);
      };

      // Handler for map movements with debounce
      const handleMapMove = () => {
        if (moveTimeoutRef.current) {
          clearTimeout(moveTimeoutRef.current);
        }
        // Set a new timeout to call refresh after 1 second of no movement
        moveTimeoutRef.current = setTimeout(() => {
          refresh();
        }, 1000);
      };

      map.addListener("zoom_changed", handleZoomChanged);
      map.addListener("bounds_changed", handleMapMove);

      // Initial refresh to load markers when map is first loaded
      refresh();

      // Cleanup function to remove listeners and clear timeouts
      return () => {
        window.google.maps.event.clearInstanceListeners(map);

        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
        if (moveTimeoutRef.current) {
          clearTimeout(moveTimeoutRef.current);
        }
      };
    },
    [refresh] // Ensure 'refresh' is correctly included
  );

  // **Helper Function to Determine Text Color Based on Background Brightness**
  const getTextColor = (rgbaColor) => {
    // Extract RGB values
    const matches = rgbaColor.match(/rgba?\((\d+), (\d+), (\d+)/);
    if (!matches) return "#000"; // Default to black if parsing fails

    const r = parseInt(matches[1], 10);
    const g = parseInt(matches[2], 10);
    const b = parseInt(matches[3], 10);

    // Calculate brightness using the YIQ formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // Return black for bright colors, white for dark colors
    return brightness > 125 ? "#000" : "#fff";
  };

  // **Compute Background Color and Text Color for Scores Display**
  const backgroundColor = getColorByMood(averageScore, 0.75); // 75% opacity
  const textColor = getTextColor(backgroundColor);

  return (
    <div className="relative w-screen h-screen pb-20">
      {/* Full Screen Map */}
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={selectedLocation}
        zoom={2}
        options={{ disableDefaultUI: true, styles: mapStyle }}
        onLoad={onMapLoad} // Attach the onLoad handler
      >
        {/* Render Individual Emoji Markers */}
        {markers.map((marker, index) => (
          <Marker
            key={`${marker.position.lat},${marker.position.lng}-marker-${index}`}
            position={marker.position}
            icon={createEmojiMarkerIcon(marker.emoji)}
            title={marker.title}
            visible={marker.visible} // Control visibility
          />
        ))}

        {/* Render Area Markers */}
        {areas.map((area, index) => (
          <Marker
            key={`area-${area.hash}-${index}`}
            position={area.center}
            icon={createAreaLabelIcon(area.count, area.mood)}
            title={`Area with ${area.count} mood(s)`}
            visible={area.visible} // Control visibility
          />
        ))}
      </GoogleMap>

      {/* Scores Display */}
      <div
        className="absolute flex flex-col items-center w-11/12 max-w-md px-3 py-1.5 space-y-2 rounded top-4 left-1/2 transform -translate-x-1/2"
        style={{
          backgroundColor: backgroundColor, // Dynamic background color
          color: textColor, // Dynamic text color for readability
        }}
      >
        {/* Combined Scores */}
        <div className="flex flex-wrap justify-center gap-10">
          {[
            {
              label: "Me:",
              value: moodValue,
              emoji: getMoodEmoji(moodValue),
            },
            {
              label: "Area:",
              value: averageScore,
              emoji: getMoodEmoji(Math.round(averageScore)),
            },
          ].map(({ label, value, emoji }, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <span>{label}</span>
              <span className="text-xl">{emoji}</span>
              <span className="font-bold">{value}</span>
            </div>
          ))}
        </div>
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
      </div>

      {/* Indexing Error Display */}
      {indexingError && (
        <div className="fixed left-1/2 bottom-4 transform -translate-x-1/2 px-3 py-1.5 bg-red-500 text-white rounded">
          <p className="text-sm">Error indexing data: {indexingError}</p>
          <button
            onClick={() => setIndexingError(null)}
            className="mt-1 px-2 py-0.5 bg-white text-red-500 rounded text-xs"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

export default MapScreen;
