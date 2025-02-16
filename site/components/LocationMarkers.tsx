import { useState, useEffect } from "react";
import { useMapEvents, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

interface Location {
  id: string;
  name: string;
  coordinates: [number, number];
}

interface Edge {
  id: string;
  nodes: string[];
}

// Component to handle clicks and markers
export default function LocationMarkers() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
  const [newLocation, setNewLocation] = useState<{
    coordinates: [number, number];
    isNaming: boolean;
  } | null>(null);
  const [newLocationName, setNewLocationName] = useState("");

  // Load locations and edges from localStorage
  useEffect(() => {
    const savedLocations = localStorage.getItem("mapLocations");
    const savedEdges = localStorage.getItem("mapEdges");
    if (savedLocations) {
      setLocations(JSON.parse(savedLocations));
    }
    if (savedEdges) {
      setEdges(JSON.parse(savedEdges));
    }
  }, []);

  useMapEvents({
    click(e) {
      if (!e.originalEvent.shiftKey) {
        const coordinates: [number, number] = [e.latlng.lat, e.latlng.lng];
        console.log("Clicked coordinates:", coordinates);
        setNewLocation({ coordinates, isNaming: true });
        setNewLocationName("");
        setSelectedLocationId(null);
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
    if (event.originalEvent.shiftKey) {
      event.originalEvent.stopPropagation();
      if (selectedLocationId && selectedLocationId !== locationId) {
        // Create new edge
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

  return (
    <>
      {/* Render edges */}
      {edges.map((edge) => {
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
      })}

      {/* Render locations */}
      {locations.map((location) => (
        <Marker
          key={location.id}
          position={location.coordinates}
          eventHandlers={{
            click: (e) => handleMarkerClick(location.id, e),
          }}
        >
          <Popup className="custom-popup">
            <div className="flex flex-col gap-1">
              <div className="text-sm">{location.name}</div>
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
            </div>
          </Popup>
        </Marker>
      ))}

      {/* New location marker */}
      {newLocation && (
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
