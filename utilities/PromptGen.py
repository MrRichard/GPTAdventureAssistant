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

    def create_setting(self, placeName, shortDescription, areaSize='small'):
        
        # Validate areaSize input
        if areaSize not in ["small", "large"]:
            raise ValueError("Unsupported area size! Choose from 'small' or 'large'.")

        # Build detailed prompt
        if areaSize == 'large':
            messages = self._generate_messages('location_overview', seed_text=shortDescription)
        elif areaSize == 'small':
            messages = self._generate_messages('discover_place', seed_text=shortDescription)

        # Query Chat Completion
        response = self._generate_GPT(messages)

        wanted_results = ["long_description", "secrets"]
        response_dict = json.loads(response)

        # Ensure required keys exist in the response
        for key in wanted_results:
            if key not in response_dict:
                raise KeyError(f"Missing key in the response: {key}")

        long_description = response_dict.get("long_description")
        secrets = response_dict.get("secrets")

        return placeName, long_description, secrets

    def _generate_messages(self, request_type, seed_text=''):
        
        if request_type not in ["location_overview", "meet_character", "discover_place", "random_encounter"]:
            raise ValueError("Unsupported request type!")

        messages = None
        if request_type == "location_overview":
            messages = [
            {"role": "system", "content": f"{self.config.get('general_system_context', '')}"},
            {"role": "user", "content": (
                f"Using the following general context of the world: {self.config.get('general_world_context', '')}, "
                f"Please describe a setting with the following details:\n\n"
                f"Short Description: {seed_text}\n"
                f"Area Size: Larger, such as a city, valley, farming village, or cavern system.\n\n"
                "Provide a long description of the place, including notable landmarks, general atmosphere, and any important features. Focus on the area and avoid mentioning surrounding areas or landmarks "
                "Additionally, describe any secrets or hidden aspects of this place that would be known only to a few or discovered through exploration.\n\n"
                "VERY IMPORTANT: Output the data as text blocks formatted as JSON with ONLY the following keys: place_name, long_description, secrets, for example: { \"long_description\": \"\",\"secrets\": \"\"}"
            )}
            ]
        elif request_type == "meet_character":
            messages = [
                {"role": "system", "content": f"{self.config.get('general_system_context','')}"},
                {"role": "user", "content": (
                    f"Using the following general context of the world: {self.config.get('general_world_context','')}, "
                    "Please describe a new NPC character in this world. This person is likely a normal person of average looks and wit, not a hero or heroic character.\n\n"
                    "Include a detailed physical description, noting any clothes or unusual items they may be carrying. All descriptions must be visible of visibile or noticeable things insider knowledge."
                    "Additionally, provide a description of their personality, tendencies, and outlook on the world.\n\n"
                    "VERY IMPORTANT: Output the data as text blocks formatted as JSON with ONLY the following keys: character_name, physical_description, personality, for example: { \"character_name\": \"\",\"physical_description\": \"\",\"personality\": \"\"}"
                )},
            ]
        elif request_type == "discover_place":
            messages = [
            {"role": "system", "content": f"{self.config.get('general_system_context', '')}"},
            {"role": "user", "content": (
                f"Using the following general context of the world: {self.config.get('general_world_context', '')}, "
                f"Please describe a setting with the following details:\n\n"
                f"Short Description: {seed_text}\n"
                f"Area Size: Smaller, such as a tavern, a shallow cave, or a grassy clearing in a forest.\n\n"
                "Provide a long description of the place, including notable landmarks, general atmosphere, and any important features. Avoid using any town or street names. Focus on the immediate scene, not the surrounding locale."
                "Additionally, describe any secrets or hidden aspects of this place that would be known only to a few or discovered through exploration.\n\n"
                "VERY IMPORTANT: Output the data as text blocks formatted as JSON with ONLY the following keys: place_name, long_description, secrets, for example: { \"long_description\": \"\",\"secrets\": \"\"}"
            )}
            ]
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
            max_tokens=600,
            top_p=1,
            frequency_penalty=0,
            presence_penalty=0,
            response_format={
                "type": "json_object"
            }
        )
        
        return response.choices[0].message.content
        