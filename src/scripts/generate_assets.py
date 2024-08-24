import os
import base64
import requests
from supabase import create_client, Client
import random
from dotenv import load_dotenv
import logging
from openai import OpenAI
import asyncio
import aiohttp
import sys

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

async def generate_card_image(card):
    prompt = f"A cute teddy bear as a {card['type']} card for a card game called Terrible Teddies. The teddy should look {random.choice(['mischievous', 'adorable', 'fierce', 'sleepy', 'excited'])} and be doing an action related to its type. Cartoon style, vibrant colors, white background. The card name is {card['name']}. The teddy bear should represent: {card['description']}"
    
    try:
        logging.info(f"Generating image for card: {card['name']}")
        response = await openai_client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        image_url = response.data[0].url
        logging.info(f"Image generated successfully for card: {card['name']}")
        async with aiohttp.ClientSession() as session:
            async with session.get(image_url) as image_response:
                image_response.raise_for_status()
                image_data = await image_response.read()
        return image_data
    except Exception as e:
        logging.error(f"Failed to generate image for card {card['name']}: {str(e)}")
        return None

async def update_card_image(card):
    image_data = await generate_card_image(card)
    
    if image_data is None:
        logging.error(f"Failed to generate image for card: {card['name']}")
        return None
    
    try:
        logging.info(f"Updating card image in Supabase: {card['name']}")
        storage_path = f"card_images/{card['name'].replace(' ', '_')}.png"
        storage_response = await supabase.storage.from_("card-images").upload(storage_path, image_data, {"content-type": "image/png"})
        
        if storage_response.error:
            raise Exception(f"Failed to upload image to storage: {storage_response.error}")
        
        public_url = supabase.storage.from_("card-images").get_public_url(storage_path)
        
        update_response = await supabase.table("generated_images").update({"url": public_url}).eq("name", card['name']).execute()
        
        if update_response.error:
            raise Exception(f"Failed to update database: {update_response.error}")
        
        logging.info(f"Updated image for card: {card['name']}")
        return update_response.data
    except Exception as e:
        logging.error(f"Failed to update card image in Supabase: {card['name']}, Error: {str(e)}")
        return None

async def main():
    logging.info("Starting asset generation for Terrible Teddies...")
    
    try:
        # Fetch all cards from the database
        response = await supabase.table("generated_images").select("*").execute()
        cards = response.data

        total_cards = len(cards)
        for index, card in enumerate(cards):
            result = await update_card_image(card)
            
            if result:
                progress = ((index + 1) / total_cards) * 100
                print(f"PROGRESS:{progress:.2f}")
                print(f"CURRENT_IMAGE:{card['name']}")
                sys.stdout.flush()
    
        logging.info("Asset generation complete!")
    except Exception as e:
        logging.error(f"An error occurred during asset generation: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())