import urllib.request
import ast

cli_code = urllib.request.urlopen('https://raw.githubusercontent.com/DigitalEuan/UBP_Repo/main/core_studio_v4.0/GLM/GLM12_cli_entry.py').read().decode('utf-8')
print("CLI line 21:", cli_code.splitlines()[20])
