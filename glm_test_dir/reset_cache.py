import sys

# List of your modules to clear from memory
modules_to_clear = [
    'GLM00_config', 
    'GLM01_substrate', 
    'GLM02_constants', 
    'GLM03_crg',
    'GLM04_number_vocab',
    'GLM05_idea_evidence',
    'GLM06_idea_zone',
    'GLM07_idea_manager',
    'GLM08_idea_meta_graph',
    'GLM09_tools',
    'GLM10_response_composer',
    'GLM11_runtime',
    'GLM12_cli_entry',
    'GLM13_deliberative_reasoning'
]

for module in modules_to_clear:
    if module in sys.modules:
        del sys.modules[module]
        print(f"Cleared {module} from memory.")

print("✅ Cache cleared. You can now run scripts.")