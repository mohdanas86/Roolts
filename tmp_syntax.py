
import os

filepath = r'd:\Roolts-main7\Roolts-main\frontend\src\components\LearningPanel.jsx'
try:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    open_braces = content.count('{')
    close_braces = content.count('}')
    backticks = content.count('`')
    
    # Check for unclosed template literals
    in_backtick = False
    line_num = 1
    col_num = 1
    backtick_pos = []

    for char in content:
        if char == '`':
            in_backtick = not in_backtick
            if in_backtick:
                backtick_pos.append((line_num, col_num))
        if char == '\n':
            line_num += 1
            col_num = 1
        else:
            col_num += 1

    print(f"Open Braces: {open_braces}")
    print(f"Close Braces: {close_braces}")
    print(f"Backticks: {backticks}")
    
    if in_backtick:
        print(f"Warning: Unclosed backtick starting at line {backtick_pos[-1][0]}, column {backtick_pos[-1][1]}")
    
    if open_braces != close_braces:
        print(f"Warning: Mismatched braces! Open: {open_braces}, Close: {close_braces}")

except Exception as e:
    print(f"Error: {e}")
