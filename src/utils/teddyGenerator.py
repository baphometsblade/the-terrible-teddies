import random
from .supabaseSetup import supabase

def generateTeddyBear():
    names = ["Whiskey Whiskers", "Madame Mistletoe", "Baron Von Blubber", "Icy Ivan", "Lady Lush"]
    titles = ["The Smooth Operator", "The Festive Flirt", "The Inflated Ego", "The Frosty Fighter", "The Party Animal"]
    
    name = random.choice(names)
    title = random.choice(titles)
    description = f"A cheeky teddy bear with a knack for mischief. Known as {title}."
    
    return {
        "name": name,
        "title": title,
        "description": description,
        "attack": random.randint(1, 10),
        "defense": random.randint(1, 10),
        "special_move": f"{name}'s Special Move",
        "image_url": f"https://example.com/{name.lower().replace(' ', '_')}.png"
    }

def generateInitialBears(count):
    bears = [generateTeddyBear() for _ in range(count)]
    supabase.table("terrible_teddies").insert(bears).execute()
    return bears