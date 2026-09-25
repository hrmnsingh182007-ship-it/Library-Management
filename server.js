const http = require('http');
const fs = require('fs');
const path = require('path');

loadEnv(path.join(__dirname, '.env'));

const port = Number(process.env.PORT || 3000);
const students = new Map();
const publicFiles = {
	'/': ['index.html', 'text/html; charset=utf-8'],
	'/index.html': ['index.html', 'text/html; charset=utf-8'],
	'/styles.css': ['styles.css', 'text/css; charset=utf-8'],
	'/script.js': ['script.js', 'text/javascript; charset=utf-8']
};

function loadEnv(filePath) {
	if (!fs.existsSync(filePath)) return;
	for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
		const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
		if (match && !match[1].startsWith('#')) process.env[match[1]] ||= match[2].replace(/^['"]|['"]$/g, '');
	}
}

function sendJson(response, status, data) {
	response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
	response.end(JSON.stringify(data));
}

function readBody(request) {
	return new Promise((resolve, reject) => {
		let body = '';
		request.on('data', chunk => { body += chunk; if (body.length > 100_000) request.destroy(); });
		request.on('end', () => resolve(body));
		request.on('error', reject);
	});
}

function roster() {
	return [...students.entries()].map(([name, enteredAt]) => ({ name, enteredAt }));
}

async function askGroq(message) {
	if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
		return 'Groq is not configured yet. Add your GROQ_API_KEY to the .env file, then restart the server.';
	}

	const context = roster().map(student => student.name).join(', ') || 'nobody';
	const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
		body: JSON.stringify({
			model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
			temperature: 0.3,
			max_tokens: 250,
			messages: [
				{ role: 'system', content: `You are the friendly assistant for ${process.env.LIBRARY_NAME || 'the student library'}. Help students with library entry, exit, occupancy, hours, and basic questions. Current students inside: ${context}. Be concise. Do not claim to have changed entry records.` },
				{ role: 'user', content: message }
			]
		})
	});
	if (!response.ok) throw new Error(`Groq returned ${response.status}`);
	const data = await response.json();
	return data.choices?.[0]?.message?.content || 'I could not generate a response right now.';
}

async function handleChat(message) {
	const parts = message.trim().split(/\s+/);
	const action = parts[0]?.toLowerCase();
	const name = parts.slice(1).join(' ').trim();
	if (action === 'enter') {
		if (!name) return { reply: "Please provide a student's name, such as enter Aisha Khan." };
		if (students.has(name)) return { reply: `${name} is already marked as inside.` };
		students.set(name, new Date().toISOString());
		return { reply: `Welcome, ${name}. Your entry has been recorded.` };
	}
	if (action === 'exit') {
		if (!name) return { reply: "Please provide a student's name, such as exit Aisha Khan." };
		if (!students.has(name)) return { reply: `I could not find an active visit for ${name}.` };
		students.delete(name);
		return { reply: `Goodbye, ${name}. Your exit has been recorded.` };
	}
	if (action === 'status' || action === 'count') return { reply: students.size ? `There are currently ${students.size} student(s) inside.` : 'The library is currently empty.' };
	if (action === 'help') return { reply: 'Try enter Student Name, exit Student Name, or ask me a library question.' };
	return { reply: await askGroq(message) };
}

const server = http.createServer(async (request, response) => {
	try {
		if (request.method === 'POST' && request.url === '/api/chat') {
			const body = JSON.parse(await readBody(request));
			if (typeof body.message !== 'string' || !body.message.trim()) return sendJson(response, 400, { error: 'A message is required.' });
			const result = await handleChat(body.message);
			return sendJson(response, 200, { ...result, students: roster() });
		}
		const file = publicFiles[request.url];
		if (!file) return sendJson(response, 404, { error: 'Not found' });
		response.writeHead(200, { 'Content-Type': file[1] });
		fs.createReadStream(path.join(__dirname, file[0])).pipe(response);
	} catch (error) {
		console.error(error.message);
		sendJson(response, 500, { error: 'The assistant is temporarily unavailable.' });
	}
});

server.listen(port, () => console.log(`Library chatbot running at http://localhost:${port}`));