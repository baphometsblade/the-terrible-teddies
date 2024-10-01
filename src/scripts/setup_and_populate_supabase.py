import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Initialize Supabase client
url: str = os.environ.get("VITE_SUPABASE_URL")
key: str = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def create_tables():
    # Create terrible_teddies table
    supabase.table("terrible_teddies").insert({
        "id": "dummy",
        "name": "Dummy Bear",
        "title": "The Placeholder",
        "description": "A temporary bear for table creation",
        "attack": 1,
        "defense": 1,
        "special_move": "Vanish",
        "image_url": "https://example.com/dummy.png"
    }).execute()
    
    # Remove the dummy data
    supabase.table("terrible_teddies").delete().eq("id", "dummy").execute()

def populate_teddies():
    teddies = [
        {
            "name": "Whiskey Whiskers",
            "title": "The Smooth Operator",
            "description": "A suave bear with a penchant for fine spirits and even finer company.",
            "attack": 6,
            "defense": 5,
            "special_move": "On the Rocks",
            "image_url": "https://example.com/whiskey_whiskers.png"
        },
        {
            "name": "Madame Mistletoe",
            "title": "The Festive Flirt",
            "description": "She carries mistletoe year-round, believing every moment is an opportunity for a sly kiss.",
            "attack": 5,
            "defense": 6,
            "special_move": "Sneak Kiss",
            "image_url": "https://example.com/madame_mistletoe.png"
        }
    ]
    
    for teddy in teddies:
        supabase.table("terrible_teddies").insert(teddy).execute()

def main():
    print("Setting up and populating Supabase...")
    create_tables()
    populate_teddies()
    print("Setup and population complete!")

if __name__ == "__main__":
    main()