// --- ROOLTS NETWORK DIAGNOSTIC ---
// Run this in your browser console (F12 > Console) to see what's failing.

console.clear();
console.log("%c Starting Roolts Network Diagnostic...", "font-weight: bold; font-size: 16px; color: #3b82f6;");

async function check(url) {
    try {
        console.log(`Checking ${url}...`);
        const start = Date.now();
        const res = await fetch(url);
        const time = Date.now() - start;
        console.log(`%c [OK] ${url} responded with ${res.status} in ${time}ms`, "color: #10b981;");
    } catch (e) {
        console.log(`%c [FAIL] ${url} failed: ${e.message}`, "color: #ef4444; font-weight: bold;");
        if (e.message.includes('Failed to fetch')) {
            console.log("   -> This usually means CORS is blocked or the server is down.");
        }
    }
}

// Check local health endpoints
check('/api/health');
check('/api/executor/health');
check('http://127.0.0.1:5000/api/health'); // Direct call

console.log("%c Diagnostic finished. See results above.", "font-style: italic;");
