import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.assetGenerator import generateAllAssets

def main():
    print("Generating assets...")
    assets = generateAllAssets()
    print(f"Generated {len(assets)} assets.")

if __name__ == "__main__":
    main()