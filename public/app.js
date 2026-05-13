const select = document.getElementById('merchant-select');
const totalOrdersEl = document.getElementById('total-orders');
const uniqueCustomersEl = document.getElementById('unique-customers');
const avgOrderEl = document.getElementById('avg-order');
const revenue30dEl = document.getElementById('revenue-30d');
const ordersTbody = document.getElementById('orders-tbody');

function api(path) {
  return fetch(path, { headers: { 'X-Merchant-Id': select.value } }).then((r) => r.json());
}

function money(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function refresh() {
  const summary = await api('/api/metrics/summary');
  totalOrdersEl.textContent = summary.total_orders ?? '—';
  uniqueCustomersEl.textContent = summary.unique_customers ?? '—';
  avgOrderEl.textContent = money(summary.avg_order_value_cents ?? 0);

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const revenue = await api(`/api/revenue?from=${isoDate(thirtyAgo)}&to=${isoDate(now)}`);
  revenue30dEl.textContent = money(revenue.revenue_cents ?? 0);

  const ordersRes = await api('/api/orders?limit=10');
  ordersTbody.innerHTML = '';
  for (const o of ordersRes.orders ?? []) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(o.created_at).toLocaleDateString()}</td>
      <td>${o.customer_email}</td>
      <td>${o.type}</td>
      <td>${money(o.total_amount)}</td>
    `;
    ordersTbody.appendChild(tr);
  }
}

select.addEventListener('change', refresh);
refresh();

// ---------------------------------------------------------------------------
// Feature C — Order search
// ---------------------------------------------------------------------------
const searchBtn       = document.getElementById('search-btn');
const searchClear     = document.getElementById('search-clear');
const searchStatus    = document.getElementById('search-status');
const searchTable     = document.getElementById('search-table');
const searchTbody     = document.getElementById('search-tbody');
const searchPagination = document.getElementById('search-pagination');
const pagePrev        = document.getElementById('page-prev');
const pageNext        = document.getElementById('page-next');
const pageInfo        = document.getElementById('page-info');

const PAGE_SIZE = 10;
let searchOffset = 0;
let lastSearchTotal = 0;

function buildSearchParams(offset) {
  const params = new URLSearchParams();
  const email  = document.getElementById('s-email').value.trim();
  const status = document.getElementById('s-status').value;
  const type   = document.getElementById('s-type').value;
  const from   = document.getElementById('s-from').value;
  const to     = document.getElementById('s-to').value;
  const min    = document.getElementById('s-min').value.trim();
  const max    = document.getElementById('s-max').value.trim();

  if (email)  params.set('email',  email);
  if (status) params.set('status', status);
  if (type)   params.set('type',   type);
  if (from)   params.set('from',   from);
  if (to)     params.set('to',     to);
  // Convert dollar amounts entered by the user to cents for the API
  if (min)    params.set('minAmount', String(Math.round(parseFloat(min) * 100)));
  if (max)    params.set('maxAmount', String(Math.round(parseFloat(max) * 100)));
  params.set('limit',  String(PAGE_SIZE));
  params.set('offset', String(offset));
  return params;
}

async function runSearch(offset) {
  searchOffset = offset;
  searchStatus.textContent = 'Searching…';
  searchTable.hidden = true;
  searchPagination.hidden = true;

  try {
    const result = await api(`/api/orders/search?${buildSearchParams(offset)}`);

    if (result.error) {
      searchStatus.textContent = `Error: ${result.detail ?? result.error}`;
      return;
    }

    lastSearchTotal = result.total ?? 0;
    const orders = result.orders ?? [];

    searchStatus.textContent =
      `${lastSearchTotal} result${lastSearchTotal !== 1 ? 's' : ''} found`;

    searchTbody.innerHTML = '';
    for (const o of orders) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(o.created_at).toLocaleDateString()}</td>
        <td>${o.customer_email}</td>
        <td>${o.status}</td>
        <td>${o.type}</td>
        <td>${money(o.total_amount)}</td>
      `;
      searchTbody.appendChild(tr);
    }

    searchTable.hidden = false;

    // Pagination controls
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
    const totalPages  = Math.ceil(lastSearchTotal / PAGE_SIZE) || 1;
    pageInfo.textContent  = `Page ${currentPage} of ${totalPages}`;
    pagePrev.disabled     = offset === 0;
    pageNext.disabled     = !result.hasMore;
    searchPagination.hidden = lastSearchTotal <= PAGE_SIZE;
  } catch (err) {
    searchStatus.textContent = 'Request failed — check the console.';
    console.error(err);
  }
}

searchBtn.addEventListener('click', () => runSearch(0));

pagePrev.addEventListener('click', () => {
  if (searchOffset >= PAGE_SIZE) runSearch(searchOffset - PAGE_SIZE);
});

pageNext.addEventListener('click', () => {
  if (searchOffset + PAGE_SIZE < lastSearchTotal) runSearch(searchOffset + PAGE_SIZE);
});

searchClear.addEventListener('click', () => {
  document.getElementById('s-email').value  = '';
  document.getElementById('s-status').value = '';
  document.getElementById('s-type').value   = '';
  document.getElementById('s-from').value   = '';
  document.getElementById('s-to').value     = '';
  document.getElementById('s-min').value    = '';
  document.getElementById('s-max').value    = '';
  searchStatus.textContent   = '';
  searchTable.hidden         = true;
  searchPagination.hidden    = true;
  searchTbody.innerHTML      = '';
});

// Re-run the last search whenever the merchant changes
select.addEventListener('change', () => {
  if (!searchTable.hidden) runSearch(0);
});
