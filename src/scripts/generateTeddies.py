import sys
sys.path.append('../')  # Add the parent directory to the Python path

from utils.teddyGenerator import generateInitialBears

def main():
    print("Generating teddies...")
    bears = generateInitialBears(10)  # Generate 10 bears for testing
    print(f"Generated {len(bears)} teddies.")

if __name__ == "__main__":
    main()