/**
 * Code Snippet Manager — client-side app (no framework)
 */

// ── State ─────────────────────────────────────────────────────────────────────
let activeLanguage = '';
let activeTag = '';
let searchDebounceTimer = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const snippetsGrid   = document.getElementById('snippets-grid');
const languageList   = document.getElementById('language-list');
const tagCloud       = document.getElementById('tag-cloud');
const searchInput    = document.getElementById('search-input');
const newSnippetBtn  = document.getElementById('new-snippet-btn');
const modalOverlay   = document.getElementById('modal-overlay');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const newSnippetForm = document.getElementById('new-snippet-form');
const formError      = document.getElementById('form-error');
const activeFilterEl = document.getElementById('active-filter');
const filterLabel    = document.getElementById('filter-label');
const clearFilterBtn = document.getElementById('clear-filter-btn');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative time string (e.g. "3 minutes ago").
 * @param {string} isoString
 * @returns {string}
 */
function relativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
}

/**
 * Returns the first `n` lines of a string.
 * @param {string} code
 * @param {number} n
 * @returns {string}
 */
function firstLines(code, n) {
  return code.split('\n').slice(0, n).join('\n');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Renders a single snippet card element.
 * @param {object} snippet
 * @returns {HTMLElement}
 */
function renderCard(snippet) {
  const card = document.createElement('article');
  card.className = 'snippet-card';
  card.setAttribute('role', 'listitem');

  const preview = firstLines(snippet.code, 4);
  const langBadge = snippet.language
    ? `<span class="lang-badge">${escapeHtml(snippet.language)}</span>`
    : '';

  const tagsHtml = (snippet.tags || [])
    .map(
      (t) =>
        `<button class="tag-chip" data-tag="${escapeHtml(t)}" aria-label="Filter by tag ${escapeHtml(t)}">${escapeHtml(t)}</button>`
    )
    .join('');

  card.innerHTML = `
    <div class="card-header">
      <span class="card-title">${escapeHtml(snippet.title)}</span>
      ${langBadge}
    </div>
    <div class="card-code">
      <pre><code class="language-${escapeHtml(snippet.language || 'plaintext')}">${escapeHtml(preview)}</code></pre>
    </div>
    <div class="card-footer">
      <div class="card-tags">${tagsHtml}</div>
      <span class="card-timestamp" title="${escapeHtml(snippet.createdAt)}">${relativeTime(snippet.createdAt)}</span>
    </div>
  `;

  // Highlight code block
  const codeEl = card.querySelector('code');
  if (window.hljs && codeEl) window.hljs.highlightElement(codeEl);

  // Tag chip click → filter
  card.querySelectorAll('.tag-chip').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setTagFilter(btn.dataset.tag);
    });
  });

  return card;
}

/**
 * Renders the snippet grid with the given array.
 * @param {object[]} snippets
 */
function renderSnippets(snippets) {
  snippetsGrid.innerHTML = '';
  if (!snippets || snippets.length === 0) {
    snippetsGrid.innerHTML = `
      <div class="empty-state">
        <strong>No snippets found</strong>
        <p>Try a different filter or search term.</p>
      </div>`;
    return;
  }
  snippets.forEach((s) => snippetsGrid.appendChild(renderCard(s)));
}

/**
 * Rebuilds the language filter sidebar.
 * @param {object[]} snippets  — full unfiltered list
 */
function renderLanguageSidebar(snippets) {
  const langs = [...new Set(snippets.map((s) => s.language).filter(Boolean))].sort();
  languageList.innerHTML = `<li><button class="filter-btn${!activeLanguage ? ' active' : ''}" data-language="">All</button></li>`;
  langs.forEach((lang) => {
    const li = document.createElement('li');
    li.innerHTML = `<button class="filter-btn${activeLanguage === lang ? ' active' : ''}" data-language="${escapeHtml(lang)}">${escapeHtml(lang)}</button>`;
    languageList.appendChild(li);
  });
  languageList.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => setLanguageFilter(btn.dataset.language));
  });
}

/**
 * Renders the tag cloud sidebar from /api/tags.
 */
async function renderTagCloud() {
  try {
    const res = await fetch('/api/tags');
    if (!res.ok) return;
    const { tags } = await res.json();
    tagCloud.innerHTML = '';
    tags.forEach(({ name }) => {
      const btn = document.createElement('button');
      btn.className = `tag-chip${activeTag === name ? ' active' : ''}`;
      btn.dataset.tag = name;
      btn.textContent = name;
      btn.setAttribute('aria-label', `Filter by tag ${name}`);
      btn.addEventListener('click', () => setTagFilter(name));
      tagCloud.appendChild(btn);
    });
  } catch (_) {
    // silently ignore tag cloud errors
  }
}

// ── Filter / search ───────────────────────────────────────────────────────────

function updateActiveFilterBar() {
  if (activeLanguage || activeTag || searchInput.value.trim()) {
    let label = '';
    if (searchInput.value.trim()) label = `"${searchInput.value.trim()}"`;
    else if (activeLanguage) label = `language: ${activeLanguage}`;
    else if (activeTag) label = `tag: ${activeTag}`;
    filterLabel.textContent = label;
    activeFilterEl.hidden = false;
  } else {
    activeFilterEl.hidden = true;
  }
}

function setLanguageFilter(lang) {
  activeLanguage = lang;
  activeTag = '';
  searchInput.value = '';
  updateActiveFilterBar();
  loadSnippets();
}

function setTagFilter(tag) {
  activeTag = tag;
  activeLanguage = '';
  searchInput.value = '';
  updateActiveFilterBar();
  loadSnippets();
}

function clearFilters() {
  activeLanguage = '';
  activeTag = '';
  searchInput.value = '';
  updateActiveFilterBar();
  loadSnippets();
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function loadSnippets() {
  try {
    const q = searchInput.value.trim();
    let url;
    if (q) {
      url = `/api/snippets/search?q=${encodeURIComponent(q)}`;
    } else if (activeLanguage) {
      url = `/api/snippets?language=${encodeURIComponent(activeLanguage)}`;
    } else if (activeTag) {
      url = `/api/tags/${encodeURIComponent(activeTag)}/snippets`;
    } else {
      url = '/api/snippets';
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const snippets = data.snippets || [];
    renderSnippets(snippets);

    // Rebuild language sidebar only on full list (no filter)
    if (!q && !activeLanguage && !activeTag) {
      renderLanguageSidebar(snippets);
      await renderTagCloud();
    }
  } catch (err) {
    snippetsGrid.innerHTML = `<p class="loading">Error loading snippets: ${escapeHtml(err.message)}</p>`;
  }
}

// ── Search (debounced) ────────────────────────────────────────────────────────

searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  activeLanguage = '';
  activeTag = '';
  updateActiveFilterBar();
  searchDebounceTimer = setTimeout(loadSnippets, 300);
});

// ── New Snippet modal ─────────────────────────────────────────────────────────

function openModal() {
  newSnippetForm.reset();
  formError.hidden = true;
  modalOverlay.hidden = false;
  document.getElementById('f-title').focus();
}

function closeModal() {
  modalOverlay.hidden = true;
}

newSnippetBtn.addEventListener('click', openModal);
modalCancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
});

newSnippetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.hidden = true;

  const title = newSnippetForm.title.value.trim();
  const code  = newSnippetForm.code.value;
  if (!title || !code.trim()) {
    formError.textContent = 'Title and code are required.';
    formError.hidden = false;
    return;
  }

  const tagsRaw = newSnippetForm.tags.value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const payload = {
    title,
    code,
    language: newSnippetForm.language.value.trim(),
    description: newSnippetForm.description.value.trim(),
    tags,
  };

  try {
    const res = await fetch('/api/snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    closeModal();
    clearFilters();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
});

// ── Clear filter button ───────────────────────────────────────────────────────

clearFilterBtn.addEventListener('click', clearFilters);

// ── Init ──────────────────────────────────────────────────────────────────────

loadSnippets();
