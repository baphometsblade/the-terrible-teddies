import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Initialize Supabase client
supabase: Client = create_client(os.environ.get("VITE_SUPABASE_PROJECT_URL"), os.environ.get("VITE_SUPABASE_API_KEY"))

CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost']

def generate_card_image(prompt):
    response = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1024x1024",
        quality="standard",
        n=1,
    )
    return response.data[0].url

def generate_and_store_card(name, type, energy_cost):
    prompt = f"A cute teddy bear as a {type} card for a card game called Terrible Teddies. The teddy should look {random.choice(['mischievous', 'adorable', 'fierce', 'sleepy', 'excited'])} and be doing an action related to its type. Cartoon style, vibrant colors, white background."
    image_url = generate_card_image(prompt)
    
    card_data = {
        "name": name,
        "type": type,
        "energy_cost": energy_cost,
        "url": image_url,
        "prompt": prompt
    }
    
    result = supabase.table("generated_images").insert(card_data).execute()
    print(f"Generated and stored card: {name}")
    return result

def main():
    print("Starting asset generation for Terrible Teddies...")
    
    for card_type in CARD_TYPES:
        for i in range(8):  # Generate 8 cards of each type
            name = f"{card_type} Teddy {i+1}"
            energy_cost = random.randint(1, 5)
            generate_and_store_card(name, card_type, energy_cost)
    
    print("Asset generation complete!")

if __name__ == "__main__":
    main()