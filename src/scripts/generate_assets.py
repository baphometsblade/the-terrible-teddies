import os
import requests
from supabase import create_client, Client
import random

# Initialize Supabase client
supabase: Client = create_client(os.environ.get("VITE_SUPABASE_PROJECT_URL"), os.environ.get("VITE_SUPABASE_API_KEY"))

CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost']
PICOAPPS_API_URL = "https://picoapps.xyz/api/generate-terrible-teddies-image"
PICOAPPS_API_KEY = os.environ.get("PICOAPPS_API_KEY")

def generate_card_image(card_type, name):
    prompt = f"A cute teddy bear as a {card_type} card for a card game called Terrible Teddies. The teddy should look {random.choice(['mischievous', 'adorable', 'fierce', 'sleepy', 'excited'])} and be doing an action related to its type. Cartoon style, vibrant colors, white background. The card name is {name}."
    
    response = requests.post(
        PICOAPPS_API_URL,
        json={"prompt": prompt},
        headers={"Authorization": f"Bearer {PICOAPPS_API_KEY}"}
    )
    
    if response.status_code == 200:
        return response.json()['image_url']
    else:
        raise Exception(f"Failed to generate image: {response.text}")

def generate_and_store_card(name, type, energy_cost):
    image_url = generate_card_image(type, name)
    
    card_data = {
        "name": name,
        "type": type,
        "energy_cost": energy_cost,
        "url": image_url,
        "prompt": f"A {type} card for Terrible Teddies named {name}"
    }
    
    result = supabase.table("generated_images").insert(card_data).execute()
    print(f"Generated and stored card: {name}")
    return result

def main():
    print("Starting asset generation for Terrible Teddies...")
    
    if not PICOAPPS_API_KEY:
        raise ValueError("PICOAPPS_API_KEY is not set in the environment variables")
    
    for card_type in CARD_TYPES:
        for i in range(8):  # Generate 8 cards of each type
            name = f"{card_type} Teddy {i+1}"
            energy_cost = random.randint(1, 5)
            generate_and_store_card(name, card_type, energy_cost)
    
    print("Asset generation complete!")

if __name__ == "__main__":
    main()