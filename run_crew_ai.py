import subprocess
import sys
import os

def install_requirements():
    print("Installing required packages...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

def run_crew_ai():
    print("Running crew_ai.py...")
    subprocess.run([sys.executable, "crew_ai.py"], check=True)

if __name__ == "__main__":
    if not os.path.exists("requirements.txt"):
        print("Error: requirements.txt not found. Please make sure it exists in the current directory.")
        sys.exit(1)

    if not os.path.exists("crew_ai.py"):
        print("Error: crew_ai.py not found. Please make sure it exists in the current directory.")
        sys.exit(1)

    install_requirements()
    run_crew_ai()

    print("Asset generation complete!")