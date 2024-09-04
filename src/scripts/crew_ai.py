import json
import os
from crewai import Agent, Task, Crew, Process
from langchain.llms import OpenAI
from dotenv import load_dotenv
import requests
from PIL import Image
from io import BytesIO
import logging
import tqdm
import colorama
from colorama import Fore, Style
from supabase import create_client, Client

# Initialize colorama and set up logging
colorama.init(autoreset=True)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables and initialize OpenAI and Supabase
load_dotenv()
llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
supabase: Client = create_client(os.environ.get("VITE_SUPABASE_PROJECT_URL"), os.environ.get("VITE_SUPABASE_API_KEY"))

def create_agents():
    return {
        'game_designer': Agent(
            role='Game Designer',
            goal='Design comprehensive and balanced game mechanics for Terrible Teddies',
            backstory='You are an experienced game designer specializing in card games with a humorous twist. Your expertise lies in creating engaging, balanced, and fun gameplay mechanics.',
            verbose=True,
            llm=llm
        ),
        'artist': Agent(
            role='Artist',
            goal='Create visually appealing and cohesive art style for Terrible Teddies',
            backstory='You are a talented digital artist with a knack for creating cute yet mischievous characters. Your art style perfectly captures the essence of Terrible Teddies.',
            verbose=True,
            llm=llm
        ),
        'writer': Agent(
            role='Writer',
            goal='Develop engaging card descriptions and overall game lore',
            backstory='You are a creative writer with a talent for humorous and slightly edgy content. Your writing brings the world of Terrible Teddies to life.',
            verbose=True,
            llm=llm
        ),
        'ui_designer': Agent(
            role='UI Designer',
            goal='Design an intuitive and visually appealing user interface for the game',
            backstory='You are a skilled UI/UX designer with experience in creating interfaces for digital card games. Your designs are both functional and aesthetically pleasing.',
            verbose=True,
            llm=llm
        ),
        'qa_tester': Agent(
            role='QA Tester',
            goal='Ensure game balance, identify bugs, and improve overall player experience',
            backstory='You are a meticulous QA tester with a passion for card games and a keen eye for detail. Your feedback is crucial for refining the game.',
            verbose=True,
            llm=llm
        )
    }

def create_tasks(agents):
    return [
        Task(
            description='Design the core game mechanics, including card types, energy system, turn structure, and special abilities',
            agent=agents['game_designer'],
            expected_output="A detailed JSON string containing the core game mechanics, rules, and gameplay systems"
        ),
        Task(
            description='Create concept art for the main card types, character designs, and game logo',
            agent=agents['artist'],
            expected_output="A list of image descriptions and URLs for the concept art, character designs, and logo"
        ),
        Task(
            description='Write engaging descriptions for 40 unique Terrible Teddy cards, including their backstories and special abilities',
            agent=agents['writer'],
            expected_output="A JSON string containing an array of 40 card objects with names, types, descriptions, and special abilities"
        ),
        Task(
            description='Design the main game screen UI, card layout, player info display, and action buttons',
            agent=agents['ui_designer'],
            expected_output="A detailed description of the UI layout, component designs, and a mockup image URL"
        ),
        Task(
            description='Review the game design, suggest balance improvements, identify potential issues, and propose additional features',
            agent=agents['qa_tester'],
            expected_output="A JSON string containing a list of suggestions, balance improvements, potential issues, and proposed features"
        )
    ]

def save_image(image_url, filename):
    try:
        response = requests.get(image_url)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content))
        os.makedirs('public/game_assets', exist_ok=True)
        img.save(f"public/game_assets/{filename}.png")
        logging.info(f"{Fore.GREEN}Image saved: {filename}.png{Style.RESET_ALL}")
    except requests.RequestException as e:
        logging.error(f"{Fore.RED}Error downloading image: {e}{Style.RESET_ALL}")
    except IOError as e:
        logging.error(f"{Fore.RED}Error saving image: {e}{Style.RESET_ALL}")

def process_results(results):
    try:
        game_mechanics = json.loads(results[0])
        concept_art_data = json.loads(results[1])
        card_data = json.loads(results[2])
        ui_design = json.loads(results[3])
        qa_feedback = json.loads(results[4])

        # Save game mechanics
        with open('src/data/game_mechanics.json', 'w') as f:
            json.dump(game_mechanics, f, indent=2)
        logging.info(f"{Fore.GREEN}Game mechanics saved to src/data/game_mechanics.json{Style.RESET_ALL}")

        # Save concept art
        print(f"{Fore.CYAN}Saving concept art...{Style.RESET_ALL}")
        for i, art_item in tqdm.tqdm(enumerate(concept_art_data), total=len(concept_art_data)):
            save_image(art_item['url'], f"concept_art_{i+1}")

        # Save card data to Supabase
        for card in card_data:
            supabase.table('terrible_teddies_cards').insert(card).execute()
        logging.info(f"{Fore.GREEN}Card data saved to Supabase{Style.RESET_ALL}")

        # Save UI design
        with open('src/data/ui_design.json', 'w') as f:
            json.dump(ui_design, f, indent=2)
        logging.info(f"{Fore.GREEN}UI design saved to src/data/ui_design.json{Style.RESET_ALL}")
        save_image(ui_design['mockup_url'], "ui_mockup")

        # Save QA feedback
        with open('src/data/qa_feedback.json', 'w') as f:
            json.dump(qa_feedback, f, indent=2)
        logging.info(f"{Fore.GREEN}QA feedback saved to src/data/qa_feedback.json{Style.RESET_ALL}")

    except json.JSONDecodeError as e:
        logging.error(f"{Fore.RED}Error decoding JSON: {e}{Style.RESET_ALL}")
    except IOError as e:
        logging.error(f"{Fore.RED}Error writing to file: {e}{Style.RESET_ALL}")

def run_crew():
    try:
        print(f"{Fore.YELLOW}Starting Terrible Teddies asset generation process...{Style.RESET_ALL}")
        agents = create_agents()
        tasks = create_tasks(agents)
        crew = Crew(
            agents=list(agents.values()),
            tasks=tasks,
            verbose=2,
            process=Process.sequential
        )
        results = crew.kickoff()
        print(f"{Fore.GREEN}Asset generation process completed.{Style.RESET_ALL}")
        process_results(results)
        print(f"{Fore.GREEN}All assets have been processed and saved.{Style.RESET_ALL}")
    except Exception as e:
        logging.error(f"{Fore.RED}An error occurred during the crew run: {e}{Style.RESET_ALL}")

if __name__ == "__main__":
    run_crew()