import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { ScaledImageOverlay } from "./ScaledImageOverlay";
import { MapContainer, useMap } from "react-leaflet";
import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";
import React, { useEffect, useRef, useState } from "react";
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
  const [userDegrees, setUserDegrees] = useState<number>(0);
  const [calibrationDegrees, setCalibrationDegrees] = useState<number>(0);
  const [userLocation, setUserLocation] = useState<[number, number]>([
    37.427935, -122.174265,
  ]);
  const ws = useRef<WebSocket | null>(null);

  // Load saved data including calibration
  useEffect(() => {
    const savedLocations = localStorage.getItem("mapLocations");
    const savedEdges = localStorage.getItem("mapEdges");
    const savedCalibration = localStorage.getItem("calibrationDegrees");

    if (savedLocations) setLocations(JSON.parse(savedLocations));
    if (savedEdges) setEdges(JSON.parse(savedEdges));
    if (savedCalibration) setCalibrationDegrees(Number(savedCalibration));
  }, []);

  // Save calibration when it changes
  useEffect(() => {
    localStorage.setItem("calibrationDegrees", calibrationDegrees.toString());
  }, [calibrationDegrees]);

  useEffect(() => {
    // websocket to get location data
    const ws_frontend = new WebSocket("ws://localhost:4000/ws-for-frontend");
    ws_frontend.onmessage = (event) => {
      const { data } = JSON.parse(event.data);
      setUserDegrees(data);
    };

    ws.current = new WebSocket("ws://localhost:4000/ws-for-buttons");
  }, []);

  return (
    <div className="relative">
      <div className="absolute top-20 left-4 z-[10000] flex justify-center items-center gap-2 flex-col">
        {["FRONT", "FRONT LEFT", "FRONT RIGHT", "LEFT", "RIGHT"].map(
          (button, index) => (
            <button
              key={button}
              className="bg-white rounded-lg p-2 text-black border-2 border-black text-sm hover:scale-105 transition-all duration-150 cursor-pointer active:scale-95"
              onClick={() => {
                ws.current?.send(JSON.stringify({ button: button, index }));
              }}
            >
              Trigger {button}
            </button>
          )
        )}
        <p className="text-black text-sm">
          Calibration: +{calibrationDegrees}°
        </p>
        <input
          className="w-full"
          type="range"
          min={0}
          max={360}
          value={calibrationDegrees}
          onChange={(e) => setCalibrationDegrees(Number(e.target.value))}
        />
      </div>
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
          degrees={userDegrees + calibrationDegrees}
          setUserLocation={setUserLocation}
        />
        <ScaledImageOverlay
          url="/huang.png"
          center={[37.42798, -122.17432]}
          scaleX={0.0545}
          scaleY={0.053}
          rotation={15}
          opacity={1}
        />
        <ScaledImageOverlay
          url="/you.png"
          center={userLocation}
          scaleX={0.1}
          scaleY={0.1}
          rotation={userDegrees + calibrationDegrees}
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
