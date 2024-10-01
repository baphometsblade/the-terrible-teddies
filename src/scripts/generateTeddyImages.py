import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.imageGenerator import generateTeddyImages

def main():
    print("Generating teddy images...")
    images = generateTeddyImages()
    print(f"Generated {len(images)} teddy images.")

if __name__ == "__main__":
    main()