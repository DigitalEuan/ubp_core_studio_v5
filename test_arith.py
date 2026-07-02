import sys
sys.path.insert(0, "./glm_test_dir")
from GLM09_tools import detect_compute, evaluate_numeric
print("detect_compute:", detect_compute("1+1"))
print("evaluate_numeric:", evaluate_numeric(detect_compute("1+1")))
