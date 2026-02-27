async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status}`);
  }
  return res.json();
}

function render(id, data) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = JSON.stringify(data, null, 2);
}

async function refresh() {
  try {
    const [summary, memory, learning, runtime] = await Promise.all([
      getJson('/api/observer/summary'),
      getJson('/api/observer/memory'),
      getJson('/api/observer/learning'),
      getJson('/api/observer/runtime'),
    ]);

    render('summary', summary.data || summary);
    render('memory', memory.data || memory);
    render('learning', learning.data || learning);
    render('runtime', runtime.data || runtime);
  } catch (err) {
    render('summary', { ok: false, error: err.message });
  }
}

document.getElementById('refreshBtn')?.addEventListener('click', refresh);
refresh();
