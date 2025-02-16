"use client";

import "leaflet/dist/leaflet.css";
import Map from "@/components/Map";
import L from "leaflet";

const STANFORD = {
  latitude: 37.42796,
  longitude: -122.17436,
};

export default function Home() {
  const center = new L.LatLng(STANFORD.latitude, STANFORD.longitude);
  return <Map center={center} zoom={20} />;
}
