import urllib.request
code = """
import os
print("FILE IS:", __file__)
"""
g = globals().copy()
g["__file__"] = "test.py"
try:
    exec(code, g)
except Exception as e:
    import traceback
    traceback.print_exc()
