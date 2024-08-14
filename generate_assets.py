import json
import os
from crewai import Agent, Task, Crew
from langchain.llms import OpenAI
from dotenv import load_dotenv
import requests
from PIL import Image
from io import BytesIO

# Load environment variables
load_dotenv()

# Initialize the OpenAI language model
llm = OpenAI()

# Load teddy bear data
with open('teddies.json', 'r') as f:
    teddies = json.load(f)

# Define the agents
image_generator = Agent(
    role='Image Generator',
    goal='Generate stylized images for Terrible Teddies cards',
    backstory='You are an AI artist specializing in creating stylized teddy bear illustrations',
    verbose=True,
    llm=llm
)

card_designer = Agent(
    role='Card Designer',
    goal='Design balanced and interesting cards for the Terrible Teddies game',
    backstory='You are a game designer with expertise in card game mechanics and balance',
    verbose=True,
    llm=llm
)

rule_writer = Agent(
    role='Rule Writer',
    goal='Create clear and engaging rules for the Terrible Teddies game',
    backstory='You are an experienced technical writer specializing in game rule books',
    verbose=True,
    llm=llm
)

# Define the tasks
generate_card_images = Task(
    description=f'Generate {len(teddies)} unique, stylized teddy bear images for game cards based on the provided data',
    agent=image_generator
)

design_cards = Task(
    description=f'Create {len(teddies)} balanced cards with names, types, energy costs, and effects based on the provided teddy bear data',
    agent=card_designer
)

write_game_rules = Task(
    description='Write comprehensive rules for the Terrible Teddies card game',
    agent=rule_writer
)

# Create the crew
asset_generation_crew = Crew(
    agents=[image_generator, card_designer, rule_writer],
    tasks=[generate_card_images, design_cards, write_game_rules],
    verbose=2
)

# Run the crew
results = asset_generation_crew.kickoff()

# Process and save the results
def save_image(image_url, filename):
    response = requests.get(image_url)
    img = Image.open(BytesIO(response.content))
    os.makedirs('public/card_images', exist_ok=True)
    img.save(f"public/card_images/{filename}.png")

def process_results(results):
    card_images = json.loads(results[0])
    card_designs = json.loads(results[1])
    game_rules = results[2]

    # Save card images
    for i, image_url in enumerate(card_images):
        save_image(image_url, f"card_{i+1}")

    # Save card designs
    os.makedirs('src/data', exist_ok=True)
    with open('src/data/cards.json', 'w') as f:
        json.dump(card_designs, f, indent=2)

    # Save game rules
    with open('src/data/game_rules.md', 'w') as f:
        f.write(game_rules)

process_results(results)

print("Asset generation complete!")