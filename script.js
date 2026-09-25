const messages = document.querySelector('#messages');
const input = document.querySelector('#message-input');

function addMessage(text, from = 'bot') {
	const row = document.createElement('div');
	row.className = 'message';
	if (from === 'bot') row.innerHTML = `<span class="avatar">CC</span><div><p>${text}</p><time>Just now</time></div>`;
	else { row.innerHTML = `<div><p>${text}</p></div>`; row.style.justifyContent = 'flex-end'; row.querySelector('p').style.background = '#173f35'; row.querySelector('p').style.color = '#fff'; }
	messages.appendChild(row);
	messages.scrollTop = messages.scrollHeight;
}

function renderRoster(roster = []) {
	const rosterElement = document.querySelector('#roster-list');
	document.querySelector('#inside-count').textContent = roster.length;
	document.querySelector('#available-seats').textContent = 120 - roster.length;
	document.querySelector('#roster-count').textContent = roster.length;
	if (!roster.length) { rosterElement.innerHTML = '<div class="empty"><span>✦</span><p>No students inside yet.</p><small>New arrivals will appear here.</small></div>'; return; }
	rosterElement.innerHTML = roster.map(student => `<div class="student"><div><span class="student-name">${student.name}</span><span class="student-time">Entered ${new Date(student.enteredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><button class="exit" data-name="${student.name}">Check out</button></div>`).join('');
	rosterElement.querySelectorAll('.exit').forEach(button => button.addEventListener('click', () => handleCommand(`exit ${button.dataset.name}`)));
}

async function handleCommand(raw) {
	const command = raw.trim();
	if (!command) return;
	addMessage(command, 'user');
	try {
		const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: command }) });
		const data = await response.json();
		addMessage(data.reply || data.error || 'The assistant could not respond.');
		if (data.students) renderRoster(data.students);
	} catch (_) { addMessage('The server is not running. Start it with <b>npm start</b>.'); }
}

document.querySelector('#chat-form').addEventListener('submit', event => { event.preventDefault(); handleCommand(input.value); input.value = ''; input.focus(); });
document.querySelector('#status-button').addEventListener('click', () => handleCommand('status'));
document.querySelectorAll('.quick').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.value; input.focus(); }));
function updateClock() { const now = new Date(); document.querySelector('#clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); document.querySelector('#today').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }); }
updateClock(); setInterval(updateClock, 1000); renderRoster([]);
