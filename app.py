from flask import Flask
from flask_cors import CORS, cross_origin
from routes import init_routes
from config import Config

app = Flask(__name__)

# Load the configuration from config.json using Config class
config = Config()

# Update Flask app's configuration from the config object
for key, value in config.config.items():
    app.config[key] = value

CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5000", "https://api.openai.com"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

init_routes(app)

if __name__ == '__main__':
    app.run(debug=True)