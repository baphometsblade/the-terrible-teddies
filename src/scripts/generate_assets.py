import os
import random
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI
import logging
import sys
import json
import requests
import time
import traceback

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stdout)

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.environ.get("VITE_SUPABASE_PROJECT_URL")
supabase_key = os.environ.get("VITE_SUPABASE_API_KEY")
if not supabase_url or not supabase_key:
    error_message = "Supabase environment variables are not set"
    logging.error(error_message)
    print(json.dumps({"error": error_message}))
    sys.exit(1)

try:
    supabase: Client = create_client(supabase_url, supabase_key)
except Exception as e:
    error_message = f"Failed to create Supabase client: {str(e)}"
    logging.error(error_message)
    print(json.dumps({"error": error_message}))
    sys.exit(1)

# Initialize OpenAI client
openai_api_key = os.environ.get("OPENAI_API_KEY")
if not openai_api_key:
    error_message = "OPENAI_API_KEY is not set in the environment variables"
    logging.error(error_message)
    print(json.dumps({"error": error_message}))
    sys.exit(1)

try:
    openai_client = OpenAI(api_key=openai_api_key)
except Exception as e:
    error_message = f"Failed to create OpenAI client: {str(e)}"
    logging.error(error_message)
    print(json.dumps({"error": error_message}))
    sys.exit(1)

def generate_card_image(card):
    prompt = f"A cute teddy bear as a {card['type']} card for a card game called Terrible Teddies. The teddy should look {random.choice(['mischievous', 'adorable', 'fierce', 'sleepy', 'excited'])} and be doing an action related to its type. Cartoon style, vibrant colors, white background. The card name is {card['name']}. The teddy bear should represent: {card['description']}"
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            logging.info(f"Generating image for card: {card['name']} (Attempt {attempt + 1})")
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
            logging.error(f"Attempt {attempt + 1} failed for card {card['name']}: {str(e)}")
            logging.error(traceback.format_exc())
            if attempt < max_retries - 1:
                time.sleep(5)  # Wait for 5 seconds before retrying
            else:
                logging.error(f"All attempts failed for card {card['name']}")
                return None

def update_card_image(card):
    image_data = generate_card_image(card)
    
    if image_data is None:
        error_message = f"Failed to generate image for card: {card['name']}"
        logging.error(error_message)
        print(json.dumps({"error": error_message}))
        return None
    
    try:
        logging.info(f"Updating card image in Supabase: {card['name']}")
        storage_path = f"card_images/{card['name'].replace(' ', '_')}.png"
        storage_response = supabase.storage.from_("card-images").upload(storage_path, image_data, {"content-type": "image/png"})
        
        if isinstance(storage_response, dict) and 'error' in storage_response:
            raise Exception(f"Failed to upload image to storage: {storage_response['error']}")
        
        public_url = supabase.storage.from_("card-images").get_public_url(storage_path)
        
        update_response = supabase.table("generated_images").update({"url": public_url}).eq("name", card['name']).execute()
        
        if hasattr(update_response, 'error') and update_response.error:
            raise Exception(f"Failed to update database: {update_response.error}")
        
        logging.info(f"Updated image for card: {card['name']}")
        return update_response.data
    except Exception as e:
        error_message = f"Failed to update card image in Supabase: {card['name']}, Error: {str(e)}"
        logging.error(error_message)
        logging.error(traceback.format_exc())
        print(json.dumps({"error": error_message}))
        return None

def process_cards(cards):
    total_cards = len(cards)
    print(json.dumps({"total_cards": total_cards}))
    sys.stdout.flush()
    
    for index, card in enumerate(cards):
        result = update_card_image(card)
        
        if result:
            progress = ((index + 1) / total_cards) * 100
            print(json.dumps({
                "progress": progress,
                "currentImage": card['name'],
                "url": result[0]['url'] if result and len(result) > 0 else None,
                "generatedCards": index + 1
            }))
            sys.stdout.flush()
        else:
            print(json.dumps({"error": f"Failed to update image for {card['name']}"}))
            sys.stdout.flush()
        
        # Add a delay between processing each card to avoid rate limiting
        time.sleep(2)

def main():
    logging.info("Starting asset generation for Terrible Teddies...")
    print(json.dumps({"status": "starting"}))
    sys.stdout.flush()
    
    try:
        # Fetch all cards from the database
        response = supabase.table("generated_images").select("*").execute()
        if hasattr(response, 'error') and response.error:
            raise Exception(f"Failed to fetch cards from database: {response.error}")
        
        cards = response.data
        if not cards:
            raise Exception("No cards found in the database")

        total_cards = len(cards)
        print(json.dumps({"total_cards": total_cards}))
        sys.stdout.flush()

        process_cards(cards)
    
        logging.info("Asset generation complete!")
        print(json.dumps({"completed": True, "total_generated": total_cards}))
        sys.stdout.flush()
    except Exception as e:
        error_message = f"An error occurred during asset generation: {str(e)}"
        logging.error(error_message)
        logging.error(traceback.format_exc())
        print(json.dumps({"error": error_message, "traceback": traceback.format_exc()}))
        sys.stdout.flush()

if __name__ == "__main__":
    main()