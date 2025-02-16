import threading
import queue
import pyaudio
import torch
import torchaudio
import numpy as np
from tts import TextToSpeech
from stt import SpeechRecognizer

# Set up API key for ElevenLabs TTS
with open("api_keys.txt", "r") as f:
    api_key = f.read().strip()

# Initialize TTS and STT
tts_engine = TextToSpeech(api_key)
speech_recognizer = SpeechRecognizer()

# Example directional commands
commands = [
    "Go forward.",
    "Turn left.",
    "Turn right.",
    "Go backward.",
    "Jason, please turn to your right."
]

# Speak each command
for command in commands:
    tts_engine.speak(command)

# Start listening for user speech
from stt import SpeechRecognizer

recognizer = SpeechRecognizer()

print("Say something...")

text = recognizer.listen_once()

print(f"User said: {text}")

recognizer.stop()

