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
TEDDY_TRAITS = ['mischievous', 'adorable', 'fierce', 'sleepy', 'excited', 'naughty', 'playful', 'grumpy', 'curious', 'silly', 'clumsy', 'brave', 'shy', 'sneaky', 'jolly']
BACKGROUNDS = ['toy store', 'child\'s bedroom', 'playground', 'picnic area', 'teddy bear factory', 'magical forest', 'birthday party', 'school classroom', 'treehouse', 'beach', 'circus tent', 'candy land', 'space station', 'underwater kingdom', 'fairy tale castle']

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
    return f"A cute {trait} teddy bear named {name} as a {type} card for the game Terrible Teddies. The teddy is {action} in a {background} setting. Cartoon style, vibrant colors, child-friendly, no text or numbers on the image. The image should be fun, engaging, and suitable for a card game."

def get_action_for_type(type):
    actions = {
        'Action': ['performing a playful attack', 'executing a mischievous prank', 'showing off karate moves', 'wielding a pillow like a sword'],
        'Trap': ['setting up a clever trap', 'hiding a surprise', 'preparing a sneaky trick', 'camouflaging in the surroundings'],
        'Special': ['using a unique magical ability', 'glowing with mysterious energy', 'transforming into a super-teddy', 'summoning cute minions'],
        'Defense': ['protecting itself with a cute shield', 'hiding behind a fortress of pillows', 'wearing adorable armor', 'creating a bubble of safety'],
        'Boost': ['powering up with a rainbow aura', 'sharing energy with other teddies', 'eating magical candy', 'reading an enchanted storybook']
    }
    return random.choice(actions.get(type, ['doing something cute and funny']))

def generate_special_move(type):
    moves = {
        'Action': ['Tickle Tornado', 'Pillow Fight Frenzy', 'Sneak Attack Cuddle', 'Bouncy Castle Bash', 'Teddy Tantrum'],
        'Trap': ['Sticky Honey Trap', 'Toy Box Ambush', 'Nap Time Snare', 'Teddy Bear Trap', 'Lullaby Lockdown'],
        'Special': ['Rainbow Fluff Blast', 'Wish Upon a Star', 'Teddy Bear Picnic', 'Imagination Explosion', 'Stuffing Surge'],
        'Defense': ['Fluffy Force Field', 'Blanket Fort Barrier', 'Huggy Armor', 'Cuddly Countermeasure', 'Plush Protection'],
        'Boost': ['Sugar Rush', 'Friendship Power-Up', 'Brave Little Toaster', 'Bedtime Story Boost', 'Playtime Power Surge']
    }
    return f"{type} Special: {random.choice(moves.get(type, ['Cuddle Beam', 'Nap Time', 'Fluff Explosion']))}"

def generate_card_description(name, type, trait):
    prompt = f"Create a short, fun description for a {trait} teddy bear named {name} who is a {type} card in the Terrible Teddies game. The description should be child-friendly and highlight the bear's unique personality and abilities."
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[
                {"role": "system", "content": "You are a creative writer for a children's card game."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=50,
            n=1,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Error generating card description: {str(e)}")
        return f"A {trait} {type.lower()} teddy bear with unique abilities and a mischievous streak."

def generate_and_store_card(name, type, energy_cost):
    trait = random.choice(TEDDY_TRAITS)
    prompt = generate_card_prompt(name, type)
    image_url = generate_card_image(prompt)
    
    if not image_url:
        return None

    description = generate_card_description(name, type, trait)

    card_data = {
        "name": name,
        "type": type,
        "energy_cost": energy_cost,
        "url": image_url,
        "prompt": prompt,
        "attack": random.randint(1, 5),
        "defense": random.randint(1, 5),
        "special_move": generate_special_move(type),
        "description": description
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
