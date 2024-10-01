import sys
sys.path.append('../')  # Add the parent directory to the Python path

from utils.imageGenerator import generateTeddyImages

def main():
    print("Generating teddy images...")
    images = generateTeddyImages()
    print(f"Generated {len(images)} teddy images.")

if __name__ == "__main__":
    main()