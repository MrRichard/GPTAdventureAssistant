import openai
import os
from config import Config

class OpenAIClient:
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        openai.api_key = self.api_key
        self.config = Config()

    def transcribe_audio(self, audio_data):
        response = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_data
        )
        return response['text']

    def generate_image(self, text):
        prompt = f"{text} {self.config.get('image_style', '')}"
        response = openai.Image.create(
            prompt=prompt,
            n=1,
            size=self.config.get('image_size', '512x512')
        )
        return response['data'][0]['url']