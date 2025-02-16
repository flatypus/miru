from elevenlabs import stream
from elevenlabs.client import ElevenLabs

class TextToSpeech:
    """Handles Text-to-Speech (TTS) using ElevenLabs API."""

    def __init__(self, api_key: str, voice_id: str = "JBFqnCBsd6RMkjVDRZzb", model_id: str = "eleven_multilingual_v2"):
        """
        Initialize the TTS client.

        :param api_key: ElevenLabs API key
        :param voice_id: Default voice ID
        :param model_id: TTS model ID
        """
        self.client = ElevenLabs(api_key=api_key)
        self.voice_id = voice_id
        self.model_id = model_id

    def speak(self, text: str, play_audio: bool = True):
        """
        Convert text to speech and stream it.

        :param text: The text to convert to speech
        :param play_audio: If True, play the streamed audio locally
        """
        audio_stream = self.client.text_to_speech.convert_as_stream(
            text=text,
            voice_id=self.voice_id,
            model_id=self.model_id
        )

        if play_audio:
            stream(audio_stream)
        else:
            for chunk in audio_stream:
                if isinstance(chunk, bytes):
                    print(chunk)  # Process audio bytes manually

