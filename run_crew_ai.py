import subprocess
import sys
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def print_ascii_art():
    ascii_art = """
    ████████╗███████╗██████╗ ██████╗ ██╗██████╗ ██╗     ███████╗
    ╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██║██╔══██╗██║     ██╔════╝
       ██║   █████╗  ██████╔╝██████╔╝██║██████╔╝██║     █████╗  
       ██║   ██╔══╝  ██╔══██╗██╔══██╗██║██╔══██╗██║     ██╔══╝  
       ██║   ███████╗██║  ██║██║  ██║██║██████╔╝███████╗███████╗
       ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝╚══════╝
                        ████████╗███████╗██████╗ ██████╗ ██╗███████╗███████╗
                        ╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██║██╔════╝██╔════╝
                           ██║   █████╗  ██║  ██║██║  ██║██║█████╗  ███████╗
                           ██║   ██╔══╝  ██║  ██║██║  ██║██║██╔══╝  ╚════██║
                           ██║   ███████╗██████╔╝██████╔╝██║███████╗███████║
                           ╚═╝   ╚══════╝╚═════╝ ╚═════╝ ╚═╝╚══════╝╚══════╝
    """
    print(ascii_art)

def install_requirements():
    print("Installing required packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("Required packages installed successfully.")
    except subprocess.CalledProcessError as e:
        logging.error(f"Error installing requirements: {e}")
        sys.exit(1)

def run_crew_ai():
    print("Running crew_ai.py...")
    try:
        subprocess.run([sys.executable, "crew_ai.py"], check=True)
        print("crew_ai.py completed successfully.")
    except subprocess.CalledProcessError as e:
        logging.error(f"Error running crew_ai.py: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print_ascii_art()
    
    if not os.path.exists("requirements.txt"):
        logging.error("Error: requirements.txt not found. Please make sure it exists in the current directory.")
        sys.exit(1)

    if not os.path.exists("crew_ai.py"):
        logging.error("Error: crew_ai.py not found. Please make sure it exists in the current directory.")
        sys.exit(1)

    install_requirements()
    run_crew_ai()

    print("Asset generation process completed!")
    print("\nThank you for using Terrible Teddies Asset Generator!")