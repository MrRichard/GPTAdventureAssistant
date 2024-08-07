import os
import shutil

class FileManager:
    def __init__(self):
        self.log_dir = 'logs'
        self.image_dir = 'images'
        self.map_dir = os.path.join(self.image_dir, 'maps')
        os.makedirs(self.log_dir, exist_ok=True)
        os.makedirs(self.image_dir, exist_ok=True)
        os.makedirs(self.map_dir, exist_ok=True)

    def save_map(self, map_file):
        file_path = os.path.join(self.map_dir, map_file.filename)
        map_file.save(file_path)
        return file_path

    def delete_message(self, message_id):
        log_file = os.path.join(self.log_dir, 'log.txt')
        with open(log_file, 'r') as f:
            lines = f.readlines()
        with open(log_file, 'w') as f:
            for line in lines:
                if message_id not in line:
                    f.write(line)