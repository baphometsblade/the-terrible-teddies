from .supabaseSetup import supabase
from .teddyGenerator import generateInitialBears

def populateDatabase():
    # Generate and insert initial bears
    generateInitialBears(10)
    
    # Add more population logic here as needed
    print("Database populated with initial data.")