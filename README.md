# AI Adventure Assistant

This is a simple Flask learning project. It leverages OpenAI's API services to enhance user interaction with voice and text commands.

## Features

- **Create Notes**: Using voice or text input.
- **Convert Notes to Images**: Using OpenAI's DALL-E.
- **Display Content**: Show maps or image files.
- **Log Management**: Save and manage your log files.
- **Sample Image**: An example image can be found in `static/images/sample_image.png`.

## Prerequisites

- A valid OpenAI API Key.
- Protip: On *nix machines, you can `export OPENAI_API_KEY=<your_key_here>` and avoid the warning message entirely.

## Installation and Running

1. Clone the repository:
    ```bash
    git clone https://github.com/MrRichard/GPTAdventureAssistant.git
    ```
2. Navigate to the project directory:
    ```bash
    cd <project_directory>
    ```
3. Install the required packages:
    ```bash
    pip install -r requirements.txt
    ```
4. Run the project:
    ```bash
    python serve.py
    ```

## Creating a Docker Container

1. Clone the repository:
    ```bash
    git clone https://github.com/MrRichard/GPTAdventureAssistant.git
    ```
2. Navigate to the project directory:
    ```bash
    cd <project_directory>
    ```
3. Build the Docker image:
    ```bash
    docker build -t <your_tag_here> .
    ```
4. Run the Docker container:
    ```bash
    docker run -e OPENAI_API_KEY=<your_key> -p 5000:5000 <your_tag_here>
    ```

## Sample Image

Below is a sample image used in this project:

![Sample Image](static/images/sample_image.png)
The sample image (left) is created by DALL-E.
The sample map (right) was created by Watabou. More maps can be generated using amazing procedural map generation tools available at [itch.io](https://watabou.itch.io/).


---

## How to customize
To customize the prompts, you can adjust the `config.json` file.
The CHARACTERS_FOLDERS and PLACES_FOLDERS will save details about people and places for future use in other prompts.
```json
{
    "image_context" : "Fantasy artwork for an old-school, first-edition, table-top role playing game",
    "image_style": "black and white line contour illustration with warm paper background. the images should always be good representations with lots of details and nuance. No text.",
    "image_size": "1024x1024",
    "default_font": "Arial",
    "UPLOAD_FOLDER" : "tmp_recordings",
    "LOG_STORAGE" : "story_logs",
    "customizations" : {
        "CHARACTERS_FOLDER" : ".characters",
        "PLACES_FOLDER" : ".places"
    }
}
```