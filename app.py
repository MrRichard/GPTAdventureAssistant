from flask import Flask, jsonify, request
import requests
import pathlib
from flask_cors import CORS, cross_origin
from routes import init_routes
import os
from werkzeug.utils import secure_filename
from openai import OpenAI

app = Flask(__name__)
UPLOAD_FOLDER = 'tmp_recordings'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5000", "https://api.openai.com"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

init_routes(app)

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

if __name__ == '__main__':
    app.run(debug=True)