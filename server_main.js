const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(express.json());

// ── Serve the interactive frontend ──────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend_ui.html'));
});

// ── In-memory store ──────────────────────────────────────
let expenses = [];

function findExpense(id) {
  return expenses.find(e => e.id === id);
}

// ── API Routes ───────────────────────────────────────────

app.get('/api/expenses', (req, res) => {
  const { category } = req.query;
  const result = category
    ? expenses.filter(e => e.category.toLowerCase() === category.toLowerCase())
    : expenses;
  res.json(result);
});

app.get('/api/expenses/summary', (req, res) => {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  res.json({ total: +total.toFixed(2), byCategory, count: expenses.length });
});

app.get('/api/expenses/:id', (req, res) => {
  const expense = findExpense(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  res.json(expense);
});

app.post('/api/expenses', (req, res) => {
  const { title, amount, category, date } = req.body;
  if (!title || amount === undefined || !category) {
    return res.status(400).json({ error: 'title, amount and category are required' });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  const expense = {
    id: uuidv4(),
    title,
    amount,
    category,
    date: date || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };
  expenses.push(expense);
  res.status(201).json(expense);
});

app.put('/api/expenses/:id', (req, res) => {
  const expense = findExpense(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  const { title, amount, category, date } = req.body;
  if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  if (title    !== undefined) expense.title    = title;
  if (amount   !== undefined) expense.amount   = amount;
  if (category !== undefined) expense.category = category;
  if (date     !== undefined) expense.date     = date;
  expense.updatedAt = new Date().toISOString();
  res.json(expense);
});

app.delete('/api/expenses/:id', (req, res) => {
  const index = expenses.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Expense not found' });
  expenses.splice(index, 1);
  res.status(204).send();
});

app.delete('/api/expenses', (req, res) => {
  expenses = [];
  res.status(204).send();
});

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  💸 Expense Tracker running at http://localhost:${PORT}`);
  console.log(`  📡 API available at  http://localhost:${PORT}/api/expenses\n`);
});