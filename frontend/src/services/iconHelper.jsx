import React from 'react';
import {
    SiKotlin, SiCsharp, SiRuby, SiC, SiTypescript,
    SiMarkdown, SiRust, SiPhp, SiSwift
} from 'react-icons/si';
import { FiFile } from 'react-icons/fi';

export const getFileIcon = (language) => {
    const iconStyle = { width: '16px', height: '16px', objectFit: 'contain', display: 'block' };
    const reactIconStyle = { fontSize: '14px', display: 'block' };

    const icons = {
        python: <img src="/icons/python.png" alt="python" style={iconStyle} />,
        javascript: <img src="/icons/javascript.png" alt="javascript" style={iconStyle} />,
        typescript: <SiTypescript style={{ ...reactIconStyle, color: '#3178C6' }} />,
        java: <img src="/icons/java.png" alt="java" style={iconStyle} />,
        html: <img src="/icons/html.png" alt="html" style={iconStyle} />,
        css: <img src="/icons/css.png" alt="css" style={iconStyle} />,
        json: '📋',
        markdown: <SiMarkdown style={{ ...reactIconStyle, color: '#000000' }} />,
        c: <SiC style={{ ...reactIconStyle, color: '#A8B9CC' }} />,
        cpp: <img src="/icons/cpp.png" alt="cpp" style={iconStyle} />,
        go: <img src="/icons/go.png" alt="go" style={iconStyle} />,
        rust: <SiRust style={{ ...reactIconStyle, color: '#000000' }} />,
        kotlin: <SiKotlin style={{ ...reactIconStyle, color: '#7F52FF' }} />,
        csharp: <SiCsharp style={{ ...reactIconStyle, color: '#239120' }} />,
        ruby: <SiRuby style={{ ...reactIconStyle, color: '#CC342D' }} />,
        php: <SiPhp style={{ ...reactIconStyle, color: '#777BB4' }} />,
        swift: <SiSwift style={{ ...reactIconStyle, color: '#FA7343' }} />,
        default: <FiFile style={{ ...reactIconStyle, color: 'var(--text-muted)' }} />
    };

    return icons[language.toLowerCase()] || icons.default;
};
