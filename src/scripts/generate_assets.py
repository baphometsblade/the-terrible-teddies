import os
from dotenv import load_dotenv
from openai import OpenAI
import random
import requests
import json
import sys
import logging

# Load environment variables and set up logging
load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Supabase configuration
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost']

def generate_card_image(prompt):
    try:
        response = openai_client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        return response.data[0].url
    except Exception as e:
        logging.error(f"Error generating image: {str(e)}")
        return None

def generate_and_store_card(name, type, energy_cost):
    prompt = f"A cute teddy bear as a {type} card for a card game called Terrible Teddies. The teddy should look {random.choice(['mischievous', 'adorable', 'fierce', 'sleepy', 'excited'])} and be doing an action related to its type. Cartoon style, vibrant colors, white background."
    image_url = generate_card_image(prompt)
    
    if not image_url:
        return None

    card_data = {
        "name": name,
        "type": type,
        "energy_cost": energy_cost,
        "url": image_url,
        "prompt": prompt
    }
    
    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/generated_images",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            json=card_data
        )
        response.raise_for_status()
        logging.info(f"Generated and stored card: {name}")
        return card_data
    except requests.exceptions.RequestException as e:
        logging.error(f"Error storing card data: {str(e)}")
        return None

def main():
    logging.info("Starting asset generation for Terrible Teddies...")
    
    total_cards = len(CARD_TYPES) * 8
    generated_cards = 0

    print(json.dumps({"total_cards": total_cards}))
    sys.stdout.flush()

    for card_type in CARD_TYPES:
        for i in range(8):
            name = f"{card_type} Teddy {i+1}"
            energy_cost = random.randint(1, 5)
            result = generate_and_store_card(name, card_type, energy_cost)
            
            if result:
                generated_cards += 1
                progress = (generated_cards / total_cards) * 100
                print(json.dumps({
                    "progress": progress,
                    "currentImage": name,
                    "url": result["url"]
                }))
                sys.stdout.flush()
            else:
                logging.error(f"Failed to generate or store {name}")
    
    print(json.dumps({"completed": True, "total_generated": generated_cards}))
    sys.stdout.flush()
    logging.info("Asset generation complete!")

if __name__ == "__main__":
    main()