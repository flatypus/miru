import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { ScaledImageOverlay } from "./ScaledImageOverlay";
import { MapContainer, useMap } from "react-leaflet";
import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";
import React from "react";
import LocationMarkers from "./LocationMarkers";

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

function Map({ center, zoom }: MapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      minZoom={16}
      maxZoom={24}
      scrollWheelZoom={true}
      className="w-screen h-screen"
    >
      <MapTilerLayerComponent />
      <LocationMarkers />
      <ScaledImageOverlay
        url="/huang.png"
        center={[37.427935, -122.174265]}
        scaleX={0.18}
        scaleY={0.19}
        rotation={105}
      />
    </MapContainer>
  );
}

export default Map;
