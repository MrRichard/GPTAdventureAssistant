from flask import render_template, request, jsonify, send_from_directory
from openai import OpenAI
#from file_manager import FileManager
from werkzeug.utils import secure_filename
import os
import pathlib
from urllib.request import urlretrieve
import random
import string

def init_routes(app):

    @app.route('/')
    def index():
        return render_template('index.html')

    # mark this for deprications
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
    
    @app.route('/save_audio', methods=['POST'])
    def save_audio():
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio part in the request'}), 400

        file = request.files['audio']

        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        filename = secure_filename(file.filename)

        # Ensure the filename has a .wav extension
        if not filename.endswith('.wav'):
            filename += '.wav'

        # Create the UPLOAD_FOLDER if it does not exist
        pathlib.Path(app.config['UPLOAD_FOLDER']).mkdir(parents=True, exist_ok=True)
        
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        return jsonify({'file_path': file_path}), 200

    @app.route('/delete_audio', methods=['POST'])
    def delete_audio():
        filename = request.form['file_path']
        print(f"Deleting {filename}")

        if not filename.endswith('.wav'):
            return jsonify({'error': 'Invalid file format'}), 400

        if os.path.exists(filename):
            os.remove(filename)
            return jsonify({'message': 'File deleted successfully'}), 200
        else:
            return jsonify({'error': 'File does not exist'}), 404

    @app.route('/proxy_openai', methods=['POST'])
    def proxy_openai():

        try:
            # Retrieve the file from the request using the key 'file'
            file = request.form['audio']
            print(f"reading file: {file}")

            # Check if the filename is empty and raise an error if it is
            if file == '':
                raise ValueError("No selected file")

        except Exception as e:
            return jsonify({'error': str(e)}), 400

        api_key =  os.getenv('OPENAI_API_KEY', '')  
        client = OpenAI(api_key = api_key)
        audio_file = open(file, "rb")

        try:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="json"
            )
        except e:
            print("failing")
            return jsonify({'error': str(e)}), 500

        client=''
        return jsonify({'text': transcription.text})
    @app.route('/generate_image', methods=['POST'])
    def generate_image():
        
        try:
            # Retrieve the file from the request using the key 'file'
            transcription = request.form['text']

            # Check if the filename is empty and raise an error if it is
            if transcription == '':
                raise ValueError("No selected file")

        except Exception as e:
            return jsonify({'error': str(e)}), 400
        
        api_key =  os.getenv('OPENAI_API_KEY', '')  
        client = OpenAI(api_key = api_key)
        
        image_prompt = generate_prompt(app.config['image_context'], app.config['image_style'], transcription)
        print(image_prompt)
        response = client.images.generate(
            model="dall-e-2",
            prompt=image_prompt,
            size=app.config['image_size'],
            quality="standard",
            n=1,
        )
        
        # Generate a random filename
        random_filename = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10)) + '.png'

        # Define local file path
        local_file_path = os.path.join('static', 'images', random_filename)

        # Create the directory if it does not exist
        pathlib.Path(os.path.dirname(local_file_path)).mkdir(parents=True, exist_ok=True)

        # Download the image and save it to the local file path
        image_object = response.data
        image_url = image_object[0].url
        urlretrieve(image_url, local_file_path)

        # Return the local file path
        return jsonify({'image_path': local_file_path}), 200
    
    def generate_prompt(image_context, image_style, transcription):
        prompt = (f"We are requesting a small accent image.\n\n"
                f"Context: {image_context}\n"
                f"Style: {image_style}\n"
                f"Subject matter: {transcription}"
                )

        return prompt