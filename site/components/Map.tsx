import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { ScaledImageOverlay } from "./ScaledImageOverlay";
import { MapContainer, useMap } from "react-leaflet";
import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";
import React, { useEffect, useState } from "react";
import LocationMarkers from "./LocationMarkers";
import SearchPanel from "./SearchPanel";

// Custom component to add MapTiler layer
function MapTilerLayerComponent() {
  const map = useMap();

  React.useEffect(() => {
    const layer = new MaptilerLayer({
      apiKey: process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? "",
      style: "streets-v2",
      language: "en",
    }).addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [map]);

  return null;
}

interface MapProps {
  center: L.LatLng;
  zoom: number;
}

export interface Location {
  id: string;
  name: string;
  coordinates: [number, number];
}

export interface Edge {
  id: string;
  nodes: string[];
}

function Map({ center, zoom }: MapProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [startLocationId, setStartLocationId] = useState<string | null>(null);
  const [endLocationId, setEndLocationId] = useState<string | null>(null);

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

  return (
    <div className="relative">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        minZoom={16}
        maxZoom={24}
        scrollWheelZoom={true}
        className="w-screen h-screen"
      >
        <MapTilerLayerComponent />
        <LocationMarkers
          mode="search"
          locations={locations}
          edges={edges}
          setLocations={setLocations}
          setEdges={setEdges}
          startLocationId={startLocationId}
          endLocationId={endLocationId}
          onSelectStart={setStartLocationId}
          onSelectEnd={setEndLocationId}
        />
        <ScaledImageOverlay
          url="/huang.png"
          center={[37.427935, -122.174265]}
          scaleX={0.18}
          scaleY={0.19}
          rotation={105}
        />
      </MapContainer>
      <SearchPanel
        locations={locations}
        onSelectStart={setStartLocationId}
        onSelectEnd={setEndLocationId}
        startLocationId={startLocationId}
        endLocationId={endLocationId}
      />
    </div>
  );
}

export default Map;
