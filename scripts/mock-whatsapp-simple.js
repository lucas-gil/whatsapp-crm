const http = require('http');
const url = require('url');

const conversations = new Map();

function makeId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const method = req.method || 'GET';
  if (method === 'POST' && parsed.pathname === '/whatsapp/send-text') {
    try {
      const raw = await collectRequestBody(req);
      const data = raw ? JSON.parse(raw) : {};
      const { to, text } = data;
      if (!to || !text) return sendJson(res, 400, { error: 'to and text required' });
      const convoId = makeId('convo');
      const messageId = makeId('msg');
      const timestamp = Date.now();
      const message = {
        id: messageId,
        text,
        type: 'text',
        direction: 'OUTGOING',
        status: 'SENT',
        createdAt: new Date(timestamp).toISOString(),
        attachments: [],
      };
      conversations.set(convoId, { id: convoId, leadId: null, groupId: null, messages: [message] });
      console.log('mock: send-text', { to, text, convoId, messageId });
      return sendJson(res, 200, { conversationId: convoId, messageId, timestamp });
    } catch (e) {
      return sendJson(res, 500, { error: 'invalid json' });
    }
  }

  if (method === 'GET' && parsed.pathname === '/crm/conversations') {
    const list = Array.from(conversations.values()).map((c) => ({ id: c.id, leadId: c.leadId, groupId: c.groupId, messages: c.messages.slice().reverse() }));
    return sendJson(res, 200, list);
  }

  const match = parsed.pathname && parsed.pathname.match(/^\/crm\/conversations\/(.+)$/);
  if (method === 'GET' && match) {
    const id = match[1];
    const convo = conversations.get(id);
    if (!convo) return sendJson(res, 404, { error: 'Not found' });
    return sendJson(res, 200, { id: convo.id, messages: convo.messages });
  }

  // fallback
  sendJson(res, 404, { error: 'not found' });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Mock WhatsApp simple server running on http://localhost:${port}`));
