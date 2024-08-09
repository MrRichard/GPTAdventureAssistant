from flask import render_template, request, jsonify, send_from_directory
from openai_client import OpenAIClient
from file_manager import FileManager
from werkzeug.utils import secure_filename
import os

def init_routes(app):
    openai_client = OpenAIClient()
    file_manager = FileManager()

    @app.route('/')
    def index():
        return render_template('index.html')

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

    # Configure the allowed extensions for the uploaded files
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

    def allowed_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

    @app.route('/upload_map', methods=['POST'])
    def upload_map():
        if 'map' not in request.files:
            return jsonify(success=False, error="No file part in the request"), 400

        file = request.files['map']

        if file.filename == '':
            return jsonify(success=False, error="No selected file"), 400

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join('static/images/maps/', filename))
            return jsonify(success=True, file_path=f'/static/images/maps/{filename}'), 200

        return jsonify(success=False, error="Invalid file type"), 400