import os
import random
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI
import logging
import sys
import json
import requests

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stdout)

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.environ.get("VITE_SUPABASE_PROJECT_URL")
supabase_key = os.environ.get("VITE_SUPABASE_API_KEY")
if not supabase_url or not supabase_key:
    logging.error("Supabase environment variables are not set")
    raise ValueError("Supabase environment variables are not set")

supabase: Client = create_client(supabase_url, supabase_key)

# Initialize OpenAI client
openai_api_key = os.environ.get("OPENAI_API_KEY")
if not openai_api_key:
    logging.error("OPENAI_API_KEY is not set in the environment variables")
    raise ValueError("OPENAI_API_KEY is not set in the environment variables")

openai_client = OpenAI(api_key=openai_api_key)

def generate_card_image(card):
    prompt = f"A cute teddy bear as a {card['type']} card for a card game called Terrible Teddies. The teddy should look {random.choice(['mischievous', 'adorable', 'fierce', 'sleepy', 'excited'])} and be doing an action related to its type. Cartoon style, vibrant colors, white background. The card name is {card['name']}. The teddy bear should represent: {card['description']}"
    
    try:
        logging.info(f"Generating image for card: {card['name']}")
        response = openai_client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        image_url = response.data[0].url
        logging.info(f"Image generated successfully for card: {card['name']}")
        image_response = requests.get(image_url)
        image_response.raise_for_status()
        return image_response.content
    except Exception as e:
        logging.error(f"Failed to generate image for card {card['name']}: {str(e)}")
        return None

def update_card_image(card):
    image_data = generate_card_image(card)
    
    if image_data is None:
        logging.error(f"Failed to generate image for card: {card['name']}")
        return None
    
    try:
        logging.info(f"Updating card image in Supabase: {card['name']}")
        storage_path = f"card_images/{card['name'].replace(' ', '_')}.png"
        storage_response = supabase.storage.from_("card-images").upload(storage_path, image_data, {"content-type": "image/png"})
        
        if storage_response.get('error'):
            raise Exception(f"Failed to upload image to storage: {storage_response['error']}")
        
        public_url = supabase.storage.from_("card-images").get_public_url(storage_path)
        
        update_response = supabase.table("generated_images").update({"url": public_url}).eq("name", card['name']).execute()
        
        if update_response.get('error'):
            raise Exception(f"Failed to update database: {update_response['error']}")
        
        logging.info(f"Updated image for card: {card['name']}")
        return update_response.data
    except Exception as e:
        logging.error(f"Failed to update card image in Supabase: {card['name']}, Error: {str(e)}")
        return None

def process_cards(cards):
    total_cards = len(cards)
    for index, card in enumerate(cards):
        result = update_card_image(card)
        
        if result:
            progress = ((index + 1) / total_cards) * 100
            print(json.dumps({"progress": progress, "currentImage": card['name'], "url": result[0]['url']}))
            sys.stdout.flush()
        else:
            print(json.dumps({"error": f"Failed to update image for {card['name']}"}))
            sys.stdout.flush()

def main():
    logging.info("Starting asset generation for Terrible Teddies...")
    
    try:
        # Fetch all cards from the database
        response = supabase.table("generated_images").select("*").execute()
        if response.get('error'):
            raise Exception(f"Failed to fetch cards from database: {response['error']}")
        
        cards = response.data
        if not cards:
            raise Exception("No cards found in the database")

        process_cards(cards)
    
        logging.info("Asset generation complete!")
    except Exception as e:
        logging.error(f"An error occurred during asset generation: {str(e)}")
        print(json.dumps({"error": str(e)}))
        sys.stdout.flush()

if __name__ == "__main__":
    main()