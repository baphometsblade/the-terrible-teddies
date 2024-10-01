import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.supabaseSetup import setupTerribleTeddies

def main():
    print("Setting up the database...")
    setupTerribleTeddies()
    print("Database setup complete.")

if __name__ == "__main__":
    main()