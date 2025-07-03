const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'game')));

const scoresFile = path.join(__dirname, 'scores.json');
let scores = [];

if (fs.existsSync(scoresFile)) {
  try {
    scores = JSON.parse(fs.readFileSync(scoresFile));
  } catch (err) {
    console.error('Failed to read scores file', err);
  }
}

app.get('/api/scores', (req, res) => {
  res.json(scores);
});

app.post('/api/scores', (req, res) => {
  const { name, score } = req.body;
  if (typeof name === 'string' && typeof score === 'number') {
    const entry = { name, score, date: new Date().toISOString() };
    scores.push(entry);
    fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 2));
    res.status(201).json(entry);
  } else {
    res.status(400).json({ error: 'Invalid input' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
