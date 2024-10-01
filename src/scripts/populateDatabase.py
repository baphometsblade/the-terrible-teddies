import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.populateDatabase import populateDatabase

def main():
    print("Populating the database...")
    populateDatabase()
    print("Database population complete.")

if __name__ == "__main__":
    main()