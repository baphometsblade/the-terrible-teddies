import json
import os
from crewai import Agent, Task, Crew, Process
from langchain.llms import OpenAI
from dotenv import load_dotenv
import requests
from PIL import Image
from io import BytesIO
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables
load_dotenv()

# Initialize the OpenAI language model
llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Define the agents
image_generator = Agent(
    role='Image Generator',
    goal='Generate hyper-realistic and satirical images for Terrible Teddies cards',
    backstory='You are an AI artist specializing in creating hyper-detailed, adult-themed teddy bear illustrations with a South Park-esque style',
    verbose=True,
    llm=llm
)

card_designer = Agent(
    role='Card Designer',
    goal='Design balanced and humorously offensive cards for the Terrible Teddies game',
    backstory='You are a game designer with expertise in creating satirical and edgy card game mechanics',
    verbose=True,
    llm=llm
)

rule_writer = Agent(
    role='Rule Writer',
    goal='Create clear and engaging rules for the Terrible Teddies game with an adult humor twist',
    backstory='You are an experienced technical writer specializing in adult-themed game rule books',
    verbose=True,
    llm=llm
)

lore_creator = Agent(
    role='Lore Creator',
    goal='Develop a rich, satirical backstory for the Terrible Teddies universe',
    backstory='You are a creative writer skilled in crafting humorous and edgy lore for adult-themed games',
    verbose=True,
    llm=llm
)

# Define the tasks
generate_card_images = Task(
    description='Generate 40 unique, hyper-realistic, and satirical teddy bear images for game cards',
    agent=image_generator
)

design_cards = Task(
    description='Create 40 balanced cards with names, types, energy costs, and humorously offensive effects',
    agent=card_designer
)

write_game_rules = Task(
    description='Write comprehensive rules for the Terrible Teddies card game with an adult humor twist',
    agent=rule_writer
)

create_game_lore = Task(
    description='Develop a satirical and edgy backstory for the Terrible Teddies universe',
    agent=lore_creator
)

# Create the crew
asset_generation_crew = Crew(
    agents=[image_generator, card_designer, rule_writer, lore_creator],
    tasks=[generate_card_images, design_cards, write_game_rules, create_game_lore],
    verbose=2,
    process=Process.sequential
)

# Process and save the results
def save_image(image_url, filename):
    try:
        response = requests.get(image_url)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content))
        os.makedirs('public/card_images', exist_ok=True)
        img.save(f"public/card_images/{filename}.png")
        logging.info(f"Image saved: {filename}.png")
    except requests.RequestException as e:
        logging.error(f"Error downloading image: {e}")
    except IOError as e:
        logging.error(f"Error saving image: {e}")

def process_results(results):
    try:
        card_images = json.loads(results[0])
        card_designs = json.loads(results[1])
        game_rules = results[2]
        game_lore = results[3]

        # Save card images
        for i, image_url in enumerate(card_images):
            save_image(image_url, f"card_{i+1}")

        # Save card designs
        os.makedirs('src/data', exist_ok=True)
        with open('src/data/cards.json', 'w') as f:
            json.dump(card_designs, f, indent=2)
        logging.info("Card designs saved to src/data/cards.json")

        # Save game rules
        with open('src/data/game_rules.md', 'w') as f:
            f.write(game_rules)
        logging.info("Game rules saved to src/data/game_rules.md")

        # Save game lore
        with open('src/data/game_lore.md', 'w') as f:
            f.write(game_lore)
        logging.info("Game lore saved to src/data/game_lore.md")

    except json.JSONDecodeError as e:
        logging.error(f"Error decoding JSON: {e}")
    except IOError as e:
        logging.error(f"Error writing to file: {e}")

def run_crew():
    try:
        logging.info("Starting asset generation process...")
        results = asset_generation_crew.kickoff()
        logging.info("Asset generation process completed.")
        process_results(results)
        logging.info("All assets have been processed and saved.")
    except Exception as e:
        logging.error(f"An error occurred during the crew run: {e}")

if __name__ == "__main__":
    run_crew()