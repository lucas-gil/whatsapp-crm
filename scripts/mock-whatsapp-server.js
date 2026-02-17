const express = require('express');
const multer = require('multer');
const upload = multer();
const app = express();
app.use(express.json());

const conversations = new Map();

function makeId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

app.post('/whatsapp/send-text', (req, res) => {
  const { to, text } = req.body || {};
  if (!to || !text) return res.status(400).json({ error: 'to and text required' });
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
  res.json({ conversationId: convoId, messageId, timestamp });
});

app.post('/whatsapp/send-media', upload.single('file'), (req, res) => {
  const to = req.body.to;
  const caption = req.body.caption || '';
  if (!to || !req.file) return res.status(400).json({ error: 'to and file required' });
  const convoId = makeId('convo');
  const messageId = makeId('msg');
  const timestamp = Date.now();
  const message = {
    id: messageId,
    text: caption || `[Arquivo] ${req.file.originalname}`,
    type: 'media',
    direction: 'OUTGOING',
    status: 'SENT',
    createdAt: new Date(timestamp).toISOString(),
    attachments: [{ fileName: req.file.originalname }],
  };
  conversations.set(convoId, { id: convoId, leadId: null, groupId: null, messages: [message] });
  console.log('mock: send-media', { to, file: req.file.originalname, convoId, messageId });
  res.json({ conversationId: convoId, messageId, timestamp });
});

app.get('/crm/conversations', (req, res) => {
  const list = Array.from(conversations.values()).map((c) => ({ id: c.id, leadId: c.leadId, groupId: c.groupId, messages: c.messages.slice().reverse() }));
  res.json(list);
});

app.get('/crm/conversations/:id', (req, res) => {
  const id = req.params.id;
  const convo = conversations.get(id);
  if (!convo) return res.status(404).json({ error: 'Not found' });
  res.json({ id: convo.id, messages: convo.messages });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Mock WhatsApp server running on http://localhost:${port}`));
