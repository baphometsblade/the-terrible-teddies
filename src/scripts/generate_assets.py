import os
import random
from dotenv import load_dotenv
from openai import OpenAI
import logging
import sys
import json
import requests
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stdout)

# Load environment variables
load_dotenv()

# Initialize Supabase variables
supabase_url = os.environ.get("VITE_SUPABASE_URL")
supabase_key = os.environ.get("VITE_SUPABASE_ANON_KEY")
if not supabase_url or not supabase_key:
    error_message = "Supabase environment variables are not set"
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
    prompt = f"Create a cute and mischievous teddy bear card for 'Terrible Teddies' game. Card type: {card['type']}. Name: {card['name']}. The bear should be {random.choice(['playful', 'naughty', 'sneaky', 'adorable', 'fierce'])} and engaged in an action related to {card['type']}. Style: Vibrant cartoon on a white background. Incorporate elements from the description: {card['description']}"
    
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
            if attempt < max_retries - 1:
                time.sleep(5)  # Wait for 5 seconds before retrying
            else:
                logging.error(f"All attempts failed for card {card['name']}")
                return None

def update_card_image(card):
    image_data = generate_card_image(card)
    
    if image_data is None:
        return {"error": f"Failed to generate image for card: {card['name']}"}
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            logging.info(f"Updating card image in Supabase: {card['name']} (Attempt {attempt + 1})")
            bucket_name = "card-images"
            file_name = f"{uuid.uuid4()}.png"
            
            # Upload file to Supabase Storage
            upload_url = f"{supabase_url}/storage/v1/object/{bucket_name}/{file_name}"
            headers = {
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "image/png"
            }
            upload_response = requests.post(upload_url, headers=headers, data=image_data)
            upload_response.raise_for_status()
            
            # Get public URL
            public_url = f"{supabase_url}/storage/v1/object/public/{bucket_name}/{file_name}"
            
            # Update database record
            update_url = f"{supabase_url}/rest/v1/generated_images?id=eq.{card['id']}"
            update_headers = {
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            }
            update_data = {"url": public_url}
            update_response = requests.patch(update_url, headers=update_headers, json=update_data)
            update_response.raise_for_status()
            
            logging.info(f"Updated image for card: {card['name']}")
            return {"url": public_url, "name": card['name']}
        except requests.exceptions.RequestException as e:
            logging.error(f"Attempt {attempt + 1} failed to update card image in Supabase: {card['name']}, Error: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(5)  # Wait for 5 seconds before retrying
            else:
                logging.error(f"All attempts failed to update card image in Supabase: {card['name']}")
                return {"error": f"Failed to update card image in Supabase: {card['name']}"}

def process_cards(cards):
    total_cards = len(cards)
    print(json.dumps({"total_cards": total_cards}))
    sys.stdout.flush()
    
    processed_cards = 0
    batch_size = 5  # Process 5 cards concurrently
    
    with ThreadPoolExecutor(max_workers=batch_size) as executor:
        for i in range(0, total_cards, batch_size):
            batch = cards[i:i+batch_size]
            futures = [executor.submit(update_card_image, card) for card in batch]
            
            for future in as_completed(futures):
                result = future.result()
                processed_cards += 1
                
                if "error" in result:
                    print(json.dumps({"error": result["error"]}))
                else:
                    progress = (processed_cards / total_cards) * 100
                    print(json.dumps({
                        "progress": progress,
                        "currentImage": result["name"],
                        "url": result["url"],
                        "generatedCards": processed_cards
                    }))
                sys.stdout.flush()
            
            # Add a delay between batches to avoid rate limiting
            time.sleep(5)

def main():
    logging.info("Starting asset generation for Terrible Teddies...")
    print(json.dumps({"status": "starting"}))
    sys.stdout.flush()
    
    try:
        # Fetch all cards from the database
        fetch_url = f"{supabase_url}/rest/v1/generated_images?select=*"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}"
        }
        response = requests.get(fetch_url, headers=headers)
        response.raise_for_status()
        cards = response.json()
        
        if not cards:
            raise Exception("No cards found in the database")

        total_cards = len(cards)
        print(json.dumps({"total_cards": total_cards}))
        sys.stdout.flush()

        process_cards(cards)
    
        logging.info("Asset generation complete!")
        print(json.dumps({"completed": True, "total_generated": total_cards}))
        sys.stdout.flush()
    except requests.exceptions.RequestException as e:
        error_message = f"An error occurred during asset generation: {str(e)}"
        logging.error(error_message)
        logging.error(traceback.format_exc())
        print(json.dumps({"error": error_message, "traceback": traceback.format_exc()}))
        sys.stdout.flush()

if __name__ == "__main__":
    main()