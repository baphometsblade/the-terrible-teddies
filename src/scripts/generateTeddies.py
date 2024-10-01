import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.teddyGenerator import generateInitialBears

def main():
    print("Generating teddies...")
    bears = generateInitialBears(10)  # Generate 10 bears for testing
    print(f"Generated {len(bears)} teddies.")

if __name__ == "__main__":
    main()