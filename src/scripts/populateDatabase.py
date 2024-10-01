import sys
sys.path.append('../')  # Add the parent directory to the Python path

from utils.populateDatabase import populateDatabase

def main():
    print("Populating the database...")
    populateDatabase()
    print("Database population complete.")

if __name__ == "__main__":
    main()