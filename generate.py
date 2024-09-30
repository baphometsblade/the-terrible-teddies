import subprocess
import os

def run_script(script_name):
    print(f"Running {script_name}...")
    result = subprocess.run(['python', f'src/scripts/{script_name}'], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error running {script_name}:")
        print(result.stderr)
    else:
        print(f"{script_name} completed successfully.")
    print("\n")

def main():
    scripts = [
        'setupDatabase.py',
        'generateTeddies.py',
        'generateAssets.py',
        'populateDatabase.py',
        'generateTeddyImages.py'
    ]

    for script in scripts:
        run_script(script)

    print("All scripts have been executed.")

if __name__ == "__main__":
    main()