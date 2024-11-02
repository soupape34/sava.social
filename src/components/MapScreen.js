// src/components/MapScreen.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api"; // Removed Circle
import { getMoodEmoji } from "../utils/moodEmojis";
import mapStyle from "../utils/mapStyle";
import {
  Item,
  Set as Area,
  Collection,
  Space,
  API,
  Network,
  Locality,
  parent,
} from "js-indexus-sdk";

// Define your collections outside the component for better performance
const collections = {
  0: "MjYsMjQ5LDENjYsMTAyLDE2MCwx",
  1: "LDENjYsMTAyLDE2MCwxMjYsMjQ5",
  2: "DE2MCwxMjYsMjQ5LDENjYsMTAyL",
  3: "yLDE2MCwxMjYsMjQ5LDENjYsMTA",
  4: "ENjYsMTAyLDE2MCwxMjYsMjQ5LD",
  5: "LDE2MCwxMjYsMjQ5LDENjYsMTAy",
};

// Define emojis for values 1 to 5
const moodEmojis = {
  1: "😞",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😁",
};

// Function to map mood to color using a gradient from black to yellow
const getColorByMood = (mood) => {
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
    return `rgb(${lower.color.r}, ${lower.color.g}, ${lower.color.b})`;
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

  return `rgb(${r}, ${g}, ${b})`;
};

// Function to map count to marker size
const getSizeByCount = (count) => {
  const minSize = 40;
  const maxSize = 80;
  const size = Math.min(maxSize, minSize + count * 5);
  return size;
};

const MapScreen = ({ screenHeight, moodValue, selectedLocation, onBack }) => {
  const mapRef = useRef(null);
  const networkRef = useRef(null); // Ref to store Network instance
  const collectionRef = useRef(null); // Ref to store Collection instance

  const [markers, setMarkers] = useState([]);
  const [areas, setAreas] = useState([]); // New state for areas
  const [averageScore, setAverageScore] = useState(5.0);
  const [isIndexing, setIsIndexing] = useState(false); // State for indexing
  const [indexingError, setIndexingError] = useState(null); // State for indexing errors
  const [indexusInitialized, setIndexusInitialized] = useState(false); // To prevent re-initialization

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState(0); // New state for selected collection

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
                  selected[tmp] = true;
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

            // Process Items to create markers
            const newMarkers = fetchedItems
              .map((item) => {
                // Decode the hash to get latitude and longitude
                const decodedPoints = space.decode(item._hash); // Assuming decode returns [{ east, north, south, west }]
                if (!decodedPoints || decodedPoints.length === 0) return null;
                const { east, north, south, west } = decodedPoints[0];

                // Get the mood value from _id
                const mood = parseInt(item._id, 10); // Ensure it's an integer

                return {
                  hash: item._hash,
                  position: {
                    lat: (north + south) / 2,
                    lng: (east + west) / 2,
                  },
                  emoji: moodEmojis[mood] || "❓", // Use emoji or a default if undefined
                  mood: mood,
                  title: mood === 0 ? "All Moods" : `Mood: ${mood}`,
                };
              })
              .filter((marker) => marker !== null); // Remove any null markers

            // Process Sets to create areas
            const newAreas = fetchedSets
              .map((setObj) => {
                const hash = setObj._hash;
                const count = setObj._count || 1; // Default to 1 if not available
                const metrics = setObj._metrics;

                const decodedPoints = space.decode(hash); // Assuming decode returns [{ east, north, south, west }]
                if (!decodedPoints || decodedPoints.length === 0) return null;
                const { east, north, south, west } = decodedPoints[0];

                // Calculate center point
                const centerLat = metrics[0] / count;
                const centerLng = metrics[1] / count;
                const mood = metrics[2] / count;

                // Define the bounds for the rectangle
                const bounds = {
                  north: north,
                  south: south,
                  east: east,
                  west: west,
                };

                return {
                  hash,
                  bounds,
                  center: { lat: centerLat, lng: centerLng },
                  mood,
                  count: count,
                };
              })
              .filter((area) => area !== null); // Remove any null areas

            console.log("New Areas:", newAreas);

            // **Calculate Overall Average Mood**
            const totalMood =
              newAreas.reduce((acc, area) => acc + area.mood * area.count, 0) +
              newMarkers.reduce((acc, marker) => acc + marker.mood, 0);
            const totalCount =
              newAreas.reduce((acc, area) => acc + area.count, 0) +
              newMarkers.reduce((acc, marker) => acc + 1, 0);
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

  // Initialize Indexus and index the mood and location
  useEffect(() => {
    // Prevent re-initialization if already done
    if (indexusInitialized) return;

    const initializeAndIndex = async () => {
      if (!moodValue || !selectedLocation) {
        console.warn("Mood value or location not provided.");
        return;
      }

      setIsIndexing(true);
      setIndexingError(null);

      try {
        // Initialize Indexus
        const bootstraps = ["bootstrap.testnet.indexus.network|21000"];
        const dimensions = [{ type: "spherical", args: [-90, -180, 90, 180] }];

        // Get the selected collection
        const collectionId = collections[selectedCollectionId];
        if (!collectionId) {
          throw new Error("Invalid collection ID selected.");
        }

        const collection = new Collection(collectionId, dimensions);

        // Store collection in ref
        collectionRef.current = collection;

        // Initialize Space
        const space = new Space(
          collection.dimensions(),
          collection.mask(),
          collection.offset()
        );

        const spaces = {};
        spaces[collection.name()] = space;

        // Initialize options object
        const geospatiality = space.dimension(0);

        const options = {
          [geospatiality.name()]: {
            origin: geospatiality.newPoint([0, 0]), // You can set a dynamic origin if needed
            filters: geospatiality.newFilter([0, 0], [0, 360]), // Adjust as needed
          },
        };

        // Define cap, limit, and step
        const cap = 2; // Maximum number of sets to process per layer
        const step = 10; // Number of items to return per output step

        const output = {
          send: (result) => {}, // console.log("Output:", result),
        };
        const monitoring = {
          send: (message) => {}, // console.log("Monitoring:", message),
        };

        // Create a new Network instance and store in ref
        const api = new API();
        const network = new Network(api, bootstraps);
        networkRef.current = network;

        // Create a new Locality instance
        const indexus = new Locality(
          spaces,
          options,
          cap,
          step,
          output,
          monitoring,
          network
        );

        const coordinates = [selectedLocation.lat, selectedLocation.lng];

        // Encode the geolocation point
        const encodedPoint = space.encode(
          [geospatiality.newPoint(coordinates)],
          27 // Adjust precision as needed
        );

        // Create a new Item with the mood value
        const item = new Item(
          collection.name(),
          encodedPoint,
          [...coordinates, moodValue],
          moodValue.toString()
        );

        // Add the item to Indexus
        await indexus.addItem(item);
        console.log(
          `Indexed mood: ${moodValue} at [${selectedLocation.lat}, ${selectedLocation.lng}]`
        );

        setIndexusInitialized(true); // Mark as initialized
      } catch (error) {
        console.error("Error indexing mood and location:", error);
        setIndexingError(error.message || "An error occurred during indexing.");
      } finally {
        setIsIndexing(false);
      }
    };

    initializeAndIndex();
  }, [moodValue, selectedLocation, indexusInitialized, selectedCollectionId]);

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

  return (
    <div className="relative w-screen h-screen pb-20">
      {/* Full Screen Map */}
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={selectedLocation}
        zoom={12}
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
          />
        ))}

        {/* Render Area Markers */}
        {areas.map((area, index) => (
          <Marker
            key={`area-${area.hash}-${index}`}
            position={area.center}
            icon={createAreaLabelIcon(area.count, area.mood)}
            title={`Area with ${area.count} mood(s)`}
          />
        ))}
      </GoogleMap>

      {/* Scores Display */}
      <div className="absolute flex flex-col items-center w-11/12 max-w-md px-3 py-1.5 space-y-2 text-base bg-white bg-opacity-75 rounded top-4 left-1/2 transform -translate-x-1/2">
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

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-50">
          <div className="w-11/12 max-w-md p-6 bg-white rounded-lg shadow-lg">
            <h2 className="mb-4 text-xl font-semibold">Filter Collections</h2>
            <div className="mb-6">
              <label
                htmlFor="collection-select-modal"
                className="block mb-2 text-sm font-medium text-gray-700"
              >
                Select Collection:
              </label>
              <select
                id="collection-select-modal"
                value={selectedCollectionId}
                onChange={(e) =>
                  setSelectedCollectionId(parseInt(e.target.value, 10))
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300"
              >
                <option value={0}>All</option>
                {Object.entries(collections)
                  .filter(([id]) => id !== "0")
                  .map(([id, collection]) => (
                    <option key={id} value={id}>
                      {moodEmojis[id] || `Mood ${id}`}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsFilterModalOpen(false);
                  refresh(); // Refresh the map with the new filter
                }}
                className="px-4 py-2 text-white rounded-md bg-primary"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

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
        <button
          onClick={() => setIsFilterModalOpen(true)}
          className="p-2 text-white rounded-full shadow-lg bg-primary"
          aria-label="Open Filter Modal"
        >
          {/* Filter Icon (you can replace this with any icon you prefer) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <g transform="translate(0, 6)">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 0h18M3 6h18M3 12h18"
              />
            </g>
          </svg>
        </button>
      </div>

      {/* Indexing Feedback */}
      {isIndexing && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
          <div className="p-4 text-center bg-white rounded shadow-lg">
            <p className="font-semibold text-md">
              Indexing your mood and location...
            </p>
            {/* Optional Spinner */}
          </div>
        </div>
      )}

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
