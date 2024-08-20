import os
import base64
import requests
from supabase import create_client, Client
import random
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase: Client = create_client(os.environ.get("VITE_SUPABASE_PROJECT_URL"), os.environ.get("VITE_SUPABASE_API_KEY"))

CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost']
OPENAI_API_URL = "https://api.openai.com/v1/images/generations"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

def ensure_energy_cost_column():
    try:
        # Use RPC to execute SQL command
        result = supabase.rpc('add_energy_cost_column').execute()
        if result.get('error'):
            logging.error(f"Error adding 'energy_cost' column: {result['error']}")
        else:
            logging.info("'energy_cost' column added successfully or already exists")
    except Exception as e:
        logging.error(f"Error ensuring 'energy_cost' column: {str(e)}")
        raise

def generate_card_image(card_type, name):
    prompt = f"A cute teddy bear as a {card_type} card for a card game called Terrible Teddies. The teddy should look {random.choice(['mischievous', 'adorable', 'fierce', 'sleepy', 'excited'])} and be doing an action related to its type. Cartoon style, vibrant colors, white background. The card name is {name}."
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    data = {
        "prompt": prompt,
        "n": 1,
        "size": "512x512",
        "response_format": "b64_json"
    }
    
    try:
        response = requests.post(OPENAI_API_URL, headers=headers, json=data)
        response.raise_for_status()
        image_data = response.json()['data'][0]['b64_json']
        return f"data:image/png;base64,{image_data}"
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to generate image: {str(e)}")
        return None

def generate_and_store_card(name, type, energy_cost):
    image_data = generate_card_image(type, name)
    
    if image_data is None:
        logging.error(f"Failed to generate image for card: {name}")
        return None
    
    card_data = {
        "name": name,
        "type": type,
        "energy_cost": energy_cost,
        "url": image_data,
        "prompt": f"A {type} card for Terrible Teddies named {name}"
    }
    
    try:
        result = supabase.table("generated_images").insert(card_data).execute()
        logging.info(f"Generated and stored card: {name}")
        return result
    except Exception as e:
        logging.error(f"Failed to store card in Supabase: {str(e)}")
        return None

def main():
    logging.info("Starting asset generation for Terrible Teddies...")
    
    if not OPENAI_API_KEY:
        logging.error("OPENAI_API_KEY is not set in the environment variables")
        return
    
    try:
        ensure_energy_cost_column()
    except Exception as e:
        logging.error(f"Failed to ensure 'energy_cost' column: {str(e)}")
        return
    
    for card_type in CARD_TYPES:
        for i in range(8):  # Generate 8 cards of each type
            name = f"{card_type} Teddy {i+1}"
            energy_cost = random.randint(1, 5)
            result = generate_and_store_card(name, card_type, energy_cost)
            if result is None:
                logging.warning(f"Failed to generate or store card: {name}")
    
    logging.info("Asset generation complete!")

if __name__ == "__main__":
    main()