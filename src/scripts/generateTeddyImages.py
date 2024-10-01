import sys
sys.path.append('../')  # Add the parent directory to the Python path

from utils.imageGenerator import generateTeddyImage, saveTeddyImage
from utils.supabaseSetup import supabase

def main():
    print("Generating teddy images...")
    # Fetch teddies from the database
    result = supabase.table('terrible_teddies').select('name, description').execute()
    teddies = result.data

    for teddy in teddies:
        print(f"Generating image for {teddy['name']}...")
        image_url = generateTeddyImage(teddy['name'], teddy['description'])
        if image_url:
            saved_url = saveTeddyImage(teddy['name'], image_url)
            if saved_url:
                print(f"Image saved for {teddy['name']}: {saved_url}")
                # Update the teddy in the database with the new image URL
                supabase.table('terrible_teddies').update({'image_url': saved_url}).eq('name', teddy['name']).execute()
    
    print("Teddy image generation complete.")

if __name__ == "__main__":
    main()