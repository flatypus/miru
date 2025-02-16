import json

# Load locations
with open("locations.json", "r") as f:
    LOCATIONS = json.load(f)["locations"]

def find_destination(user_text):
    """Check if user text contains a valid location."""
    for location in LOCATIONS:
        if location.lower() in user_text.lower():
            return location
    return None
