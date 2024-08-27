import os
from supabase import create_client, Client
import random
from dotenv import load_dotenv
from PIL import Image, ImageDraw
import io
import base64

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase: Client = create_client(os.environ.get("VITE_SUPABASE_PROJECT_URL"), os.environ.get("VITE_SUPABASE_API_KEY"))

CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost']

def generate_card_image(card_type):
    # Create a new image with a white background
    img = Image.new('RGB', (200, 200), color='white')
    draw = ImageDraw.Draw(img)

    # Define colors for each card type
    colors = {
        'Action': 'red',
        'Trap': 'purple',
        'Special': 'yellow',
        'Defense': 'blue',
        'Boost': 'green'
    }

    # Draw a shape based on the card type
    if card_type == 'Action':
        draw.polygon([(100, 50), (50, 150), (150, 150)], fill=colors[card_type])
    elif card_type == 'Trap':
        draw.rectangle([50, 50, 150, 150], fill=colors[card_type])
    elif card_type == 'Special':
        draw.ellipse([50, 50, 150, 150], fill=colors[card_type])
    elif card_type == 'Defense':
        draw.arc([50, 50, 150, 150], 0, 360, fill=colors[card_type], width=20)
    elif card_type == 'Boost':
        draw.polygon([(100, 50), (50, 100), (100, 150), (150, 100)], fill=colors[card_type])

    # Save image to a bytes buffer
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    image_bytes = buffer.getvalue()

    # Encode image bytes to base64
    image_base64 = base64.b64encode(image_bytes).decode('utf-8')

    return f"data:image/png;base64,{image_base64}"

def generate_and_store_card(name, type, energy_cost):
    image_data = generate_card_image(type)
    
    card_data = {
        "name": name,
        "type": type,
        "url": image_data,
        "prompt": f"A simple {type.lower()} card for Terrible Teddies",
        "energy_cost": energy_cost
    }
    
    try:
        result = supabase.table("generated_images").insert(card_data).execute()
        print(f"Generated and stored card: {name}")
        return result
    except Exception as e:
        print(f"Error storing card data: {e}")
    
    return None

def main():
    print("Starting asset generation for Terrible Teddies...")
    
    for card_type in CARD_TYPES:
        for i in range(8):  # Generate 8 cards of each type
            name = f"{card_type} Teddy {i+1}"
            energy_cost = random.randint(1, 5)
            result = generate_and_store_card(name, card_type, energy_cost)
            if result:
                print(f"Successfully generated and stored {name}")
            else:
                print(f"Failed to generate or store {name}")
    
    print("Asset generation complete!")

if __name__ == "__main__":
    main()