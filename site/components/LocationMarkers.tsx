import { useState, useEffect } from "react";
import { useMapEvents, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { Location, Edge } from "./Map";

function findPath(
  start: string,
  end: string,
  locations: Location[],
  edges: Edge[]
): string[] | null {
  // Create adjacency list from edges
  const graph = new Map<string, string[]>();
  edges.forEach((edge) => {
    const [a, b] = edge.nodes;
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a)?.push(b);
    graph.get(b)?.push(a);
  });

  // Helper to calculate distance between two locations
  const getDistance = (id1: string, id2: string): number => {
    const loc1 = locations.find((l) => l.id === id1);
    const loc2 = locations.find((l) => l.id === id2);
    if (!loc1 || !loc2) return Infinity;
    return Math.sqrt(
      Math.pow(loc1.coordinates[0] - loc2.coordinates[0], 2) +
        Math.pow(loc1.coordinates[1] - loc2.coordinates[1], 2)
    );
  };

  // A* implementation
  const openSet = new Set([start]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  gScore.set(start, 0);
  fScore.set(start, getDistance(start, end));

  while (openSet.size > 0) {
    let current = Array.from(openSet).reduce((a, b) => {
      const aScore = fScore.get(a);
      const bScore = fScore.get(b);
      return (aScore === undefined ? Infinity : aScore) <
        (bScore === undefined ? Infinity : bScore)
        ? a
        : b;
    });

    if (current === end) {
      // Reconstruct path
      const path = [current];
      while (cameFrom.has(current)) {
        current = cameFrom.get(current)!;
        path.unshift(current);
      }
      return path;
    }

    openSet.delete(current);
    const neighbors = graph.get(current) || [];
    for (const neighbor of neighbors) {
      const currentGScore = gScore.get(current);
      const tentativeGScore =
        (currentGScore === undefined ? Infinity : currentGScore) +
        getDistance(current, neighbor);
      const neighborGScore = gScore.get(neighbor);
      if (
        tentativeGScore <
        (neighborGScore === undefined ? Infinity : neighborGScore)
      ) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeGScore);
        fScore.set(neighbor, tentativeGScore + getDistance(neighbor, end));
        openSet.add(neighbor);
      }
    }
  }

  return null;
}

function findNearestFeature(
  coordinates: [number, number],
  locations: Location[]
): Location | null {
  const validLocations = locations.filter(
    (loc) => !loc.name.includes("door") && !loc.name.includes("hallway")
  );

  if (validLocations.length === 0) return null;

  return validLocations.reduce((nearest, loc) => {
    const distance = Math.sqrt(
      Math.pow(coordinates[0] - loc.coordinates[0], 2) +
        Math.pow(coordinates[1] - loc.coordinates[1], 2)
    );

    const nearestDistance = Math.sqrt(
      Math.pow(coordinates[0] - nearest.coordinates[0], 2) +
        Math.pow(coordinates[1] - nearest.coordinates[1], 2)
    );

    return distance < nearestDistance ? loc : nearest;
  }, validLocations[0]);
}

// Component to handle clicks and markers
export default function LocationMarkers({
  mode,
  locations,
  edges,
  setLocations,
  setEdges,
  startLocationId,
  endLocationId,
  onSelectStart,
  onSelectEnd,
  degrees,
  setUserLocation,
}: {
  mode: "edit" | "search" | "track";
  locations: Location[];
  edges: Edge[];
  setLocations: (locations: Location[]) => void;
  setEdges: (edges: Edge[]) => void;
  startLocationId: string | null;
  endLocationId: string | null;
  onSelectStart: (locationId: string) => void;
  onSelectEnd: (locationId: string) => void;
  degrees: number;
  setUserLocation: (coordinates: [number, number]) => void;
}) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
  const [newLocation, setNewLocation] = useState<{
    coordinates: [number, number];
    isNaming: boolean;
  } | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [searchPath, setSearchPath] = useState<string[] | null>(null);
  const [trackedCoordinates, setTrackedCoordinates] = useState<
    {
      coordinates: [number, number];
      time: number;
      degrees: number;
    }[]
  >([]);

  // Update path when start or end location changes
  useEffect(() => {
    if (startLocationId && endLocationId) {
      const path = findPath(startLocationId, endLocationId, locations, edges);
      setSearchPath(path);
    } else {
      setSearchPath(null);
    }
  }, [startLocationId, endLocationId, locations, edges]);

  useMapEvents({
    click(e) {
      const coordinates: [number, number] = [e.latlng.lat, e.latlng.lng];
      console.log(coordinates)

      if (mode === "edit" && !e.originalEvent.shiftKey) {
        setNewLocation({ coordinates, isNaming: true });
        setNewLocationName("");
        setSelectedLocationId(null);
      } else if (mode === "search") {
        const nearest = findNearestFeature(coordinates, locations);
        if (nearest) {
          if (startLocationId && endLocationId) {
            onSelectStart(nearest.id);
            onSelectEnd("");
          } else if (!startLocationId) {
            onSelectStart(nearest.id);
          } else if (!endLocationId) {
            onSelectEnd(nearest.id);
          }
        }
      } else if (mode === "track") {
        const newTrackedCoordinates = [
          ...trackedCoordinates,
          { coordinates, time: Date.now(), degrees },
        ];
        setUserLocation(coordinates);
        setTrackedCoordinates(newTrackedCoordinates);
        console.log(newTrackedCoordinates);
      }
    },
  });

  const handleSaveLocation = () => {
    if (newLocation && newLocationName.trim()) {
      const newLoc: Location = {
        id: Date.now().toString(),
        name: newLocationName,
        coordinates: newLocation.coordinates,
      };
      const updatedLocations = [...locations, newLoc];
      setLocations(updatedLocations);
      localStorage.setItem("mapLocations", JSON.stringify(updatedLocations));
      setNewLocation(null);
      setNewLocationName("");
    }
  };

  const handleDeleteLocation = (id: string) => {
    const updatedLocations = locations.filter((loc) => loc.id !== id);
    const updatedEdges = edges.filter((edge) => !edge.nodes.includes(id));
    setLocations(updatedLocations);
    setEdges(updatedEdges);
    localStorage.setItem("mapLocations", JSON.stringify(updatedLocations));
    localStorage.setItem("mapEdges", JSON.stringify(updatedEdges));
  };

  const handleMarkerClick = (
    locationId: string,
    event: L.LeafletMouseEvent
  ) => {
    if (mode === "edit" && event.originalEvent.shiftKey) {
      event.originalEvent.stopPropagation();
      if (selectedLocationId && selectedLocationId !== locationId) {
        const newEdge: Edge = {
          id: Date.now().toString(),
          nodes: [selectedLocationId, locationId],
        };
        const updatedEdges = [...edges, newEdge];
        setEdges(updatedEdges);
        localStorage.setItem("mapEdges", JSON.stringify(updatedEdges));
        setSelectedLocationId(null);
      } else {
        setSelectedLocationId(locationId);
      }
    }
  };

  const handleDeleteEdge = (edgeId: string) => {
    const updatedEdges = edges.filter((edge) => edge.id !== edgeId);
    setEdges(updatedEdges);
    localStorage.setItem("mapEdges", JSON.stringify(updatedEdges));
  };

  const handleMarkerDrag = (locationId: string, newPosition: L.LatLng) => {
    if (mode === "edit") {
      const updatedLocations = locations.map((loc) =>
        loc.id === locationId
          ? {
              ...loc,
              coordinates: [newPosition.lat, newPosition.lng] as [
                number,
                number
              ],
            }
          : loc
      );
      setLocations(updatedLocations);
      localStorage.setItem("mapLocations", JSON.stringify(updatedLocations));
    }
  };

  return (
    <>
      {/* Render path or edges */}
      {mode === "search" && searchPath ? (
        // Render search path
        <Polyline
          positions={searchPath.map(
            (id) =>
              locations.find((loc) => loc.id === id)?.coordinates || [0, 0]
          )}
          color="#f00"
          weight={4}
          dashArray="10,10"
        />
      ) : mode === "edit" ? (
        // Render edges in edit mode
        edges.map((edge) => {
          const [sourceId, targetId] = edge.nodes;
          const source = locations.find((loc) => loc.id === sourceId);
          const target = locations.find((loc) => loc.id === targetId);
          if (!source || !target) return null;
          return (
            <Polyline
              key={edge.id}
              positions={[source.coordinates, target.coordinates]}
              color={selectedLocationId ? "#666" : "#00f"}
              weight={3}
              eventHandlers={{ click: () => handleDeleteEdge(edge.id) }}
            />
          );
        })
      ) : null}

      {/* Render locations */}
      {locations
        .filter((location) => {
          if (mode === "edit") return true;
          return (
            location.id === startLocationId || location.id === endLocationId
          );
        })
        .map((location) => (
          <Marker
            key={location.id}
            position={location.coordinates}
            draggable={mode === "edit"}
            eventHandlers={{
              click: (e) => handleMarkerClick(location.id, e),
              dragend: (e) =>
                handleMarkerDrag(location.id, e.target.getLatLng()),
            }}
          >
            <Popup className="custom-popup">
              <div className="flex flex-col gap-1">
                <div className="text-sm">{location.name}</div>
                {mode === "edit" && (
                  <>
                    <div className="text-[10px] text-gray-500">
                      {selectedLocationId === location.id
                        ? "Shift-click another location to connect"
                        : "Shift-click to start connection"}
                    </div>
                    <button
                      onClick={() => handleDeleteLocation(location.id)}
                      className="bg-red-500 text-white px-1.5 py-0.5 rounded text-xs"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

      {/* Only show new location marker in edit mode */}
      {mode === "edit" && newLocation && (
        <Marker position={newLocation.coordinates}>
          <Popup className="custom-popup">
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSaveLocation()}
                placeholder="Enter location name"
                className="p-0.5 border rounded text-xs"
                autoFocus
              />
              <button
                onClick={handleSaveLocation}
                className="bg-blue-500 text-white px-1.5 py-0.5 rounded text-xs"
              >
                Save
              </button>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}
