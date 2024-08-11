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
            print(app.config['OPENAI_API_KEY'])
            return jsonify({'success': True})

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
        

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
        ##print(f"Deleting {filename}")

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
    def generate_image():
        
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
        #print(image_prompt)
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
                f"Please take into account the Context and Style and render for this scene: {transcription}."
                )

        return prompt
    
    def ask_oracle(transcription, context):
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
        context = (
            "You are the story telling oracle. Mysterious and brief."
            "When players come to you with a question, you roll the dice and give them a short answer that is often open for intepretation."
            "Your responses are always guided by the roll of the dice. If you are not asked a question is unclear, politely refuse to respond to that question."
            f"ALWAYS Include the dice roll of {roll} and use the response format \"{result}\" to guide your reponse. Limit responses to 5 lines max."
            "IMPORTANT: It's important not give information that is not immediately observable, or give a reason why this information is known."
            "Try to respond in the context of the story."
        )
        
        prompt = (f"Answer based on the results of the oracle roll: {result}:\n"
                  f"Answer this question: {transcription}"
                  f"Take into account all recent messages (if any) included below:\n {context}"
                  )
        return context, prompt
    
    @app.route('/oracle', methods=['POST'])
    def oracle():
        try:
            data = request.get_json()
            transcription = data.get('text')
            context = data.get('context')
            
            if not transcription:
                raise ValueError("No transcription provided")
            
            context, prompt = ask_oracle(transcription, context)
            
            client = OpenAI(api_key=app.config['OPENAI_API_KEY'])
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role" : "system", "content" : context},
                    {"role" : "user", "content" : prompt}
                ]
            )
            reply = response.choices[0].message.content
            print(reply)
            
            return jsonify({'response': reply}), 200
        
        except Exception as e:
            return jsonify({'error': str(e)}), 400