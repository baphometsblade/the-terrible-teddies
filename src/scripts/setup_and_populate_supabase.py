import os
from dotenv import load_dotenv
from supabase import create_client, Client
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Supabase client
url: str = os.environ.get("VITE_SUPABASE_URL")
key: str = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def create_tables():
    try:
        logger.info("Creating terrible_teddies table...")
        response = supabase.table("terrible_teddies").insert({
            "id": "dummy",
            "name": "Dummy Bear",
            "title": "The Placeholder",
            "description": "A temporary bear for table creation",
            "attack": 1,
            "defense": 1,
            "special_move": "Vanish",
            "image_url": "https://example.com/dummy.png"
        }).execute()
        logger.info(f"Response: {response}")
        
        logger.info("Removing dummy data...")
        supabase.table("terrible_teddies").delete().eq("id", "dummy").execute()
        logger.info("Dummy data removed successfully")
    except Exception as e:
        logger.error(f"Error in create_tables: {str(e)}")
        raise

def populate_teddies():
    try:
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
        
        logger.info("Populating teddies...")
        for teddy in teddies:
            response = supabase.table("terrible_teddies").insert(teddy).execute()
            logger.info(f"Inserted teddy: {teddy['name']}")
            logger.info(f"Response: {response}")
    except Exception as e:
        logger.error(f"Error in populate_teddies: {str(e)}")
        raise

def main():
    logger.info("Setting up and populating Supabase...")
    try:
        create_tables()
        populate_teddies()
        logger.info("Setup and population complete!")
    except Exception as e:
        logger.error(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()