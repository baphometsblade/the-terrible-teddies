import sys
sys.path.append('../')  # Add the parent directory to the Python path

from utils.assetGenerator import generateAllAssets

def main():
    print("Generating assets...")
    assets = generateAllAssets()
    print(f"Generated {len(assets)} assets.")

if __name__ == "__main__":
    main()