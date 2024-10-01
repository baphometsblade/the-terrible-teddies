import os
from dotenv import load_dotenv
from supabase import create_client, Client
import logging
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Supabase client
url: str = os.environ.get("VITE_SUPABASE_URL")
key: str = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def verify_connection():
    try:
        response = supabase.table('terrible_teddies').select('count').limit(1).execute()
        logger.info(f"Connection verified. Response: {response}")
        return True
    except Exception as e:
        logger.error(f"Connection verification failed: {str(e)}")
        return False

def check_function_exists(function_name):
    try:
        response = supabase.rpc(function_name).execute()
        logger.info(f"Function {function_name} exists. Response: {response}")
        return True
    except Exception as e:
        logger.error(f"Function {function_name} does not exist or is not accessible: {str(e)}")
        return False

def create_tables():
    try:
        logger.info("Attempting to create terrible_teddies table...")
        response = supabase.rpc('create_table_if_not_exists', {
            'table_name': 'terrible_teddies',
            'table_definition': '''
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                attack INTEGER NOT NULL,
                defense INTEGER NOT NULL,
                special_move TEXT NOT NULL,
                image_url TEXT
            '''
        }).execute()
        logger.info(f"Table creation response: {json.dumps(response.dict(), indent=2)}")
    except Exception as e:
        logger.error(f"Error in create_tables: {str(e)}")
        if hasattr(e, 'response'):
            logger.error(f"Response content: {e.response.content}")
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
            logger.info(f"Response: {json.dumps(response.dict(), indent=2)}")
    except Exception as e:
        logger.error(f"Error in populate_teddies: {str(e)}")
        if hasattr(e, 'response'):
            logger.error(f"Response content: {e.response.content}")
        raise

def main():
    logger.info("Setting up and populating Supabase...")
    try:
        if not verify_connection():
            logger.error("Failed to connect to Supabase. Please check your credentials.")
            return

        if not check_function_exists('create_table_if_not_exists'):
            logger.error("The 'create_table_if_not_exists' function does not exist in Supabase.")
            return

        create_tables()
        populate_teddies()
        logger.info("Setup and population complete!")
    except Exception as e:
        logger.error(f"An error occurred: {str(e)}")
        if hasattr(e, 'response'):
            logger.error(f"Response content: {e.response.content}")

if __name__ == "__main__":
    main()