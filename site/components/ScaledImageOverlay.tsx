import { useEffect, useState } from "react";
import { ImageOverlay } from "react-leaflet";
import L from "leaflet";

interface ScaledImageOverlayProps {
  url: string;
  center: [number, number];
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity?: number;
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
      // Calculate the new canvas dimensions to avoid clipping
      const radians = (rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(radians));
      const cos = Math.abs(Math.cos(radians));
      const newWidth = img.width * cos + img.height * sin;
      const newHeight = img.width * sin + img.height * cos;

      // Create a canvas with the new dimensions
      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear the canvas and apply transformations
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(newWidth / 2, newHeight / 2); // Move to the center of the new canvas
      ctx.rotate(radians); // Apply rotation

      // Draw the image centered on the canvas
      ctx.drawImage(
        img,
        -img.width / 2,
        -img.height / 2,
        img.width,
        img.height
      );

      ctx.restore();

      // Update the rotated image URL and dimensions
      setRotatedImageUrl(canvas.toDataURL());
      setDimensions({
        width: newWidth,
        height: newHeight,
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
    />
  );
};
