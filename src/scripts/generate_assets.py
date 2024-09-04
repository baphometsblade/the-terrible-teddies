import os
from dotenv import load_dotenv
from openai import OpenAI
import random
import requests
import json
import sys
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost']
TEDDY_TRAITS = ['mischievous', 'adorable', 'fierce', 'sleepy', 'excited', 'naughty', 'playful', 'grumpy']
BACKGROUNDS = ['toy store', 'child\'s bedroom', 'playground', 'picnic area', 'teddy bear factory']

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

def generate_card_prompt(name, type):
    trait = random.choice(TEDDY_TRAITS)
    background = random.choice(BACKGROUNDS)
    action = get_action_for_type(type)
    return f"A cute {trait} teddy bear named {name} as a {type} card for the game Terrible Teddies. The teddy is {action} in a {background} setting. Cartoon style, vibrant colors, child-friendly."

def get_action_for_type(type):
    actions = {
        'Action': 'performing a playful attack or mischievous prank',
        'Trap': 'setting up a clever trap or surprise',
        'Special': 'using a unique and magical ability',
        'Defense': 'protecting itself or others with a cute shield or barrier',
        'Boost': 'powering up or encouraging other teddies'
    }
    return actions.get(type, 'doing something cute and funny')

def generate_and_store_card(name, type, energy_cost):
    prompt = generate_card_prompt(name, type)
    image_url = generate_card_image(prompt)
    
    if not image_url:
        return None

    card_data = {
        "name": name,
        "type": type,
        "energy_cost": energy_cost,
        "url": image_url,
        "prompt": prompt,
        "attack": random.randint(1, 5),
        "defense": random.randint(1, 5),
        "special_move": f"{type} Special: {random.choice(['Tickle Attack', 'Fluff Explosion', 'Cuddle Beam', 'Nap Time', 'Sugar Rush'])}",
        "description": f"A {random.choice(TEDDY_TRAITS)} {type.lower()} teddy bear with unique abilities."
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

    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_card = {executor.submit(generate_and_store_card, f"{card_type} Teddy {i+1}", card_type, random.randint(1, 5)): (card_type, i) for card_type in CARD_TYPES for i in range(8)}
        
        for future in tqdm(as_completed(future_to_card), total=total_cards, desc="Generating cards"):
            card_type, i = future_to_card[future]
            result = future.result()
            
            if result:
                generated_cards += 1
                progress = (generated_cards / total_cards) * 100
                print(json.dumps({
                    "progress": progress,
                    "currentImage": result["name"],
                    "url": result["url"]
                }))
                sys.stdout.flush()
            else:
                logging.error(f"Failed to generate or store {card_type} Teddy {i+1}")
    
    print(json.dumps({"completed": True, "total_generated": generated_cards}))
    sys.stdout.flush()
    logging.info("Asset generation complete!")

if __name__ == "__main__":
    main()