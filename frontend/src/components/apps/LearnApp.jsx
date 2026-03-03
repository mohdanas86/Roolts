import React, { useState, useCallback, useMemo } from 'react';
import {
    FiBookOpen, FiCode, FiZap, FiStar, FiExternalLink,
    FiChevronRight, FiSearch, FiPlay, FiCopy, FiCheck,
    FiTarget, FiAward, FiTrendingUp, FiGrid, FiArrowLeft
} from 'react-icons/fi';
import { useFileStore, useUIStore } from '../../store';
import { aiService } from '../../services/api';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ── Learning Data ──
const LANGUAGES = [
    { id: 'python', name: 'Python', icon: '🐍', color: '#3776ab', desc: 'General purpose, data science, AI' },
    { id: 'javascript', name: 'JavaScript', icon: '⚡', color: '#f7df1e', desc: 'Web development, full-stack' },
    { id: 'java', name: 'Java', icon: '☕', color: '#ed8b00', desc: 'Enterprise, Android, backend' },
    { id: 'cpp', name: 'C++', icon: '⚙️', color: '#00599c', desc: 'Systems programming, competitive' },
    { id: 'html', name: 'HTML & CSS', icon: '🎨', color: '#e34f26', desc: 'Web design, layouts, styling' },
    { id: 'sql', name: 'SQL', icon: '🗃️', color: '#336791', desc: 'Databases, queries, data' },
    { id: 'rust', name: 'Rust', icon: '🦀', color: '#dea584', desc: 'Systems, safety, performance' },
    { id: 'go', name: 'Go', icon: '🐹', color: '#00add8', desc: 'Cloud, servers, concurrency' },
];

const TOPICS = {
    python: [
        { title: 'Variables & Data Types', difficulty: 'beginner', snippet: '# Variables in Python\nname = "Alice"\nage = 30\nheight = 5.7\nis_student = True\n\nprint(f"{name} is {age} years old")\nprint(f"Height: {height}, Student: {is_student}")' },
        { title: 'Lists & Loops', difficulty: 'beginner', snippet: '# Lists and loops\nfruits = ["apple", "banana", "cherry"]\n\nfor fruit in fruits:\n    print(f"I like {fruit}")\n\n# List comprehension\nsquares = [x**2 for x in range(1, 6)]\nprint(squares)  # [1, 4, 9, 16, 25]' },
        { title: 'Functions', difficulty: 'beginner', snippet: '# Functions with default args\ndef greet(name, greeting="Hello"):\n    return f"{greeting}, {name}!"\n\nprint(greet("Alice"))         # Hello, Alice!\nprint(greet("Bob", "Hi"))     # Hi, Bob!\n\n# Lambda functions\nsquare = lambda x: x ** 2\nprint(square(5))  # 25' },
        { title: 'Dictionaries & Sets', difficulty: 'intermediate', snippet: '# Dictionaries\nstudent = {\n    "name": "Alice",\n    "grades": [90, 85, 92],\n    "courses": {"math", "cs", "physics"}\n}\n\navg = sum(student["grades"]) / len(student["grades"])\nprint(f"{student[\'name\']} average: {avg:.1f}")' },
        { title: 'Classes & OOP', difficulty: 'intermediate', snippet: 'class Animal:\n    def __init__(self, name, sound):\n        self.name = name\n        self.sound = sound\n    \n    def speak(self):\n        return f"{self.name} says {self.sound}!"\n\nclass Dog(Animal):\n    def __init__(self, name):\n        super().__init__(name, "Woof")\n    \n    def fetch(self, item):\n        return f"{self.name} fetches the {item}"\n\ndog = Dog("Rex")\nprint(dog.speak())\nprint(dog.fetch("ball"))' },
        { title: 'File I/O & Error Handling', difficulty: 'intermediate', snippet: 'import json\n\n# Writing JSON\ndata = {"users": [{"name": "Alice", "age": 30}]}\nwith open("data.json", "w") as f:\n    json.dump(data, f, indent=2)\n\n# Reading with error handling\ntry:\n    with open("data.json", "r") as f:\n        loaded = json.load(f)\n        print(loaded["users"][0]["name"])\nexcept FileNotFoundError:\n    print("File not found!")\nexcept json.JSONDecodeError:\n    print("Invalid JSON!")' },
        { title: 'Decorators & Generators', difficulty: 'advanced', snippet: 'import time\n\n# Decorator for timing\ndef timer(func):\n    def wrapper(*args, **kwargs):\n        start = time.time()\n        result = func(*args, **kwargs)\n        print(f"{func.__name__} took {time.time()-start:.4f}s")\n        return result\n    return wrapper\n\n@timer\ndef slow_sum(n):\n    return sum(range(n))\n\n# Generator for Fibonacci\ndef fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        yield a\n        a, b = b, a + b\n\nprint(slow_sum(1000000))\nprint(list(fibonacci(10)))' },
        { title: 'Async / Await', difficulty: 'advanced', snippet: 'import asyncio\n\nasync def fetch_data(name, delay):\n    print(f"Fetching {name}...")\n    await asyncio.sleep(delay)\n    return f"{name}: done in {delay}s"\n\nasync def main():\n    # Run tasks concurrently  \n    results = await asyncio.gather(\n        fetch_data("Users", 2),\n        fetch_data("Posts", 1),\n        fetch_data("Comments", 3)\n    )\n    for r in results:\n        print(r)\n\nasyncio.run(main())' },
    ],
    javascript: [
        { title: 'Variables & Types', difficulty: 'beginner', snippet: '// Modern JS variables\nconst name = "Alice";\nlet age = 30;\n\n// Template literals\nconsole.log(`${name} is ${age} years old`);\n\n// Destructuring\nconst [first, second] = [1, 2];\nconst { x, y } = { x: 10, y: 20 };\nconsole.log(first, second, x, y);' },
        { title: 'Arrays & Methods', difficulty: 'beginner', snippet: '// Array methods\nconst numbers = [1, 2, 3, 4, 5];\n\nconst doubled = numbers.map(n => n * 2);\nconst evens = numbers.filter(n => n % 2 === 0);\nconst sum = numbers.reduce((acc, n) => acc + n, 0);\n\nconsole.log("Doubled:", doubled);\nconsole.log("Evens:", evens);\nconsole.log("Sum:", sum);' },
        { title: 'Promises & Async', difficulty: 'intermediate', snippet: '// Async/Await\nconst fetchUser = async (id) => {\n    const response = await fetch(\n        `https://jsonplaceholder.typicode.com/users/${id}`\n    );\n    return response.json();\n};\n\nconst main = async () => {\n    try {\n        const user = await fetchUser(1);\n        console.log(`User: ${user.name}`);\n        console.log(`Email: ${user.email}`);\n    } catch (err) {\n        console.error("Failed:", err.message);\n    }\n};\n\nmain();' },
        { title: 'Classes & Modules', difficulty: 'intermediate', snippet: '// ES6 Classes\nclass EventEmitter {\n    #listeners = new Map();\n    \n    on(event, callback) {\n        if (!this.#listeners.has(event)) {\n            this.#listeners.set(event, []);\n        }\n        this.#listeners.get(event).push(callback);\n        return this;\n    }\n    \n    emit(event, ...args) {\n        const callbacks = this.#listeners.get(event) || [];\n        callbacks.forEach(cb => cb(...args));\n    }\n}\n\nconst emitter = new EventEmitter();\nemitter.on("greet", name => console.log(`Hello ${name}!`));\nemitter.emit("greet", "World");' },
    ],
    java: [
        { title: 'Hello World & Basics', difficulty: 'beginner', snippet: 'public class Main {\n    public static void main(String[] args) {\n        String name = "Alice";\n        int age = 30;\n        double gpa = 3.95;\n        \n        System.out.printf("%s is %d, GPA: %.2f%n", name, age, gpa);\n        \n        // Enhanced for loop\n        int[] nums = {1, 2, 3, 4, 5};\n        for (int n : nums) {\n            System.out.print(n + " ");\n        }\n    }\n}' },
        { title: 'OOP & Interfaces', difficulty: 'intermediate', snippet: 'interface Drawable {\n    void draw();\n    default String getType() { return "Shape"; }\n}\n\nabstract class Shape implements Drawable {\n    protected String color;\n    Shape(String color) { this.color = color; }\n    abstract double area();\n}\n\nclass Circle extends Shape {\n    private double radius;\n    Circle(String color, double radius) {\n        super(color);\n        this.radius = radius;\n    }\n    double area() { return Math.PI * radius * radius; }\n    public void draw() {\n        System.out.printf("Drawing %s circle (area=%.2f)%n", color, area());\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Circle c = new Circle("red", 5.0);\n        c.draw();\n    }\n}' },
    ],
    cpp: [
        { title: 'STL Containers', difficulty: 'intermediate', snippet: '#include <iostream>\n#include <vector>\n#include <map>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    vector<int> nums = {5, 3, 8, 1, 9};\n    sort(nums.begin(), nums.end());\n    \n    cout << "Sorted: ";\n    for (int n : nums) cout << n << " ";\n    cout << endl;\n    \n    map<string, int> scores;\n    scores["Alice"] = 95;\n    scores["Bob"] = 87;\n    \n    for (auto& [name, score] : scores) {\n        cout << name << ": " << score << endl;\n    }\n    return 0;\n}' },
    ],
    html: [
        { title: 'Responsive Layout', difficulty: 'beginner', snippet: '<!DOCTYPE html>\n<html>\n<head>\n<style>\n  .container {\n    display: grid;\n    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n    gap: 16px;\n    padding: 20px;\n  }\n  .card {\n    background: linear-gradient(135deg, #667eea, #764ba2);\n    color: white;\n    padding: 24px;\n    border-radius: 12px;\n    box-shadow: 0 4px 15px rgba(0,0,0,0.2);\n  }\n</style>\n</head>\n<body>\n  <div class="container">\n    <div class="card"><h3>Card 1</h3><p>Responsive grid</p></div>\n    <div class="card"><h3>Card 2</h3><p>Auto-fit layout</p></div>\n    <div class="card"><h3>Card 3</h3><p>Modern CSS</p></div>\n  </div>\n</body>\n</html>' },
    ],
    sql: [
        { title: 'Queries & Joins', difficulty: 'beginner', snippet: '-- Create tables\nCREATE TABLE users (\n    id INT PRIMARY KEY,\n    name VARCHAR(100),\n    email VARCHAR(200)\n);\n\nCREATE TABLE orders (\n    id INT PRIMARY KEY,\n    user_id INT REFERENCES users(id),\n    product VARCHAR(100),\n    amount DECIMAL(10,2)\n);\n\n-- Join query with aggregation\nSELECT \n    u.name,\n    COUNT(o.id) AS total_orders,\n    SUM(o.amount) AS total_spent\nFROM users u\nLEFT JOIN orders o ON u.id = o.user_id\nGROUP BY u.name\nHAVING SUM(o.amount) > 100\nORDER BY total_spent DESC;' },
    ],
    rust: [
        { title: 'Ownership & Borrowing', difficulty: 'intermediate', snippet: 'fn main() {\n    // Ownership\n    let s1 = String::from("hello");\n    let s2 = s1.clone(); // Deep copy\n    println!("s1 = {}, s2 = {}", s1, s2);\n\n    // Borrowing\n    let s3 = String::from("world");\n    let len = calculate_length(&s3);\n    println!("{} has {} chars", s3, len);\n\n    // Pattern matching\n    let result: Result<i32, &str> = Ok(42);\n    match result {\n        Ok(val) => println!("Success: {}", val),\n        Err(e) => println!("Error: {}", e),\n    }\n}\n\nfn calculate_length(s: &String) -> usize {\n    s.len()\n}' },
    ],
    go: [
        { title: 'Goroutines & Channels', difficulty: 'intermediate', snippet: 'package main\n\nimport (\n    "fmt"\n    "time"\n)\n\nfunc worker(id int, ch chan<- string) {\n    time.Sleep(time.Duration(id) * 100 * time.Millisecond)\n    ch <- fmt.Sprintf("Worker %d done", id)\n}\n\nfunc main() {\n    ch := make(chan string, 5)\n    \n    for i := 1; i <= 5; i++ {\n        go worker(i, ch)\n    }\n    \n    for i := 0; i < 5; i++ {\n        msg := <-ch\n        fmt.Println(msg)\n    }\n}' },
    ],
};

const RESOURCES = [
    { name: 'MDN Web Docs', url: 'https://developer.mozilla.org', lang: 'javascript', cat: 'docs' },
    { name: 'Python Docs', url: 'https://docs.python.org/3/', lang: 'python', cat: 'docs' },
    { name: 'LeetCode', url: 'https://leetcode.com', lang: 'all', cat: 'practice' },
    { name: 'HackerRank', url: 'https://hackerrank.com', lang: 'all', cat: 'practice' },
    { name: 'freeCodeCamp', url: 'https://freecodecamp.org', lang: 'all', cat: 'courses' },
    { name: 'Exercism', url: 'https://exercism.org', lang: 'all', cat: 'practice' },
    { name: 'Rust Book', url: 'https://doc.rust-lang.org/book/', lang: 'rust', cat: 'docs' },
    { name: 'Go Tour', url: 'https://go.dev/tour/', lang: 'go', cat: 'docs' },
    { name: 'Java Tutorials', url: 'https://docs.oracle.com/javase/tutorial/', lang: 'java', cat: 'docs' },
    { name: 'CSS-Tricks', url: 'https://css-tricks.com', lang: 'html', cat: 'docs' },
    { name: 'Codecademy', url: 'https://codecademy.com', lang: 'all', cat: 'courses' },
    { name: 'W3Schools', url: 'https://w3schools.com', lang: 'all', cat: 'courses' },
];

function LearnApp({ onClose }) {
    const [selectedLang, setSelectedLang] = useState(null);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedIdx, setCopiedIdx] = useState(-1);
    const [aiExplanation, setAiExplanation] = useState('');
    const [isExplaining, setIsExplaining] = useState(false);
    const { addFile } = useFileStore();
    const { addNotification } = useUIStore();

    const filteredResources = useMemo(() => {
        return RESOURCES.filter(r => {
            const matchLang = !selectedLang || r.lang === 'all' || r.lang === selectedLang;
            const matchSearch = !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchLang && matchSearch;
        });
    }, [selectedLang, searchQuery]);

    const copyCode = useCallback((code, idx) => {
        navigator.clipboard.writeText(code);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(-1), 2000);
    }, []);

    const openInEditor = useCallback((topic, lang) => {
        const extMap = { python: 'py', javascript: 'js', java: 'java', cpp: 'cpp', html: 'html', sql: 'sql', rust: 'rs', go: 'go' };
        const ext = extMap[lang] || 'txt';
        const fileName = `${topic.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.${ext}`;
        addFile(fileName, topic.snippet, lang);
        addNotification({ type: 'success', message: `Opened "${topic.title}" in editor` });
    }, [addFile, addNotification]);

    const explainWithAI = useCallback(async (topic, lang) => {
        if (isExplaining) return;
        setIsExplaining(true);
        setAiExplanation('');
        try {
            const response = await aiService.chat(
                `Explain this ${lang} code step by step in a beginner-friendly way. Use simple language.\n\nCode:\n\`\`\`${lang}\n${topic.snippet}\n\`\`\``,
                lang, topic.snippet
            );
            const data = response.data || response;
            setAiExplanation(data.response || data.content || 'No explanation received.');
        } catch (err) {
            setAiExplanation('Could not get AI explanation. Please check your AI settings.');
        }
        setIsExplaining(false);
    }, [isExplaining]);

    const getDifficultyStyle = (diff) => {
        const styles = {
            beginner: { bg: 'rgba(81, 207, 102, 0.15)', color: '#51cf66', label: '🌱 Beginner' },
            intermediate: { bg: 'rgba(255, 212, 59, 0.15)', color: '#ffd43b', label: '🔥 Intermediate' },
            advanced: { bg: 'rgba(255, 107, 107, 0.15)', color: '#ff6b6b', label: '⚡ Advanced' }
        };
        return styles[diff] || styles.beginner;
    };

    // ── Topic Detail View ──
    if (selectedTopic && selectedLang) {
        const langData = LANGUAGES.find(l => l.id === selectedLang);
        const topic = selectedTopic;
        const diffStyle = getDifficultyStyle(topic.difficulty);

        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                {/* Header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => { setSelectedTopic(null); setAiExplanation(''); }} style={backBtnStyle}>
                        <FiArrowLeft size={14} /> Back
                    </button>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{langData?.icon} {topic.title}</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: diffStyle.bg, color: diffStyle.color }}>{diffStyle.label}</span>
                </div>

                {/* Code Snippet */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                    <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{langData?.name}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => copyCode(topic.snippet, -2)} style={iconBtnStyle}>
                                    {copiedIdx === -2 ? <FiCheck size={13} color="#51cf66" /> : <FiCopy size={13} />}
                                </button>
                                <button onClick={() => openInEditor(topic, selectedLang)} style={{ ...iconBtnStyle, color: '#4dabf7' }} title="Open in Editor">
                                    <FiPlay size={13} />
                                </button>
                            </div>
                        </div>
                        <SyntaxHighlighter language={selectedLang === 'cpp' ? 'cpp' : selectedLang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '16px', fontSize: '13px', background: '#1a1a2e' }}>
                            {topic.snippet}
                        </SyntaxHighlighter>
                    </div>

                    {/* AI Explain Button */}
                    <button
                        onClick={() => explainWithAI(topic, selectedLang)}
                        disabled={isExplaining}
                        style={{
                            width: '100%', padding: '10px', marginBottom: '16px',
                            background: isExplaining ? 'var(--bg-secondary)' : 'linear-gradient(135deg, #4dabf7, #748ffc)',
                            color: '#fff', border: 'none', borderRadius: '8px', cursor: isExplaining ? 'wait' : 'pointer',
                            fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        <FiZap size={14} />
                        {isExplaining ? 'AI is thinking...' : 'Explain with AI'}
                    </button>

                    {/* AI Explanation */}
                    {aiExplanation && (
                        <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)', fontSize: '13px', lineHeight: 1.6 }}>
                            <ReactMarkdown
                                components={{
                                    code({ node, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return match ? (
                                            <SyntaxHighlighter language={match[1]} style={vscDarkPlus} customStyle={{ borderRadius: '6px', fontSize: '12px' }}>
                                                {String(children).replace(/\n$/, '')}
                                            </SyntaxHighlighter>
                                        ) : (
                                            <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }} {...props}>{children}</code>
                                        );
                                    }
                                }}
                            >
                                {aiExplanation}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Language Topics View ──
    if (selectedLang) {
        const langData = LANGUAGES.find(l => l.id === selectedLang);
        const topics = TOPICS[selectedLang] || [];

        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => setSelectedLang(null)} style={backBtnStyle}>
                        <FiArrowLeft size={14} /> Back
                    </button>
                    <span style={{ fontSize: '16px' }}>{langData?.icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{langData?.name} Tutorials</span>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                    {['beginner', 'intermediate', 'advanced'].map(level => {
                        const levelTopics = topics.filter(t => t.difficulty === level);
                        if (levelTopics.length === 0) return null;
                        const diffStyle = getDifficultyStyle(level);

                        return (
                            <div key={level} style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: diffStyle.color, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {diffStyle.label} ({levelTopics.length})
                                </div>
                                {levelTopics.map((topic, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedTopic(topic)}
                                        style={{
                                            padding: '12px 14px', marginBottom: '6px',
                                            background: 'var(--bg-secondary)', borderRadius: '8px',
                                            border: '1px solid var(--border-primary)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                                            justifyContent: 'space-between', transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = langData?.color || '#4dabf7'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-primary)'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <FiCode size={14} color={langData?.color} />
                                            <span style={{ fontSize: '13px', fontWeight: 500 }}>{topic.title}</span>
                                        </div>
                                        <FiChevronRight size={14} color="var(--text-secondary)" />
                                    </div>
                                ))}
                            </div>
                        );
                    })}

                    {/* Resources for this language */}
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-primary)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            📚 Resources
                        </div>
                        {filteredResources.map((res, idx) => (
                            <a
                                key={idx} href={res.url} target="_blank" rel="noopener noreferrer"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 12px', marginBottom: '4px', borderRadius: '6px',
                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                    textDecoration: 'none', fontSize: '13px', transition: 'all 0.15s'
                                }}
                            >
                                <FiExternalLink size={12} color="#4dabf7" />
                                <span>{res.name}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: 'auto', textTransform: 'uppercase' }}>{res.cat}</span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── Main Language Selection View ──
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            {/* Header */}
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <FiBookOpen size={18} color="#4dabf7" />
                    <span style={{ fontSize: '16px', fontWeight: 700 }}>Learn to Code</span>
                </div>
                <div style={{ position: 'relative' }}>
                    <FiSearch size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search resources..."
                        style={{
                            width: '100%', padding: '8px 12px 8px 32px',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                            borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                        }}
                    />
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                {/* Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                    <div style={statBoxStyle}>
                        <FiTarget size={16} color="#4dabf7" />
                        <div>
                            <div style={{ fontSize: '18px', fontWeight: 700 }}>{Object.values(TOPICS).flat().length}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tutorials</div>
                        </div>
                    </div>
                    <div style={statBoxStyle}>
                        <FiGrid size={16} color="#51cf66" />
                        <div>
                            <div style={{ fontSize: '18px', fontWeight: 700 }}>{LANGUAGES.length}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Languages</div>
                        </div>
                    </div>
                </div>

                {/* Language Cards */}
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Choose a Language
                </div>
                {LANGUAGES.map((lang) => {
                    const topicCount = (TOPICS[lang.id] || []).length;
                    return (
                        <div
                            key={lang.id}
                            onClick={() => setSelectedLang(lang.id)}
                            style={{
                                padding: '14px', marginBottom: '8px',
                                background: 'var(--bg-secondary)', borderRadius: '10px',
                                border: '1px solid var(--border-primary)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = lang.color; e.currentTarget.style.transform = 'translateX(4px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.transform = 'none'; }}
                        >
                            <span style={{ fontSize: '24px' }}>{lang.icon}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: 600 }}>{lang.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{lang.desc}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{topicCount} topics</span>
                                <FiChevronRight size={14} color="var(--text-secondary)" />
                            </div>
                        </div>
                    );
                })}

                {/* Top Resources */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🌐 Practice Platforms
                    </div>
                    {RESOURCES.filter(r => r.cat === 'practice').map((res, idx) => (
                        <a
                            key={idx} href={res.url} target="_blank" rel="noopener noreferrer"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 12px', marginBottom: '4px', borderRadius: '6px',
                                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                textDecoration: 'none', fontSize: '13px', transition: 'background 0.15s',
                                border: '1px solid transparent'
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-primary)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                        >
                            <FiExternalLink size={12} color="#4dabf7" />
                            <span style={{ fontWeight: 500 }}>{res.name}</span>
                            <FiChevronRight size={12} style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }} />
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Shared Styles ──
const backBtnStyle = {
    display: 'flex', alignItems: 'center', gap: '4px',
    background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)', borderRadius: '6px', padding: '4px 10px',
    cursor: 'pointer', fontSize: '12px'
};

const iconBtnStyle = {
    background: 'transparent', border: 'none',
    color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px',
    borderRadius: '4px', display: 'flex', alignItems: 'center'
};

const statBoxStyle = {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '12px', background: 'var(--bg-secondary)',
    borderRadius: '8px', border: '1px solid var(--border-primary)'
};

export default LearnApp;
