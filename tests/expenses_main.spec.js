// expenses_main.spec.js — tests for server_main.js
// Run with: npx playwright test expenses_main.spec.js --headed

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const API  = `${BASE}/api/expenses`;

// ── Reset store before each test ─────────────────────────
test.beforeEach(async ({ request }) => {
  await request.delete(API);
});


// ════════════════════════════════════════════════════════
//  UI TESTS  (browser)
// ════════════════════════════════════════════════════════

test.describe('UI', () => {

  test('homepage loads correctly', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle('Expense Tracker');
    await expect(page.locator('h1')).toContainText('expense');
    await expect(page.locator('#add-btn')).toBeVisible();
  });

  test('shows empty state when no expenses', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('#expense-list')).toContainText('No expenses yet');
  });

  test('stats start at zero', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('#stat-total')).toContainText('0');
    await expect(page.locator('#stat-count')).toContainText('0');
  });

  test('adds an expense via the form', async ({ page }) => {
    await page.goto(BASE);

    await page.fill('#f-title',  'Morning Coffee');
    await page.fill('#f-amount', '80');
    await page.selectOption('#f-category', 'food');
    await page.click('#add-btn');

    // toast appears
    await expect(page.locator('#toast')).toContainText('Morning Coffee');

    // expense appears in list
    await expect(page.locator('#expense-list')).toContainText('Morning Coffee');
  });

  test('stats update after adding expense', async ({ page }) => {
    await page.goto(BASE);

    await page.fill('#f-title',  'Bus ticket');
    await page.fill('#f-amount', '25');
    await page.selectOption('#f-category', 'transport');
    await page.click('#add-btn');

    await expect(page.locator('#stat-count')).toContainText('1');
    await expect(page.locator('#stat-total')).toContainText('25');
  });

  test('adds expense using Enter key', async ({ page }) => {
    await page.goto(BASE);

    await page.fill('#f-title',  'Gym session');
    await page.fill('#f-amount', '500');
    await page.press('#f-amount', 'Enter');

    await expect(page.locator('#expense-list')).toContainText('Gym session');
  });

  test('shows error toast for empty title', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('#f-amount', '100');
    await page.click('#add-btn');
    await expect(page.locator('#toast')).toContainText('Please enter a title');
  });

  test('shows error toast for invalid amount', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('#f-title', 'Test');
    await page.click('#add-btn');
    await expect(page.locator('#toast')).toContainText('valid amount');
  });

  test('deletes an expense from the UI', async ({ page, request }) => {
    // seed via API
    const res  = await request.post(API, { data: { title: 'Delete me', amount: 50, category: 'other' } });
    const task = await res.json();

    await page.goto(BASE);
    await expect(page.locator('#expense-list')).toContainText('Delete me');

    await page.click(`[data-testid="delete-${task.id}"], .btn-delete-item >> nth=0`);
    await expect(page.locator('#expense-list')).not.toContainText('Delete me');
  });

  test('filters expenses by category', async ({ page, request }) => {
    await request.post(API, { data: { title: 'Lunch',    amount: 120, category: 'food'      } });
    await request.post(API, { data: { title: 'Bus ride', amount: 30,  category: 'transport' } });

    await page.goto(BASE);

    // click Food filter
    await page.click('.filter-btn[data-filter="food"]');
    await expect(page.locator('#expense-list')).toContainText('Lunch');
    await expect(page.locator('#expense-list')).not.toContainText('Bus ride');

    // click Transport filter
    await page.click('.filter-btn[data-filter="transport"]');
    await expect(page.locator('#expense-list')).toContainText('Bus ride');
    await expect(page.locator('#expense-list')).not.toContainText('Lunch');

    // back to All
    await page.click('.filter-btn[data-filter="all"]');
    await expect(page.locator('#expense-list')).toContainText('Lunch');
    await expect(page.locator('#expense-list')).toContainText('Bus ride');
  });

  test('mocks API and verifies UI renders mocked data', async ({ page }) => {
    await page.route('**/api/expenses', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'mock1', title: 'Mocked expense', amount: 999, category: 'other', date: '2026-03-13', createdAt: new Date().toISOString() }
          ])
        });
      } else {
        route.continue();
      }
    });

    await page.goto(BASE);
    await expect(page.locator('#expense-list')).toContainText('Mocked expense');
  });

});


// ════════════════════════════════════════════════════════
//  API TESTS  (no browser)
// ════════════════════════════════════════════════════════

test.describe('API', () => {

  test('GET /api/expenses returns empty array initially', async ({ request }) => {
    const res = await request.get(API);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('POST /api/expenses creates an expense', async ({ request }) => {
    const res  = await request.post(API, { data: { title: 'API test', amount: 200, category: 'food' } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('API test');
    expect(body.amount).toBe(200);
    expect(body.done).toBeUndefined();
    expect(body.id).toBeTruthy();
  });

  test('POST /api/expenses returns 400 for missing fields', async ({ request }) => {
    const res = await request.post(API, { data: { title: 'No amount' } });
    expect(res.status()).toBe(400);
  });

  test('POST /api/expenses returns 400 for non-positive amount', async ({ request }) => {
    const res = await request.post(API, { data: { title: 'Bad', amount: -10, category: 'food' } });
    expect(res.status()).toBe(400);
  });

  test('GET /api/expenses filters by category', async ({ request }) => {
    await request.post(API, { data: { title: 'Pizza',  amount: 300, category: 'food'      } });
    await request.post(API, { data: { title: 'Ticket', amount: 50,  category: 'transport' } });

    const res  = await request.get(`${API}?category=food`);
    const data = await res.json();
    expect(data.every(e => e.category === 'food')).toBeTruthy();
    expect(data.length).toBe(1);
  });

  test('GET /api/expenses/:id returns correct expense', async ({ request }) => {
    const created = await (await request.post(API, { data: { title: 'Single', amount: 100, category: 'other' } })).json();
    const res     = await request.get(`${API}/${created.id}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).title).toBe('Single');
  });

  test('GET /api/expenses/:id returns 404 for unknown id', async ({ request }) => {
    const res = await request.get(`${API}/nonexistent-id`);
    expect(res.status()).toBe(404);
  });

  test('PUT /api/expenses/:id updates the expense', async ({ request }) => {
    const created = await (await request.post(API, { data: { title: 'Old title', amount: 100, category: 'food' } })).json();
    const res     = await request.put(`${API}/${created.id}`, { data: { title: 'New title', amount: 250 } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('New title');
    expect(body.amount).toBe(250);
  });

  test('PUT /api/expenses/:id returns 404 for unknown id', async ({ request }) => {
    const res = await request.put(`${API}/ghost`, { data: { title: 'X' } });
    expect(res.status()).toBe(404);
  });

  test('DELETE /api/expenses/:id removes the expense', async ({ request }) => {
    const created = await (await request.post(API, { data: { title: 'Bye', amount: 10, category: 'other' } })).json();
    const del     = await request.delete(`${API}/${created.id}`);
    expect(del.status()).toBe(204);

    const check = await request.get(`${API}/${created.id}`);
    expect(check.status()).toBe(404);
  });

  test('DELETE /api/expenses/:id returns 404 for unknown id', async ({ request }) => {
    const res = await request.delete(`${API}/ghost-id`);
    expect(res.status()).toBe(404);
  });

  test('GET /api/expenses/summary returns totals', async ({ request }) => {
    await request.post(API, { data: { title: 'A', amount: 100, category: 'food'      } });
    await request.post(API, { data: { title: 'B', amount: 200, category: 'food'      } });
    await request.post(API, { data: { title: 'C', amount: 50,  category: 'transport' } });

    const res  = await request.get(`${API}/summary`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(350);
    expect(body.count).toBe(3);
    expect(body.byCategory.food).toBe(300);
    expect(body.byCategory.transport).toBe(50);
  });

});