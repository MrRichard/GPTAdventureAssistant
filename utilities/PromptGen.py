from openai import OpenAI
import json
import os
from config import Config

class PromptGeneration:
    
    def __init__(self):
        self._load_config()
    
    def _load_config(self):
        self.config = Config()
    
    def create_npc(self):
        
        # build detailed prompt
        messages = self._generate_messages('meet_character')
        
        # Query Chat Completion
        reponse = self._generate_GPT(messages)
        
        wanted_results = ["character_name", "physical_description", "personality"]
        response_dict = json.loads(reponse)
        
        # Ensure required keys exist in the response
        for key in wanted_results:
            if key not in response_dict:
                raise KeyError(f"Missing key in the response: {key}")
        
        character_name = response_dict.get("character_name")
        description = response_dict.get("physical_description")
        personality = response_dict.get("personality")
        
        return character_name, description, personality

    def _generate_messages(self, request_type):
        if request_type not in ["city_overview", "meet_character", "discover_place", "random_encounter"]:
            raise ValueError("Unsupported request type!")

        messages = None
        if request_type == "city_overview":
            # Implement the prompt generation for city_overview
            pass
        elif request_type == "meet_character":
            messages = [
                {"role": "system", "content": f"{self.config.get('general_sytem_context','')}"},
                {"role": "user", "content": (
                    f"Using the following general context of the world: {self.config.get('general_world_context','')}, "
                    "Please describe a new NPC character in this world. This person is likely a normal person of average looks and wit, not a hero or heroic character.\n\n"
                    "Include a detailed physical description, noting any clothes or unusual items they may be carrying. All descriptions must be visible of visibile or noticeable things insider knowledge."
                    "Additionally, provide a description of their personality, tendencies, and outlook on the world.\n\n"
                    "VERY IMPORTANT: Output the data as text blocks formatted as JSON with ONLY the following keys: character_name, physical_description, personality, for example: { \"character_name\": \"\",\"physical_description\": \"\",\"personality\": \"\"}"
                )},
            ]
        elif request_type == "discover_place":
            # Implement the prompt generation for discover_place
            pass
        elif request_type == "random_encounter":
            # Implement the prompt generation for random_encounter
            pass
        
        return messages

    def _generate_GPT(self, messages):
        client = OpenAI(api_key=self.config.get('OPENAI_API_KEY'))
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=1,
            max_tokens=700,
            top_p=1,
            frequency_penalty=0,
            presence_penalty=0,
            response_format={
                "type": "json_object"
            }
        )
        
        return response.choices[0].message.content
        