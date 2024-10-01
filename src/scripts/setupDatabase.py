import sys
sys.path.append('../')  # Add the parent directory to the Python path

from utils.supabaseSetup import setupTerribleTeddies

def main():
    print("Setting up the database...")
    setupTerribleTeddies()
    print("Database setup complete.")

if __name__ == "__main__":
    main()