import subprocess
import sys
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def install_requirements():
    logging.info("Installing required packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        logging.info("Required packages installed successfully.")
    except subprocess.CalledProcessError as e:
        logging.error(f"Error installing requirements: {e}")
        sys.exit(1)

def run_crew_ai():
    logging.info("Running crew_ai.py...")
    try:
        subprocess.run([sys.executable, "crew_ai.py"], check=True)
        logging.info("crew_ai.py completed successfully.")
    except subprocess.CalledProcessError as e:
        logging.error(f"Error running crew_ai.py: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if not os.path.exists("requirements.txt"):
        logging.error("Error: requirements.txt not found. Please make sure it exists in the current directory.")
        sys.exit(1)

    if not os.path.exists("crew_ai.py"):
        logging.error("Error: crew_ai.py not found. Please make sure it exists in the current directory.")
        sys.exit(1)

    install_requirements()
    run_crew_ai()

    logging.info("Asset generation process completed!")