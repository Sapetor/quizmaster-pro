#!/usr/bin/env python3
import re

# Read the HTML file
with open('/Users/apeters/quizmaster-pro/public/index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Extract all data-translate attributes
translate_pattern = r'data-translate="([^"]+)"'
translate_matches = re.findall(translate_pattern, html_content)

# Extract all data-translate-placeholder attributes
placeholder_pattern = r'data-translate-placeholder="([^"]+)"'
placeholder_matches = re.findall(placeholder_pattern, html_content)

# Combine and sort
all_keys = set(translate_matches + placeholder_matches)
sorted_keys = sorted(all_keys)

print("All data-translate keys found in HTML:")
for key in sorted_keys:
    print(f"  {key}")

print(f"\nTotal: {len(sorted_keys)} unique keys")

# Now let's check the translation file for available keys
print("\nChecking script.js for translation keys...")

# Read the script.js file
with open('/Users/apeters/quizmaster-pro/public/script.js', 'r', encoding='utf-8') as f:
    script_content = f.read()

# Extract English translation keys
en_pattern = r'en:\s*{([^}]+)}'
en_match = re.search(en_pattern, script_content, re.DOTALL)
if en_match:
    en_content = en_match.group(1)
    en_keys = re.findall(r'(\w+):', en_content)
    
    print(f"English translation keys found: {len(en_keys)}")
    
    # Find missing keys
    missing_keys = []
    for key in sorted_keys:
        if key not in en_keys:
            missing_keys.append(key)
    
    if missing_keys:
        print(f"\nMissing translation keys ({len(missing_keys)}):")
        for key in missing_keys:
            print(f"  {key}")
    else:
        print("\nAll HTML keys have corresponding English translations!")

# Extract Spanish translation keys
es_pattern = r'es:\s*{([^}]+)}'
es_match = re.search(es_pattern, script_content, re.DOTALL)
if es_match:
    es_content = es_match.group(1)
    es_keys = re.findall(r'(\w+):', es_content)
    
    print(f"\nSpanish translation keys found: {len(es_keys)}")
    
    # Find missing keys
    missing_es_keys = []
    for key in sorted_keys:
        if key not in es_keys:
            missing_es_keys.append(key)
    
    if missing_es_keys:
        print(f"\nMissing Spanish translation keys ({len(missing_es_keys)}):")
        for key in missing_es_keys:
            print(f"  {key}")
    else:
        print("\nAll HTML keys have corresponding Spanish translations!")

# Extract Polish translation keys
pl_pattern = r'pl:\s*{([^}]+)}'
pl_match = re.search(pl_pattern, script_content, re.DOTALL)
if pl_match:
    pl_content = pl_match.group(1)
    pl_keys = re.findall(r'(\w+):', pl_content)
    
    print(f"\nPolish translation keys found: {len(pl_keys)}")
    
    # Find missing keys
    missing_pl_keys = []
    for key in sorted_keys:
        if key not in pl_keys:
            missing_pl_keys.append(key)
    
    if missing_pl_keys:
        print(f"\nMissing Polish translation keys ({len(missing_pl_keys)}):")
        for key in missing_pl_keys:
            print(f"  {key}")
    else:
        print("\nAll HTML keys have corresponding Polish translations!")