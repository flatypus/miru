import { Location } from "./Map";
import { useState } from "react";

interface SearchPanelProps {
  locations: Location[];
  onSelectStart: (locationId: string) => void;
  onSelectEnd: (locationId: string) => void;
  startLocationId: string | null;
  endLocationId: string | null;
}

const filteredLocations = (locations: Location[], search: string) => {
  return locations.filter((loc) => {
    if (loc.name === "hallway") return false;
    if (loc.name.includes("door")) return false;
    const name = loc.name.toLowerCase();
    const searchLower = search.toLowerCase();
    return name.includes(searchLower);
  });
};

export default function SearchPanel({
  locations,
  onSelectStart,
  onSelectEnd,
  startLocationId,
  endLocationId,
}: SearchPanelProps) {
  const [startSearch, setStartSearch] = useState("");
  const [endSearch, setEndSearch] = useState("");

  const filteredStartLocations = filteredLocations(locations, startSearch);
  const filteredEndLocations = filteredLocations(locations, endSearch);

  return (
    <div className="absolute right-4 top-4 bg-white rounded-lg shadow-lg p-4 w-72 z-[1000] text-black">
      <div className="flex flex-col gap-4">
        {/* Start location search */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <input
              type="text"
              value={startSearch}
              onChange={(e) => setStartSearch(e.target.value)}
              placeholder="Search start location"
              className="w-full p-2 border rounded"
            />
            {startLocationId && (
              <div className="mt-1 text-sm text-black">
                Selected:{" "}
                {locations.find((loc) => loc.id === startLocationId)?.name}
              </div>
            )}
            {startSearch && (
              <div className="absolute top-full left-0 right-0 bg-white border rounded-b shadow-lg mt-1 max-h-48 overflow-y-auto z-[1001]">
                {filteredStartLocations.map((location) => (
                  <div
                    key={location.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      onSelectStart(location.id);
                      setStartSearch("");
                    }}
                  >
                    {location.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* End location search */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <input
              type="text"
              value={endSearch}
              onChange={(e) => setEndSearch(e.target.value)}
              placeholder="Search end location"
              className="w-full p-2 border rounded"
            />
            {endLocationId && (
              <div className="mt-1 text-sm">
                Selected:{" "}
                {locations.find((loc) => loc.id === endLocationId)?.name}
              </div>
            )}
            {endSearch && (
              <div className="absolute top-full left-0 right-0 bg-white border rounded-b shadow-lg mt-1 max-h-48 overflow-y-auto z-[1001]">
                {filteredEndLocations.map((location) => (
                  <div
                    key={location.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      onSelectEnd(location.id);
                      setEndSearch("");
                    }}
                  >
                    {location.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
