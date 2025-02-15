import { useEffect, useState } from "react";
import { ImageOverlay } from "react-leaflet";
import L from "leaflet";

interface ScaledImageOverlayProps {
  url: string;
  center: [number, number];
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export const ScaledImageOverlay = ({
  url,
  center,
  scaleX = 1,
  scaleY = 1,
  rotation = 0,
}: ScaledImageOverlayProps) => {
  const [rotatedImageUrl, setRotatedImageUrl] = useState<string>("");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      // Calculate the diagonal of the image for rotation space
      const diagonal = Math.sqrt(
        img.width * img.width + img.height * img.height
      );

      // Make canvas size the diagonal * 2 to ensure no clipping during rotation
      const canvasSize = diagonal * 2;
      const canvas = document.createElement("canvas");
      canvas.width = canvasSize;
      canvas.height = canvasSize;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear the canvas with transparency
      ctx.clearRect(0, 0, canvasSize, canvasSize);

      // Move to center and rotate
      ctx.translate(canvasSize / 2, canvasSize / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Draw image centered, maintaining original dimensions
      ctx.drawImage(
        img,
        -img.width / 2,
        -img.height / 2,
        img.width,
        img.height
      );

      setRotatedImageUrl(canvas.toDataURL());
      setDimensions({
        width: img.width,
        height: img.height,
      });
    };
    img.src = url;
  }, [url, rotation]);

  if (!rotatedImageUrl || !dimensions.width) return null;

  // Calculate bounds based on aspect ratio and desired size (in meters)
  const widthMeters = dimensions.width * scaleX;
  const heightMeters = dimensions.height * scaleY;

  // Convert meters to lat/lng differences (approximate)
  const metersPerDegree = 111319.9;
  const widthDegrees =
    widthMeters / (metersPerDegree * Math.cos((center[0] * Math.PI) / 180));
  const heightDegrees = heightMeters / metersPerDegree;

  const bounds = [
    [center[0] - heightDegrees / 2, center[1] - widthDegrees / 2],
    [center[0] + heightDegrees / 2, center[1] + widthDegrees / 2],
  ];

  return (
    <ImageOverlay
      url={rotatedImageUrl}
      bounds={bounds as L.LatLngBoundsExpression}
      opacity={0.8}
    />
  );
};
