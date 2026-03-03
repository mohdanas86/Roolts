"""
LeetCode-Style Function Mode Runner

Generates test harness code that wraps user's Solution class or standalone function,
runs it against multiple test cases, and reports pass/fail results.

Supports: Python, Java, C++, JavaScript
"""

import re
import json
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


def parse_function_signature(code: str, language: str) -> Optional[Dict[str, Any]]:
    """
    Extract the first public method from a `class Solution` block,
    or a standalone function if no Solution class is found.
    
    Returns: {
        'class_name': 'Solution' or None,
        'func_name': str,
        'params': [{'name': str, 'type': str or None}],
        'return_type': str or None
    }
    """
    language = language.lower()
    
    if language == 'python':
        return _parse_python(code)
    elif language == 'java':
        return _parse_java(code)
    elif language in ('cpp', 'c++', 'c'):
        return _parse_cpp(code)
    elif language in ('javascript', 'js'):
        return _parse_javascript(code)
    
    return None


def _parse_python(code: str) -> Optional[Dict[str, Any]]:
    """Parse Python Solution class or standalone function."""
    # Try class Solution first
    class_match = re.search(r'class\s+Solution', code)
    if class_match:
        # Find the first non-dunder method inside Solution
        method_match = re.search(
            r'def\s+(?!__\w+__)(\w+)\s*\(self(?:,\s*(.+?))?\)\s*(?:->\s*(.+?))?\s*:',
            code[class_match.start():]
        )
        if method_match:
            params = []
            if method_match.group(2):
                for p in method_match.group(2).split(','):
                    p = p.strip()
                    if ':' in p:
                        name, ptype = p.split(':', 1)
                        params.append({'name': name.strip(), 'type': ptype.strip()})
                    else:
                        params.append({'name': p, 'type': None})
            
            return {
                'class_name': 'Solution',
                'func_name': method_match.group(1),
                'params': params,
                'return_type': method_match.group(3).strip() if method_match.group(3) else None
            }
    
    # Try standalone function
    func_match = re.search(
        r'def\s+(\w+)\s*\((.+?)\)\s*(?:->\s*(.+?))?\s*:',
        code
    )
    if func_match:
        params = []
        for p in func_match.group(2).split(','):
            p = p.strip()
            if ':' in p:
                name, ptype = p.split(':', 1)
                params.append({'name': name.strip(), 'type': ptype.strip()})
            else:
                params.append({'name': p, 'type': None})
        
        return {
            'class_name': None,
            'func_name': func_match.group(1),
            'params': params,
            'return_type': func_match.group(3).strip() if func_match.group(3) else None
        }
    
    return None


def _parse_java(code: str) -> Optional[Dict[str, Any]]:
    """Parse Java Solution class method."""
    class_match = re.search(r'class\s+Solution', code)
    if not class_match:
        return None
    
    # Find public method (skip main)
    method_match = re.search(
        r'public\s+(\S+)\s+(?!main\b)(\w+)\s*\(([^)]*)\)',
        code[class_match.start():]
    )
    if method_match:
        params = []
        if method_match.group(3).strip():
            for p in method_match.group(3).split(','):
                p = p.strip()
                parts = p.rsplit(None, 1)
                if len(parts) == 2:
                    params.append({'name': parts[1], 'type': parts[0]})
                else:
                    params.append({'name': p, 'type': None})
        
        return {
            'class_name': 'Solution',
            'func_name': method_match.group(2),
            'params': params,
            'return_type': method_match.group(1)
        }
    
    return None


def _parse_cpp(code: str) -> Optional[Dict[str, Any]]:
    """Parse C++ Solution class method."""
    class_match = re.search(r'class\s+Solution', code)
    if not class_match:
        return None
    
    # Find public method
    method_match = re.search(
        r'(?:public:\s*)?(\S+(?:\s*<[^>]+>)?(?:\s*&)?)\s+(\w+)\s*\(([^)]*)\)',
        code[class_match.start():]
    )
    if method_match:
        # Skip constructors/destructors
        if method_match.group(2) in ('Solution', '~Solution'):
            return None
        
        params = []
        if method_match.group(3).strip():
            for p in method_match.group(3).split(','):
                p = p.strip()
                # Remove default values
                if '=' in p:
                    p = p[:p.index('=')].strip()
                parts = p.rsplit(None, 1)
                if len(parts) == 2:
                    name = parts[1].lstrip('&*')
                    params.append({'name': name, 'type': parts[0]})
                else:
                    params.append({'name': p, 'type': None})
        
        return {
            'class_name': 'Solution',
            'func_name': method_match.group(2),
            'params': params,
            'return_type': method_match.group(1).strip()
        }
    
    return None


def _parse_javascript(code: str) -> Optional[Dict[str, Any]]:
    """Parse JavaScript function or prototype method."""
    # Try `var funcName = function(...)` pattern (LeetCode style)
    lc_match = re.search(r'(?:var|let|const)\s+(\w+)\s*=\s*function\s*\(([^)]*)\)', code)
    if lc_match:
        params = []
        if lc_match.group(2).strip():
            for p in lc_match.group(2).split(','):
                params.append({'name': p.strip(), 'type': None})
        return {
            'class_name': None,
            'func_name': lc_match.group(1),
            'params': params,
            'return_type': None
        }
    
    # Try standalone function
    func_match = re.search(r'function\s+(\w+)\s*\(([^)]*)\)', code)
    if func_match:
        params = []
        if func_match.group(2).strip():
            for p in func_match.group(2).split(','):
                params.append({'name': p.strip(), 'type': None})
        return {
            'class_name': None,
            'func_name': func_match.group(1),
            'params': params,
            'return_type': None
        }
    
    # Try arrow function  
    arrow_match = re.search(r'(?:var|let|const)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>', code)
    if arrow_match:
        params = []
        if arrow_match.group(2).strip():
            for p in arrow_match.group(2).split(','):
                params.append({'name': p.strip(), 'type': None})
        return {
            'class_name': None,
            'func_name': arrow_match.group(1),
            'params': params,
            'return_type': None
        }
    
    return None


# =============================================================================
# Test Harness Generators
# =============================================================================

def generate_test_harness(code: str, language: str, test_cases: List[Dict[str, Any]]) -> Optional[str]:
    """
    Generate runnable code that wraps the user's function with a test runner.
    
    test_cases: [
        {"input": "[2,7,11,15], 9", "expected": "[0,1]"},
        ...
    ]
    
    Returns the full runnable code string, or None if unsupported.
    """
    language = language.lower()
    sig = parse_function_signature(code, language)
    
    if not sig:
        logger.warning(f"Could not parse function signature for {language}")
        return None
    
    if language == 'python':
        return _generate_python_harness(code, sig, test_cases)
    elif language == 'java':
        return _generate_java_harness(code, sig, test_cases)
    elif language in ('cpp', 'c++', 'c'):
        return _generate_cpp_harness(code, sig, test_cases)
    elif language in ('javascript', 'js'):
        return _generate_js_harness(code, sig, test_cases)
    
    return None


def _generate_python_harness(code: str, sig: Dict, test_cases: List[Dict]) -> str:
    """Generate Python test runner with support for ListNode, TreeNode, and primitive types."""
    func_name = sig['func_name']
    is_class = sig.get('class_name') is not None
    params = sig.get('params', [])
    return_type = sig.get('return_type', '') or ''

    # --- Detect which parameter types need conversion ---
    param_types = []
    for p in params:
        ptype = (p.get('type') or '').strip()
        if 'ListNode' in ptype:
            param_types.append('listnode')
        elif 'TreeNode' in ptype:
            param_types.append('treenode')
        else:
            param_types.append('raw')

    # Detect return type
    ret = return_type.lower().replace(' ', '')
    if 'listnode' in ret:
        ret_type = 'listnode'
    elif 'treenode' in ret:
        ret_type = 'treenode'
    else:
        ret_type = 'raw'

    needs_list_helpers = 'listnode' in param_types or ret_type == 'listnode'
    needs_tree_helpers = 'treenode' in param_types or ret_type == 'treenode'

    # --- Build the runner ---
    runner = "from typing import List, Optional, Dict, Tuple, Set\n"
    runner += "from collections import defaultdict, deque, Counter, OrderedDict\n"
    runner += "import math, heapq, bisect, itertools, functools, time, json, sys\n\n"
    runner += "sys.stdout.reconfigure(encoding='utf-8', errors='replace')\n\n"

    # --- Data Structures ---
    runner += "# --- LeetCode Data Structures ---\n"
    runner += "class ListNode:\n"
    runner += "    def __init__(self, x=0, next=None):\n"
    runner += "        self.val = x\n"
    runner += "        self.next = next\n\n"

    runner += "class TreeNode:\n"
    runner += "    def __init__(self, val=0, left=None, right=None):\n"
    runner += "        self.val = val\n"
    runner += "        self.left = left\n"
    runner += "        self.right = right\n\n"

    # --- Conversion Helpers ---
    if needs_list_helpers:
        runner += "def _build_list(arr):\n"
        runner += "    if not arr: return None\n"
        runner += "    if isinstance(arr, ListNode): return arr\n"
        runner += "    head = ListNode(arr[0])\n"
        runner += "    cur = head\n"
        runner += "    for v in arr[1:]:\n"
        runner += "        cur.next = ListNode(v)\n"
        runner += "        cur = cur.next\n"
        runner += "    return head\n\n"

        runner += "def _list_to_arr(node):\n"
        runner += "    res = []\n"
        runner += "    seen = set()\n"
        runner += "    while node and id(node) not in seen:\n"
        runner += "        seen.add(id(node))\n"
        runner += "        res.append(node.val)\n"
        runner += "        node = node.next\n"
        runner += "    return res\n\n"

    if needs_tree_helpers:
        runner += "def _build_tree(arr):\n"
        runner += "    if not arr or arr[0] is None: return None\n"
        runner += "    if isinstance(arr, TreeNode): return arr\n"
        runner += "    root = TreeNode(arr[0])\n"
        runner += "    q = deque([root])\n"
        runner += "    i = 1\n"
        runner += "    while q and i < len(arr):\n"
        runner += "        node = q.popleft()\n"
        runner += "        if i < len(arr) and arr[i] is not None:\n"
        runner += "            node.left = TreeNode(arr[i])\n"
        runner += "            q.append(node.left)\n"
        runner += "        i += 1\n"
        runner += "        if i < len(arr) and arr[i] is not None:\n"
        runner += "            node.right = TreeNode(arr[i])\n"
        runner += "            q.append(node.right)\n"
        runner += "        i += 1\n"
        runner += "    return root\n\n"

        runner += "def _tree_to_arr(root):\n"
        runner += "    if not root: return []\n"
        runner += "    res, q = [], deque([root])\n"
        runner += "    while q:\n"
        runner += "        node = q.popleft()\n"
        runner += "        if node:\n"
        runner += "            res.append(node.val)\n"
        runner += "            q.append(node.left)\n"
        runner += "            q.append(node.right)\n"
        runner += "        else:\n"
        runner += "            res.append(None)\n"
        runner += "    while res and res[-1] is None: res.pop()\n"
        runner += "    return res\n\n"

    # --- User's code ---
    runner += code + "\n\n"

    # --- Test runner ---
    runner += "# === LeetCode Test Runner ===\n"
    if is_class:
        runner += "_sol = Solution()\n"
        call = f"_sol.{func_name}"
    else:
        call = func_name

    runner += f"_test_cases = {json.dumps(test_cases)}\n"
    runner += f"_param_types = {json.dumps(param_types)}\n"
    runner += f"_ret_type = {json.dumps(ret_type)}\n"
    runner += "_passed = 0\n"
    runner += "_failed = 0\n"
    runner += "_results = []\n\n"

    runner += "for _i, _tc in enumerate(_test_cases):\n"
    runner += "    _input_str = _tc.get('input', '')\n"
    runner += "    _expected_str = _tc.get('expected', '')\n"
    runner += "    try:\n"
    runner += "        _args = eval(f'[{_input_str}]')\n"
    runner += "        _expected = eval(_expected_str)\n\n"

    # Apply type conversions to arguments
    runner += "        # Convert args based on detected param types\n"
    runner += "        _converted = []\n"
    runner += "        for _j, _a in enumerate(_args):\n"
    runner += "            _pt = _param_types[_j] if _j < len(_param_types) else 'raw'\n"
    runner += "            if _pt == 'listnode' and isinstance(_a, list):\n"
    runner += "                _converted.append(_build_list(_a))\n"
    runner += "            elif _pt == 'treenode' and isinstance(_a, list):\n"
    runner += "                _converted.append(_build_tree(_a))\n"
    runner += "            else:\n"
    runner += "                _converted.append(_a)\n"
    runner += "        _args = _converted\n\n"

    runner += "        _t0 = time.perf_counter_ns()\n"
    runner += f"        _actual = {call}(*_args)\n"
    runner += "        _elapsed_ms = (time.perf_counter_ns() - _t0) / 1e6\n\n"

    # Convert return value for comparison
    runner += "        # Normalize return value for comparison\n"
    runner += "        if _ret_type == 'listnode' and isinstance(_actual, ListNode):\n"
    runner += "            _actual = _list_to_arr(_actual)\n"
    runner += "            if isinstance(_expected, list): pass  # already a list\n"
    runner += "        elif _ret_type == 'treenode' and isinstance(_actual, TreeNode):\n"
    runner += "            _actual = _tree_to_arr(_actual)\n"
    runner += "            if isinstance(_expected, list): pass\n\n"

    runner += "        _pass = (_actual == _expected)\n"
    runner += "        if _pass:\n"
    runner += "            _passed += 1\n"
    runner += "            print(f'[PASS] Test {_i+1}: PASS  ({_elapsed_ms:.2f}ms)')\n"
    runner += "        else:\n"
    runner += "            _failed += 1\n"
    runner += "            print(f'[FAIL] Test {_i+1}: FAIL  ({_elapsed_ms:.2f}ms)')\n"
    runner += "            print(f'   Input:    {_input_str}')\n"
    runner += "            print(f'   Expected: {_expected}')\n"
    runner += "            print(f'   Actual:   {_actual}')\n"
    runner += "        _results.append({'test': _i+1, 'pass': _pass, 'time_ms': round(_elapsed_ms, 2)})\n"
    runner += "    except Exception as _e:\n"
    runner += "        _failed += 1\n"
    runner += "        print(f'[ERROR] Test {_i+1}: ERROR - {_e}')\n"
    runner += "        _results.append({'test': _i+1, 'pass': False, 'error': str(_e)})\n\n"
    runner += "print(f'\\n=== Results: {_passed}/{_passed+_failed} passed ===')\n"
    runner += "print(json.dumps({'passed': _passed, 'failed': _failed, 'results': _results}))\n"

    return runner


def _generate_java_harness(code: str, sig: Dict, test_cases: List[Dict]) -> str:
    """Generate Java test runner wrapping the Solution class."""
    func_name = sig['func_name']
    return_type = sig.get('return_type', 'Object')
    params = sig.get('params', [])
    
    # Build the main method
    main_code = "\n    // === LeetCode Test Runner ===\n"
    main_code += "    public static void main(String[] args) {\n"
    main_code += "        Solution sol = new Solution();\n"
    main_code += "        int passed = 0, failed = 0;\n\n"
    
    for i, tc in enumerate(test_cases):
        input_str = tc.get('input', '')
        expected_str = tc.get('expected', '')
        main_code += f"        // Test {i+1}\n"
        main_code += "        try {\n"
        main_code += f"            long t0 = System.nanoTime();\n"
        
        # Build call - user must provide Java-parseable expressions
        main_code += f"            {return_type} actual_{i} = sol.{func_name}({input_str});\n"
        main_code += f"            double ms_{i} = (System.nanoTime() - t0) / 1e6;\n"
        
        # Comparison depends on type  
        if 'int' in return_type.lower() or 'long' in return_type.lower() or 'boolean' in return_type.lower() or 'double' in return_type.lower() or 'float' in return_type.lower() or 'char' in return_type.lower():
            main_code += f"            boolean pass_{i} = actual_{i} == {expected_str};\n"
        elif '[]' in return_type:
            main_code += f"            boolean pass_{i} = java.util.Arrays.equals(actual_{i}, {expected_str});\n"
        else:
            main_code += f"            boolean pass_{i} = java.util.Objects.equals(actual_{i}, {expected_str});\n"
        
        main_code += f'            if (pass_{i}) {{ passed++; System.out.println("[PASS] Test {i+1}: PASS  (" + String.format("%.2f", ms_{i}) + "ms)"); }}\n'
        main_code += f'            else {{ failed++; System.out.println("[FAIL] Test {i+1}: FAIL  (" + String.format("%.2f", ms_{i}) + "ms)"); '
        main_code += f'System.out.println("   Expected: " + {expected_str}); '
        main_code += f'System.out.println("   Actual:   " + actual_{i}); }}\n'
        main_code += "        } catch (Exception e) {\n"
        main_code += f'            failed++; System.out.println("[ERROR] Test {i+1}: ERROR - " + e.getMessage());\n'
        main_code += "        }\n\n"
    
    main_code += '        System.out.println("\\n=== Results: " + passed + "/" + (passed+failed) + " passed ===");\n'
    main_code += '        System.out.println("{\\"passed\\": " + passed + ", \\"failed\\": " + failed + "}");\n'
    main_code += "    }\n"
    
    # Insert main method before the last closing brace of the class
    last_brace = code.rfind('}')
    if last_brace != -1:
        return code[:last_brace] + main_code + code[last_brace:]
    
    return code + main_code + "}"


def _generate_cpp_harness(code: str, sig: Dict, test_cases: List[Dict]) -> str:
    """Generate C++ test runner."""
    func_name = sig['func_name']
    return_type = sig.get('return_type', 'auto')
    
    runner = ""
    # Prepend includes only if not already present
    if '#include <iostream>' not in code:
        runner += "#include <iostream>\n"
    if '#include <chrono>' not in code:
        runner += "#include <chrono>\n"
    if '#include <string>' not in code:
        runner += "#include <string>\n"
    if '#include <vector>' not in code:
        runner += "#include <vector>\n"
    if 'using namespace std' not in code:
        runner += "using namespace std;\n"
    runner += "\n" + code + "\n\n"
    runner += "int main() {\n"
    runner += "    Solution sol;\n"
    runner += "    int passed = 0, failed = 0;\n\n"
    
    for i, tc in enumerate(test_cases):
        input_str = tc.get('input', '')
        expected_str = tc.get('expected', '')
        
        runner += f"    // Test {i+1}\n"
        runner += "    {\n"
        runner += "        try {\n"
        runner += "            auto t0 = chrono::high_resolution_clock::now();\n"
        runner += f"            auto actual = sol.{func_name}({input_str});\n"
        runner += "            auto t1 = chrono::high_resolution_clock::now();\n"
        runner += "            double ms = chrono::duration<double, milli>(t1-t0).count();\n"
        runner += f"            auto expected = {expected_str};\n"
        runner += f"            if (actual == expected) {{ passed++; cout << \"[PASS] Test {i+1}: PASS  (\" << ms << \"ms)\" << endl; }}\n"
        runner += f"            else {{ failed++; cout << \"[FAIL] Test {i+1}: FAIL  (\" << ms << \"ms)\" << endl; }}\n"
        runner += "        } catch (const exception& e) {\n"
        runner += f"            failed++; cout << \"[ERROR] Test {i+1}: ERROR - \" << e.what() << endl;\n"
        runner += "        }\n"
        runner += "    }\n\n"
    
    runner += '    cout << "\\n=== Results: " << passed << "/" << (passed+failed) << " passed ===" << endl;\n'
    runner += '    cout << "{\\"passed\\": " << passed << ", \\"failed\\": " << failed << "}" << endl;\n'
    runner += "    return 0;\n"
    runner += "}\n"
    
    return runner


def _generate_js_harness(code: str, sig: Dict, test_cases: List[Dict]) -> str:
    """Generate JavaScript test runner."""
    func_name = sig['func_name']
    
    runner = code + "\n\n"
    runner += "// === LeetCode Test Runner ===\n"
    runner += f"const _testCases = {json.dumps(test_cases)};\n"
    runner += "let _passed = 0, _failed = 0;\n"
    runner += "const _results = [];\n\n"
    runner += "for (let _i = 0; _i < _testCases.length; _i++) {\n"
    runner += "    const _tc = _testCases[_i];\n"
    runner += "    try {\n"
    runner += "        const _args = eval(`[${_tc.input}]`);\n"
    runner += "        const _expected = eval(_tc.expected);\n"
    runner += "        const _t0 = performance.now();\n"
    runner += f"        const _actual = {func_name}(..._args);\n"
    runner += "        const _ms = (performance.now() - _t0).toFixed(2);\n"
    runner += "        const _pass = JSON.stringify(_actual) === JSON.stringify(_expected);\n"
    runner += "        if (_pass) {\n"
    runner += "            _passed++;\n"
    runner += "            console.log(`[PASS] Test ${_i+1}: PASS  (${_ms}ms)`);\n"
    runner += "        } else {\n"
    runner += "            _failed++;\n"
    runner += "            console.log(`[FAIL] Test ${_i+1}: FAIL  (${_ms}ms)`);\n"
    runner += "            console.log(`   Input:    ${_tc.input}`);\n"
    runner += "            console.log(`   Expected: ${JSON.stringify(_expected)}`);\n"
    runner += "            console.log(`   Actual:   ${JSON.stringify(_actual)}`);\n"
    runner += "        }\n"
    runner += "        _results.push({test: _i+1, pass: _pass, time_ms: parseFloat(_ms)});\n"
    runner += "    } catch(_e) {\n"
    runner += "        _failed++;\n"
    runner += "        console.log(`[ERROR] Test ${_i+1}: ERROR - ${_e.message}`);\n"
    runner += "        _results.push({test: _i+1, pass: false, error: _e.message});\n"
    runner += "    }\n"
    runner += "}\n\n"
    runner += "console.log(`\\n=== Results: ${_passed}/${_passed+_failed} passed ===`);\n"
    runner += "console.log(JSON.stringify({passed: _passed, failed: _failed, results: _results}));\n"
    
    return runner
