from flask import render_template, request, jsonify, send_from_directory
from openai_client import OpenAIClient
from file_manager import FileManager
import os

def init_routes(app):
    openai_client = OpenAIClient()
    file_manager = FileManager()

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/record', methods=['POST'])
    def record():
        audio_data = request.files['audio']
        transcription = openai_client.transcribe_audio(audio_data)
        return jsonify({'transcription': transcription})

    @app.route('/generate_image', methods=['POST'])
    def generate_image():
        text = request.json['text']
        image_url = openai_client.generate_image(text)
        return jsonify({'image_url': image_url})

    @app.route('/delete_message', methods=['POST'])
    def delete_message():
        message_id = request.json['message_id']
        file_manager.delete_message(message_id)
        return jsonify({'status': 'success'})

    @app.route('/download_log', methods=['GET'])
    def download_log():
        return send_from_directory('logs', 'log.txt', as_attachment=True)

    @app.route('/upload_map', methods=['POST'])
    def upload_map():
        map_file = request.files['map']
        file_path = file_manager.save_map(map_file)
        return jsonify({'file_path': file_path})