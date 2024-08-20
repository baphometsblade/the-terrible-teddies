import subprocess
import sys
import os
import logging
import colorama
from colorama import Fore, Style

# Initialize colorama for cross-platform colored output
colorama.init(autoreset=True)

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
    print(f"{Fore.MAGENTA}{ascii_art}{Style.RESET_ALL}")

def install_requirements():
    print(f"{Fore.CYAN}Installing required packages...{Style.RESET_ALL}")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print(f"{Fore.GREEN}Required packages installed successfully.{Style.RESET_ALL}")
    except subprocess.CalledProcessError as e:
        logging.error(f"{Fore.RED}Error installing requirements: {e}{Style.RESET_ALL}")
        sys.exit(1)

def run_crew_ai():
    print(f"{Fore.YELLOW}Running crew_ai.py...{Style.RESET_ALL}")
    try:
        subprocess.run([sys.executable, "crew_ai.py"], check=True)
        print(f"{Fore.GREEN}crew_ai.py completed successfully.{Style.RESET_ALL}")
    except subprocess.CalledProcessError as e:
        logging.error(f"{Fore.RED}Error running crew_ai.py: {e}{Style.RESET_ALL}")
        sys.exit(1)

if __name__ == "__main__":
    print_ascii_art()
    
    if not os.path.exists("requirements.txt"):
        logging.error(f"{Fore.RED}Error: requirements.txt not found. Please make sure it exists in the current directory.{Style.RESET_ALL}")
        sys.exit(1)

    if not os.path.exists("crew_ai.py"):
        logging.error(f"{Fore.RED}Error: crew_ai.py not found. Please make sure it exists in the current directory.{Style.RESET_ALL}")
        sys.exit(1)

    install_requirements()
    run_crew_ai()

    print(f"{Fore.GREEN}Asset generation process completed!{Style.RESET_ALL}")
    print(f"\n{Fore.YELLOW}Thank you for using Terrible Teddies Asset Generator!{Style.RESET_ALL}")