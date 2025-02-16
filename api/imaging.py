import json
import re
import threading
import time
import mss
import mss.tools
from dotenv import load_dotenv
import base64
import keyboard

from openai import OpenAI
import os

from vespa.package import (
    ApplicationPackage,
    Field,
    Schema,
    Document,
    HNSW,
    RankProfile,
    Component,
    Parameter,
    FieldSet,
    GlobalPhaseRanking,
    Function,
)
from vespa.deployment import VespaCloud

# Replace with your tenant name from the Vespa Cloud Console
tenant_name = "michaelyu"
# Replace with your application name (does not need to exist yet)
application = "treehacks"

package = ApplicationPackage(
    name=application,
    schema=[
        Schema(
            name="doc",
            document=Document(
                fields=[
                    Field(name="id", type="string", indexing=["summary"]),
                    Field(
                        name="embedding",
                        type="tensor<float>(x[512])",
                        indexing=["index", "attribute"],
                        ann=HNSW(distance_metric="angular"),
                        is_document_field=True,
                    )
                ]
            ),
            rank_profiles=[
                RankProfile(
                    name="image_search",
                    # The query input is a 512-dimensional tensor.
                    inputs=[("query(q)", "tensor<float>(x[512])")],
                    # Use the closeness function with a field reference for 'embedding'.
                    first_phase="closeness(field, embedding)",
                )
            ],
        )
    ],
    components=[
        Component(
            id="e5",
            type="hugging-face-embedder",
            parameters=[
                Parameter(
                    "transformer-model",
                    {
                        "url": "https://github.com/vespa-engine/sample-apps/raw/master/examples/model-exporting/model/e5-small-v2-int8.onnx"
                    },
                ),
                Parameter(
                    "tokenizer-model",
                    {
                        "url": "https://raw.githubusercontent.com/vespa-engine/sample-apps/master/examples/model-exporting/model/tokenizer.json"
                    },
                ),
            ],
        )
    ],
)

# Connect to Vespa Cloud using pyvespa.
vespa_cloud = VespaCloud(
    tenant=tenant_name,
    application=application,
    application_package=package,  # Uses the package we defined above
)
app = vespa_cloud.deploy()

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

zone_data = """
zone_2=terrace entrance,stairs,elevator,red wall,floor map,Terman Library,library
zone_3=deans sign,deans portraits,Jensen Huang sign,hallway with red wall
zone_4=red chairs,couches,tables,large space with yellow lights
zone_5=recycling bins,trash cans,water fountain,hallway
zone_6=posters on side of wall,white hallway
zone_7=bathroom,bench,bathroom sign,man and female on sign, railing,white walls
zone_8=stairwell sign,plants,glass walls,
"""

transition_direction_map = {
    "2": {"s": "3"},
    "3": {"n": "2", "s": "4"},
    "4": {"n": "3", "e": "7", "w": "5"},
    "5": {"e": "4", "w": "6"},
    "6": {"e": "5"},
    "7": {"w": 4, "e": "8"},
    "8": {"w": "7"},
}

room_number_map = {
    "226": "8",
    "243": "8",
    "219": "4",
    "218": "4",
    "203": "3",
    "201": "2",
    "202": "2",
    "214": "5",
    "215": "5",
    "210": "6",
    "209": "6",
    "208": "6",
    "207": "6",
    "206": "6",
    "212": "6",
    "212A": "6",
}

# Global variable to store the previous zone response and a lock for thread safety.
previous_zone_response = "4"
previous_zone_lock = threading.Lock()

# Global list to store the last few zones and a lock for thread safety.
zone_history = []
zone_history_lock = threading.Lock()

imu_data = 0

class AdjacentZoneStateMachine:
    north = 60
    east = north + 90
    west = north + 270
    south = north + 180

    def wrap_value_in_circle(self, value):
        """
        Wraps a value to its equivalent within a circle of given size.

        :param value: The value to wrap.
        :param circle_size: The size of the circle.
        :return: The wrapped value.
        """
        return value % 360

    def __init__(self, zones, initial_zone):
        """
        Initialize the state machine.

        :param zones: A list of zones in order (e.g., ["2", "3", "4", ...]).
        :param initial_zone: The starting zone. Must be one of the zones.
        """
        if initial_zone not in zones:
            raise ValueError("Initial zone must be in the list of zones.")
        self.zones = zones
        self.current_zone = initial_zone
        self.lock = threading.RLock()  # Use a reentrant lock for thread safety

    def allowed_transition(self, next_zone):
        """
        Check if transitioning to the next_zone is allowed.
        Only adjacent zones in the list are permitted, except for the special case
        allowing transitions between '7' and '4'. Additionally, if the current zone is '7',
        transitioning to '6' is not allowed.

        :param next_zone: The zone to transition to.
        :return: True if allowed; False otherwise.
        """
        with self.lock:
            # Allow the special exception between Zone 7 and Zone 4 (both directions)
            if (self.current_zone == "7" and next_zone == "4") or \
               (self.current_zone == "4" and next_zone == "7"):
                return True

            if self.current_zone == "7" and next_zone == "6":
                return False

            try:
                currMap = transition_direction_map[self.current_zone]
                keys = currMap.keys()
                if "n" in keys and "e" in keys:
                    north_range_low = self.wrap_value_in_circle(self.north - 60)
                    north_range_high = self.wrap_value_in_circle(self.north + 60)

                    west_range_low = self.wrap_value_in_circle(self.west - 60)
                    west_range_high = self.wrap_value_in_circle(self.west + 60)

                    east_range_low = self.wrap_value_in_circle(self.south + 60)
                    east_range_high = self.wrap_value_in_circle(self.south + 60)

                    if north_range_low < imu_data < north_range_high:
                        if "n" in currMap and next_zone == currMap["n"]:
                            return True

                    if west_range_low < imu_data < west_range_high:
                        if "w" in currMap and next_zone == currMap["w"]:
                            return True

                    if east_range_low < imu_data < east_range_high:
                        if "e" in currMap and next_zone == currMap["e"]:
                            return True
                    return False

                if "n" in keys or "s" in keys:
                    north_range_low = self.wrap_value_in_circle(self.north - 90)
                    north_range_high = self.wrap_value_in_circle(self.north + 90)

                    south_range_low = self.wrap_value_in_circle(self.south + 90)
                    south_range_high = self.wrap_value_in_circle(self.south + 90)

                    if north_range_low < imu_data < north_range_high:
                        if "n" in currMap and next_zone == currMap["n"]:
                            return True

                    if south_range_low < imu_data < south_range_high:
                         if "s" in currMap and next_zone == currMap["s"]:
                            return True
                    return False

                if "w" in keys or "e" in keys:
                    west_range_low = self.wrap_value_in_circle(self.west - 90)
                    west_range_high = self.wrap_value_in_circle(self.west + 90)

                    east_range_low = self.wrap_value_in_circle(self.east + 90)
                    east_range_high = self.wrap_value_in_circle(self.east + 90)

                    if west_range_low < imu_data < west_range_high:
                        if "w" in currMap and next_zone == currMap["w"]:
                            return True

                    if east_range_low < imu_data < east_range_high:
                        if "e" in currMap and next_zone == currMap["e"]:
                            return True
                    return False

                current_index = self.zones.index(self.current_zone)
                next_index = self.zones.index(next_zone)
            except ValueError:
                return False

            # Transition is allowed only if next_zone is exactly one position away.
            return abs(next_index - current_index) == 1

    def transition(self, next_zone):
        """
        Transition to the next_zone if it's allowed.
        """
        with self.lock:
            with open("degrees.txt", "r") as f:
                global imu_data
                imu_data = float(f.read().strip())

            if self.allowed_transition(next_zone):
                # print(f"Transitioning from {self.current_zone} to {next_zone}.")
                self.current_zone = next_zone
            else:
                pass
                # print(f"Invalid transition: Cannot move from {self.current_zone} to {next_zone}.")
                # Optionally, you can raise an error or log the invalid transition.

    def forced_transition(self, next_zone):
        """
        Force a transition to the next_zone in a thread-safe manner,
        bypassing the usual allowed_transition checks.
        """
        with self.lock:
            print(f"Forced transition from {self.current_zone} to {next_zone}.")
            self.current_zone = next_zone

def capture_middle_screenshot():
    """Capture the middle portion of the primary monitor."""
    with mss.mss() as sct:
        monitor = sct.monitors[1]  # Get primary monitor dimensions
        width, height = monitor["width"], monitor["height"]

        # Define middle portion dimensions (adjust as needed)
        middle_width = width // 2
        left = (width - middle_width) // 2

        # Capture only the middle portion
        screenshot = sct.grab({"left": left, "top": 0, "width": middle_width, "height": height})

    return screenshot

def save_screenshot(screenshot, filename="screenshot.png"):
    """Save the screenshot to a PNG file."""
    mss.tools.to_png(screenshot.rgb, screenshot.size, output=filename)
    return filename

def encode_image_to_base64(image_path):
    """Encodes an image file to a base64 string."""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

def send_to_openai_zones(image_path, state_machine):
    """
    Send the image as a base64 string along with a prompt that includes the zone data.
    Based on the response, update the zone either via normal or forced transition if a matching room number is found.
    """
    global previous_zone_response

    try:
        img_b64_str = encode_image_to_base64(image_path)
        img_type = "image/png"  # Adjust accordingly if the image format differs

        # Build the prompt text including both the static zone data.
        prompt_text = (
            f"Zone Data:\n{zone_data}\n\n"
            "Be concise. Double and triple check your work. You are given zone_data which contains key landmarks in each space. "
            "Using the zone data respond with what zone you think we are in. "
            "Respond in a json format: { zone: number, room_number: number }"
        )

        client = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),  # This is the default and can be omitted
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_text},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{img_type};base64,{img_b64_str}"},
                        },
                    ],
                }
            ],
        )

        # Extract the response content
        response_content = response.choices[0].message.content

        # Remove code block markers if present.
        pattern = r"^```json\s*|```$"
        cleaned_message = re.sub(pattern, "", response_content, flags=re.MULTILINE)

        # Parse the response to extract the zone number and room number.
        parsed_response = json.loads(cleaned_message)
        new_zone = parsed_response.get("zone", None)
        room_number = parsed_response.get("room_number", None)

        print(room_number)

        old_zone = state_machine.current_zone

        # If there's a matching room number, force the transition to the mapped zone.
        if room_number is not None and str(room_number) in room_number_map:
            forced_zone = room_number_map[str(room_number)]
            print(f"Matching room found for room {room_number}. Forcing transition to zone {forced_zone}.")
            state_machine.forced_transition(forced_zone)
            new_zone = forced_zone  # update new_zone for history and logging if needed
        else:
            # Otherwise, attempt a normal transition.
            state_machine.transition(str(new_zone))

        # Update the previous zone response in a thread-safe way.
        with previous_zone_lock:
            previous_zone_response = new_zone

        # Record the new zone in the zone history.
        with zone_history_lock:
            zone_history.append(new_zone)
            if len(zone_history) > 3:
                zone_history.pop(0)  # Remove the oldest zone if more than 3 are stored

        if state_machine.current_zone != old_zone:
            print("Current Zone:", state_machine.current_zone)

    except Exception as e:
        print("Error:", e)

from transformers import CLIPProcessor, CLIPModel
from PIL import Image

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

def find_nearest_images(query_image_path, top_k=3):
    """
    Given a path to a local image, return the top K nearest images from Vespa.
    """
    # 1. Compute CLIP embedding
    image = Image.open(query_image_path)
    inputs = processor(images=image, return_tensors="pt")
    # Obtain embedding, then convert to a list (shape: [1,512] → list of 512 floats)
    embedding = model.get_image_features(**inputs).detach().numpy().tolist()[0]

    # 2. Build YQL for nearest neighbor
    #    [ {"targetHits": K} ] is an optional parameter to set how many neighbors to retrieve
    yql = 'select * from sources doc where ([{"targetHits":' + str(top_k) + '}]nearestNeighbor(embedding, q));'

    # 3. Perform the query
    query_body = {
        "yql": yql,
        "hits": top_k,
        "ranking": "image_search",
        "ranking.features.query(q)": embedding
    }

    result = app.query(body=query_body)

    # 4. Extract top hits
    hits = result.hits
    # Return the IDs (or anything else you want)
    nearest_ids = [hit["fields"]["id"] for hit in hits if "fields" in hit]
    return nearest_ids

def most_common_first_character(ids):
    """
    Given a list of IDs, return the most common first character.
    """
    from collections import Counter
    first_chars = [id[0] for id in ids if id]
    most_common_char = Counter(first_chars).most_common(1)
    return most_common_char[0][0] if most_common_char else None

def photo_shooter():
    counter = 0
    time.sleep(1)
    print("armed")
    while True:
        if keyboard.is_pressed('enter'):
            counter += 1
            print(f"Taking photo {counter}")
            screenshot = capture_middle_screenshot()
            save_screenshot(screenshot, f"{counter}zone2.png")
            time.sleep(0.1)

def location_finder_openai():
    # Instantiate the state machine once so that all threads share the same instance.
    state_machine = AdjacentZoneStateMachine(["2", "3", "4", "5", "6", "7", "8"], "2")
    #
    while True:
    #     # Capture and save one screenshot.
        screenshot = capture_middle_screenshot()
        filename = save_screenshot(screenshot)
    #
    #     # Send the screenshot to OpenAI in a separate thread.
        threading.Thread(target=send_to_openai_zones, args=(filename, state_machine,)).start()
        time.sleep(0.1)

def location_finder_vespa():
    # Instantiate the state machine once so that all threads share the same instance.
    state_machine = AdjacentZoneStateMachine(["2", "3", "4", "5", "6", "7", "8"], "2")

    # while True:
    screenshot = capture_middle_screenshot()
    filename = save_screenshot(screenshot)

    top_hits = find_nearest_images(filename, top_k=5)
    most_common_char = most_common_first_character(top_hits)
    old_zone = state_machine.current_zone
    state_machine.transition(most_common_char)
    if state_machine.current_zone != old_zone:
        with open("zone.txt", "w") as f:
            f.write(state_machine.current_zone)
        print("Current Zone:", state_machine.current_zone)

def main():
    # start_time = time.time()
    while True:
        threading.Thread(target=location_finder_vespa, args=()).start()
        time.sleep(1/100)
    # location_finder_vespa()

if __name__ == "__main__":
    main()