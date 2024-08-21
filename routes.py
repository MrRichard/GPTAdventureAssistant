from flask import render_template, request, jsonify, send_from_directory
from openai import OpenAI
from werkzeug.utils import secure_filename
import os
import pathlib
from urllib.request import urlretrieve
import random
import string
import json
from datetime import datetime
from utilities.PromptGen import PromptGeneration

def init_routes(app):
    
    @app.route('/api_key_confirm', methods=['GET'])
    def api_key_confirm():
        
        api_key = app.config['OPENAI_API_KEY']
        
        if not api_key:
            return jsonify({'error': 'API key is missing or empty'}), 400

        # Try to initialize the OpenAI client
        try:
            client = OpenAI(api_key=api_key)
            client.close()
            return jsonify({'message': 'API key is valid'}), 200
        except Exception as e:
            return jsonify({'error': f'Failed to validate API key: {str(e)}'}), 400
        
    @app.route('/add_new_api_key', methods=['POST'])
    def add_new_api_key():
        try:
            data = request.get_json()
            api_key = data.get('api_key')
            app.config['OPENAI_API_KEY'] = api_key
            return jsonify({'success': True})

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
        

    @app.route('/')
    def render_page():
        return render_template('index.html')

    @app.route('/upload_map', methods=['POST'])
    def upload_map():
        
        # define this function in the scope fo this route
        ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
        def allowed_file(filename):
            return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
        
        
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
        ##print(f"Deleting {filename}")

        if not filename.endswith('.wav'):
            return jsonify({'error': 'Invalid file format'}), 400

        if os.path.exists(filename):
            os.remove(filename)
            return jsonify({'message': 'File deleted successfully'}), 200
        else:
            return jsonify({'error': 'File does not exist'}), 404

    @app.route('/transcribe', methods=['POST'])
    def transcript_audio_GPT():

        try:
            # Retrieve the file from the request using the key 'file'
            file = request.form['audio']
            #print(f"reading file: {file}")

            # Check if the filename is empty and raise an error if it is
            if file == '':
                raise ValueError("No selected file")

        except Exception as e:
            return jsonify({'error': str(e)}), 400

        client = OpenAI(api_key = app.config['OPENAI_API_KEY'])
        audio_file = open(file, "rb")

        try:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="json"
            )
        except e:
            #("failing")
            return jsonify({'error': str(e)}), 500

        client=''
        return jsonify({'text': transcription.text})
        
    @app.route('/generate_image', methods=['POST'])
    def generate_image_GPT():
        
        try:
            # Retrieve the file from the request using the key 'file'
            transcription = request.form['text']

            # Check if the filename is empty and raise an error if it is
            if transcription == '':
                raise ValueError("No selected file")

        except Exception as e:
            return jsonify({'error': str(e)}), 400
        
        client = OpenAI(api_key = app.config['OPENAI_API_KEY'])
        
        image_prompt = generate_prompt(app.config['image_context'], app.config['image_style'], transcription)

        response = client.images.generate(
            model="dall-e-3",
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
                f"Style [IMPORTANT]: {image_style}\n"
                f"Please take into account the Context and Style and render for this scene, character, or place: {transcription}."
                )

        return prompt
    
    @app.route('/oracle', methods=['GET'])
    def oracle():
        
        def ask_oracle():
            roll = random.randint(1, 6)
            responses = {
                1: "No, and",
                2: "No",
                3: "No, but",
                4: "Yes, but",
                5: "Yes",
                6: "Yes, and"
            }
            result = responses[roll]
            return result
        
        # Return response via Json to dialogue box
        try:
            reply = ask_oracle()
            return jsonify({'response': reply}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 400
        
    LOG_FILE_PATH = app.config['LOG_FILE']
    @app.route('/save_session', methods=['POST'])
    def save_session():
        print(f"Saving to {LOG_FILE_PATH}")
        data = request.json
        with open(LOG_FILE_PATH, 'w') as log_file:
            json.dump(data, log_file)
        return jsonify({'success': True})
    
    @app.route('/load_session', methods=['GET'])
    def load_session():
        if os.path.exists(LOG_FILE_PATH):
            with open(LOG_FILE_PATH, 'r') as log_file:
                data = json.load(log_file)
            return jsonify({'success': True, 'data': data})
        return jsonify({'success': False})

    @app.route('/archive_session', methods=['POST'])
    def archive_session():
        if os.path.exists(LOG_FILE_PATH):
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            
            # sorry I did it this way
            os.rename(
                LOG_FILE_PATH, 
                os.path.join(
                    os.path.dirname(LOG_FILE_PATH), 
                    f'archive_{timestamp}.json')
            )
        return jsonify({'success': True})
        
    @app.route('/character_generate', methods=['GET'])
    def character_generate():
        
        try:
            # Assuming your PromptGeneration class uses the structure below
            prompt_gen = PromptGeneration()
            character_name,physical_description,personality = prompt_gen.create_npc()
            print(f"Creating {character_name}")
            
            return jsonify({
                'physical_description': physical_description,
                'personality': personality
            }), 200

        except ValueError as ve:
            return jsonify({'error': str(ve)}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        
    @app.route('/generate_location', methods=['POST'])
    def generate_location():
        
        data=request.json
        
        try: 
            placeName = data['placeName']
            shortDescription = data['shortDescription']
            areaSize = data['areaSize']
            prompt_gen = PromptGeneration()
            print(data)
            placeName, longDescription, secrets = prompt_gen.create_setting(placeName, shortDescription, areaSize)
            
            return jsonify({
                'placeName': placeName,
                'longDescription': longDescription,
                'secrets' : secrets
            }), 200

        except ValueError as ve:
            return jsonify({'error': str(ve)}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 500