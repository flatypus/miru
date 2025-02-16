import os
import queue
import time
import torch
import torchaudio
import pyaudio
import numpy as np
import wave
from groq import Groq
from silero_vad import load_silero_vad


class SpeechRecognizer:
    """Modular Speech Recognition using Silero VAD & Groq Whisper."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = Groq(api_key=self.api_key)

        self.audio_queue = queue.Queue()
        self.running = True
        self.pyaudio_instance = pyaudio.PyAudio()

        # Load Silero VAD model
        self.model = load_silero_vad()
        self.device = torch.device("cpu")  # Run on CPU
        self.model.to(self.device)

        # PyAudio settings
        self.FORMAT = pyaudio.paInt16
        self.CHANNELS = 1
        self.RATE = 16000  # Silero VAD requires 16kHz
        self.CHUNK = 512  # Silero VAD only supports 512 for 16kHz

        # Set up PyAudio input stream
        self.stream = self.pyaudio_instance.open(
            format=self.FORMAT,
            channels=self.CHANNELS,
            rate=self.RATE,
            input=True,
            frames_per_buffer=self.CHUNK,
            stream_callback=self.audio_callback
        )

    def audio_callback(self, in_data, frame_count, time_info, status):
        """Callback function to receive and queue audio chunks."""
        self.audio_queue.put(in_data)
        return (in_data, pyaudio.paContinue)

    def save_audio(self, filename, audio_data):
        """Save recorded audio to a .m4a file for transcription."""
        with wave.open(filename, "wb") as wf:
            wf.setnchannels(self.CHANNELS)
            wf.setsampwidth(self.pyaudio_instance.get_sample_size(self.FORMAT))
            wf.setframerate(self.RATE)
            wf.writeframes(b''.join(audio_data))

    def transcribe_audio(self, filename):
        """Send recorded audio file to Groq Whisper for transcription."""
        with open(filename, "rb") as file:
            transcription = self.client.audio.transcriptions.create(
                file=(filename, file.read()),
                model="whisper-large-v3-turbo",
                response_format="verbose_json",
            )
        return transcription.text

    def listen_once(self):
        """
        Waits until speech is detected, records until silence,
        ensures at least 1s of recording, then transcribes and returns text.
        """
        audio_buffer = []
        speech_detected = False
        silence_start = None
        start_time = None  # Track total recording duration

        while self.running:
            in_data = self.audio_queue.get()
            audio_chunk = np.frombuffer(in_data, dtype=np.int16)
            audio_tensor = torch.from_numpy(audio_chunk).float() / 32768.0  # Normalize audio
            audio_tensor = audio_tensor.unsqueeze(0).to(self.device)

            # Compute VAD probability
            with torch.no_grad():
                vad_prob = self.model(audio_tensor, sr=16000).item()

            if vad_prob > 0.5:
                if not speech_detected:
                    speech_detected = True
                    audio_buffer = []  # Reset buffer
                    silence_start = None  # Reset silence timer
                    start_time = time.time()  # Start recording time

                audio_buffer.append(in_data)  # Collect audio data

            elif speech_detected:  # If silence starts
                if silence_start is None:
                    silence_start = time.time()  # Start silence timer

                elif time.time() - silence_start > 0.75:  # 0.75s of silence
                    duration = time.time() - start_time  # Total recording duration

                    if duration >= 1.0:  # Ensure at least 1s recording
                        filename = os.path.dirname(__file__) + "/audio.m4a"
                        self.save_audio(filename, audio_buffer)
                        return self.transcribe_audio(filename)
                    else:
                        # Ignore short recordings, reset
                        speech_detected = False
                        audio_buffer = []
                        silence_start = None

    def stop(self):
        """Stop listening and close the stream."""
        self.running = False
        self.stream.stop_stream()
        self.stream.close()
        self.pyaudio_instance.terminate()
