import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { ScaledImageOverlay } from "./ScaledImageOverlay";
import { MapContainer, useMap } from "react-leaflet";
import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const [targetDegrees, setTargetDegrees] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<number>(new Date().getTime());
  const [userLocation, setUserLocation] = useState<[number, number]>([
    37.427935, -122.174265,
  ]);
  const ws = useRef<WebSocket | null>(null);
  const [updateHook, setUpdateHook] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [searchPath, setSearchPath] = useState<string[] | null>(null);
  const [progressLocation, setProgressLocation] = useState<[number, number]>([
    0, 0,
  ]);

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
      const { degrees, coordinates } = data;
      // console.log(coordinates)
      setUserDegrees(degrees);
      setUserLocation([parseFloat(coordinates[0]), parseFloat(coordinates[1])]);
    };

    ws.current = new WebSocket("ws://localhost:4000/ws-for-buttons");
  }, []);

  useEffect(() => {
    setInterval(() => {
      setUpdateHook((_updateHook) => _updateHook + 1);
    }, 1000);
  }, []);

  useEffect(() => {
    const now = new Date().getTime();
    if (lastUpdate + 3000 < now) {
      let diff = Math.round(
        (targetDegrees - (userDegrees + calibrationDegrees)) % 360
      );
      if (diff > 180) {
        diff -= 360;
      } else if (diff < -180) {
        diff += 360;
      }
      setLastUpdate(now);
      console.log(diff);
      if (Math.abs(diff) < 10) {
        ws.current?.send(JSON.stringify({ index: 0 }));
      } else if (diff < 0 && diff > -90) {
        ws.current?.send(JSON.stringify({ index: 1 }));
      } else if (diff > 0 && diff < 90) {
        ws.current?.send(JSON.stringify({ index: 2 }));
      } else if (diff < -90) {
        ws.current?.send(JSON.stringify({ index: 3 }));
      } else if (diff > 90) {
        ws.current?.send(JSON.stringify({ index: 4 }));
      }
    }
  }, [calibrationDegrees, targetDegrees, userDegrees, lastUpdate, updateHook]);

  const getProgressLocation = useCallback(
    (progress: number) => {
      if (searchPath && searchPath.length > 1) {
        const path = searchPath.map((id) => locations.find((l) => l.id === id));

        // Calculate total path distance
        let totalDistance = 0;
        for (let i = 0; i < path.length - 1; i++) {
          const current = path[i];
          const next = path[i + 1];
          if (!current || !next) continue;
          totalDistance += Math.sqrt(
            Math.pow(current.coordinates[0] - next.coordinates[0], 2) +
              Math.pow(current.coordinates[1] - next.coordinates[1], 2)
          );
        }

        // Find target distance based on progress
        const targetDistance = (progress / 100) * totalDistance;

        // Find position along path
        let coveredDistance = 0;
        for (let i = 0; i < path.length - 1; i++) {
          const current = path[i];
          const next = path[i + 1];
          if (!current || !next) continue;

          const segmentDistance = Math.sqrt(
            Math.pow(current.coordinates[0] - next.coordinates[0], 2) +
              Math.pow(current.coordinates[1] - next.coordinates[1], 2)
          );

          if (coveredDistance + segmentDistance >= targetDistance) {
            // Calculate position within this segment
            const remainingDistance = targetDistance - coveredDistance;
            const ratio = remainingDistance / segmentDistance;

            const newPosition: [number, number] = [
              current.coordinates[0] +
                (next.coordinates[0] - current.coordinates[0]) * ratio,
              current.coordinates[1] +
                (next.coordinates[1] - current.coordinates[1]) * ratio,
            ];
            return newPosition;
          }

          coveredDistance += segmentDistance;
        }

        // If we reach the end, snap to final position
        const lastPoint = path[path.length - 1];
        if (lastPoint) {
          return lastPoint.coordinates;
        }
      }
    },
    [searchPath, locations]
  );

  useEffect(() => {
    if (!searchPath || searchPath.length < 2) {
      setProgress(0);
      return;
    }

    const path = searchPath.map((id) => locations.find((l) => l.id === id));

    // Calculate total path distance and find closest point
    let totalDistance = 0;
    let minDistance = Infinity;
    let closestSegmentStart = 0;
    let closestPoint: [number, number] = [0, 0];

    for (let i = 0; i < path.length - 1; i++) {
      const current = path[i];
      const next = path[i + 1];
      if (!current || !next) continue;

      // Calculate segment distance for total
      const segmentDistance = Math.sqrt(
        Math.pow(current.coordinates[0] - next.coordinates[0], 2) +
          Math.pow(current.coordinates[1] - next.coordinates[1], 2)
      );

      // Find closest point on this segment
      const dx = next.coordinates[0] - current.coordinates[0];
      const dy = next.coordinates[1] - current.coordinates[1];
      const segmentLengthSquared = dx * dx + dy * dy;

      // Calculate projection of point onto line segment
      const t = Math.max(
        0,
        Math.min(
          1,
          ((userLocation[0] - current.coordinates[0]) * dx +
            (userLocation[1] - current.coordinates[1]) * dy) /
            segmentLengthSquared
        )
      );

      const projectedPoint: [number, number] = [
        current.coordinates[0] + t * dx,
        current.coordinates[1] + t * dy,
      ];

      // Calculate distance to projected point
      const distance = Math.sqrt(
        Math.pow(userLocation[0] - projectedPoint[0], 2) +
          Math.pow(userLocation[1] - projectedPoint[1], 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = projectedPoint;
        closestSegmentStart = totalDistance;
      }

      totalDistance += segmentDistance;
    }

    // Calculate progress to closest point
    let progressDistance = closestSegmentStart;
    const current = path[0];
    if (current) {
      progressDistance += Math.sqrt(
        Math.pow(closestPoint[0] - current.coordinates[0], 2) +
          Math.pow(closestPoint[1] - current.coordinates[1], 2)
      );
    }

    setProgress(Math.round((progressDistance / totalDistance) * 100));
  }, [userLocation, searchPath, locations]);

  useEffect(() => {
    const progressLocation = getProgressLocation(progress);
    const targetProgressLocation = getProgressLocation(
      Math.min(progress + 10, 100)
    );
    if (!progressLocation || !targetProgressLocation) return;
    setProgressLocation(progressLocation);
    const direction = [
      targetProgressLocation[0] - progressLocation[0],
      targetProgressLocation[1] - progressLocation[1],
    ];
    const targetAngle = Math.round(
      Math.atan2(direction[1], direction[0]) * (180 / Math.PI)
    );
    setTargetDegrees(targetAngle);
  }, [progress, getProgressLocation]);

  return (
    <div className="relative">
      <div className="absolute top-20 left-4 z-[10000] flex justify-center items-center gap-2 flex-col">
        {["FRONT", "FRONT LEFT", "FRONT RIGHT", "LEFT", "RIGHT"].map(
          (button, index) => (
            <button
              key={button}
              className="bg-white rounded-lg p-2 text-black border-2 border-black text-sm hover:scale-105 transition-all duration-150 cursor-pointer active:scale-95"
              onClick={() => {
                ws.current?.send(JSON.stringify({ index }));
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

        <p className="text-black text-sm">
          User degrees: +{Math.round((userDegrees + calibrationDegrees) % 360)}°
        </p>
        <p className="text-black text-sm">Target degrees: +{targetDegrees}°</p>
        <input
          className="w-full"
          type="range"
          min={0}
          max={360}
          value={targetDegrees}
          onChange={(e) => setTargetDegrees(Number(e.target.value))}
        />

        <p className="text-black text-sm">Progress: {progress}%</p>
        <input
          className="w-full"
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
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
          searchPath={searchPath}
          setSearchPath={setSearchPath}
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
          scaleX={0.025}
          scaleY={0.025}
          rotation={userDegrees + calibrationDegrees}
        />
        <ScaledImageOverlay
          url="/target.png"
          center={progressLocation}
          scaleX={0.025}
          scaleY={0.025}
          rotation={targetDegrees}
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
