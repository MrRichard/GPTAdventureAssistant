import json
import os

class Config:
    def __init__(self, config_file='config.json'):
        with open(config_file) as f:
            self.config = json.load(f)
            
        self.config['OPENAI_API_KEY'] = os.getenv('OPENAI_API_KEY')

    def get(self, key, default=None):
        return self.config.get(key, default)