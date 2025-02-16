import time
import os
import json
from groq import Groq
from stt import SpeechRecognizer
from tts import TextToSpeech
from tools import find_destination

# Load API keys
with open("api_keys.txt", "r") as f:
    keys = {line.split('=')[0].strip(): line.split('=')[1].strip() for line in f.readlines()}

groq_api_key = keys.get("GROQ_API_KEY")
elevenlabs_api_key = keys.get("ELEVENLABS_API_KEY")

# Load system prompt template
with open("system_prompt.txt", "r") as f:
    system_prompt_template = f.read().strip()

# Load locations
with open("locations.json", "r") as f:
    locations = json.load(f)["locations"]

# Debugging flag
DEBUG_MODE = True

# Initialize variables
current_location = "Terman Library"  # Example default location
destination = None

# Initialize Groq client
client = Groq(api_key=groq_api_key)

# Initialize STT and TTS
recognizer = SpeechRecognizer(api_key=groq_api_key)
tts_engine = TextToSpeech(api_key=elevenlabs_api_key)


def log_debug(message):
    """Print debug messages if DEBUG_MODE is enabled."""
    if DEBUG_MODE:
        print(f"[DEBUG] {message}")


def format_system_prompt():
    """Format the system prompt with the current location and destination."""
    dest_text = destination if destination else "still asking user for destination"
    formatted_prompt = system_prompt_template.format(current_location, dest_text)
    log_debug(f"Formatted System Prompt:\n{formatted_prompt}")
    return formatted_prompt


def chat_loop():
    """Main loop for continuous voice interaction."""
    global destination

    system_prompt = format_system_prompt()
    conversation_history = [
        {"role": "system", "content": system_prompt},
        {"role": "assistant", "content": "Hey Michael! Where do you want to go?"}

    tts_engine.speak("Hey Michael! Where do you want to go?")

    while True:
        print("Listening for user input...")
        user_text = recognizer.listen_once()
        if not user_text:
            continue

        log_debug(f"User said: {user_text}")
        conversation_history.append({"role": "user", "content": user_text})

        # Check for destination
        if destination is None:
            detected_destination = find_destination(user_text)
            if detected_destination:
                destination = detected_destination
                log_debug(f"Destination set to: {destination}")
                system_prompt = format_system_prompt()
                conversation_history[0] = {"role": "system", "content": system_prompt}

                # Speak fixed messages
                tts_engine.speak("Alright, can you look around for a few seconds so I can get a sense of our location?")
                time.sleep(2.5)
                tts_engine.speak("I think I've found the location. I've sent the instructions to your belt.")

                continue  # Go back to listening

        log_debug(f"Current Location: {current_location}")
        log_debug(f"Destination: {destination if destination else 'None'}")

        # Get AI response
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=conversation_history,
            temperature=1,
            max_completion_tokens=1024,
            top_p=1,
            stream=False
        )

        ai_response = completion.choices[0].message.content.strip()
        log_debug(f"AI Response: {ai_response}")

        conversation_history.append({"role": "assistant", "content": ai_response})

        # Convert AI response to speech
        tts_engine.speak(ai_response)


if __name__ == "__main__":
    chat_loop()
