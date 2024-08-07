import json

class Config:
    def __init__(self, config_file='config.json'):
        with open(config_file) as f:
            self.config = json.load(f)

    def get(self, key, default=None):
        return self.config.get(key, default)