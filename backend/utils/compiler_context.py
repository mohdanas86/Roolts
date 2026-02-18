
from utils.compiler_manager import RUNTIME_CONFIG, RUNTIMES_DIR
import os

def get_compiler_summary():
    """
    Generates a concise summary of the Roolts compiler/execution environment
    to helps the AI understand what tools are available and how they are configured.
    """
    summary = "## Roolts Internal Execution Environment\n"
    summary += "Roolts uses a portable runtime system to execute code without requiring system-wide installations.\n\n"
    
    summary += "### Supported Languages & Runtimes:\n"
    for lang, config in RUNTIME_CONFIG.items():
        bin_path = config.get('bin_path', '')
        # Only show human-readable info
        execs = ", ".join(config['executables'].keys())
        summary += f"- **{lang.upper()}**: Uses {config.get('zip_name', 'portable runtime')}. Executables: {execs}.\n"
    
    summary += "\n### Security & Limits:\n"
    summary += "- **Execution**: Code is run in separate temporary directories (`roolts_exec_*`) using standard `subprocess`.\n"
    summary += "- **Timeout**: All processes have a hard 60-second timeout.\n"
    summary += "- **Interactive**: Supports real-time I/O via WebSockets (Socket.IO).\n"
    summary += "- **Memory**: Java is specifically limited with `-Xmx64m -Xms32m`.\n"
    summary += "- **Paths**: Portable runtimes are stored in `backend/compiler/`.\n"
    
    return summary
