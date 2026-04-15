// ==UserScript==
// @name         CreeperWorld2 Maps Sorter
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Sort all CW2 custom maps by downloads, scores, or comments across all pages
// @match        https://knucklecracker.com/creeperworld2/viewmaps.php*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────────────

  function parseMapsFromDoc(doc) {
    const maps = [];
    const mapIdLinks = [...doc.querySelectorAll('a[href*="mapid="]')]
      .filter(a => a.textContent.includes('Map ID:'));

    for (const link of mapIdLinks) {
      const mapId = link.href.match(/mapid=(\d+)/)?.[1];
      const td = link.closest('td');
      const nextTd = td?.nextElementSibling;
      if (!nextTd) continue;

      const getField = (label) => {
        const labelEl = [...nextTd.querySelectorAll('td')]
          .find(el => el.textContent.trim() === label);
        return labelEl?.nextElementSibling?.textContent?.trim() ?? '';
      };

      const scoresText = getField('Scores:');
      const scoresNum = parseInt(scoresText.split(/\s/)[0]) || 0;
      const downloadsNum = parseInt(getField('Downloads:')) || 0;
      const commentsNum = parseInt(getField('Comments:')) || 0;
      const bestTime = getField('Best Time:');
      const title = getField('Title:');
      const author = getField('Author:');

      if (!title) continue;

      maps.push({ mapId, title, author, downloads: downloadsNum, scores: scoresNum, comments: commentsNum, bestTime });
    }
    return maps;
  }

  async function fetchPage(pageNum, author, duration) {
    const url = `https://knucklecracker.com/creeperworld2/viewmaps.php?embedded=false&gameVer=&page=${pageNum}&duration=${duration}&author=${encodeURIComponent(author)}&search=`;
    const res = await fetch(url);
    const html = await res.text();
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  function getTotalPages(doc) {
    const text = doc.body.innerText.match(/(\d+) Custom Maps/);
    const total = parseInt(text?.[1]) || 0;
    return Math.ceil(total / 24);
  }

  // Read current filter params from URL
  function getCurrentParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      author: params.get('author') || '',
      duration: params.get('duration') || '0',
    };
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  const TOOLBAR_ID = 'cw2-sorter-toolbar';
  const OVERLAY_ID = 'cw2-sorter-overlay';

  function buildToolbar() {
    if (document.getElementById(TOOLBAR_ID)) return;

    const bar = document.createElement('div');
    bar.id = TOOLBAR_ID;
    bar.style.cssText = `
      background: #1a2535; border: 1px solid #4a6080; color: #e0e0e0;
      padding: 8px 12px; margin: 8px auto; width: 738px; box-sizing: border-box;
      font-family: sans-serif; font-size: 13px; display: flex; align-items: center; gap: 10px;
      border-radius: 4px;
    `;
    bar.innerHTML = `
      <span style="font-weight:bold; color:#a0c8ff;">Sort All Maps:</span>
      <button data-sort="downloads" style="${btnStyle()}">&#9660; Downloads</button>
      <button data-sort="scores"    style="${btnStyle()}">&#9660; Scores</button>
      <button data-sort="comments"  style="${btnStyle()}">&#9660; Comments</button>
      <span id="cw2-sorter-status" style="color:#a0a0a0; margin-left:8px;"></span>
    `;

    bar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => startSort(btn.dataset.sort));
    });

    // Try multiple insertion strategies, most specific first
    const inserted = (() => {
      // 1. First map card's ancestor center element
      const firstMapLink = document.querySelector('a[href*="mapid="]');
      if (firstMapLink) {
        const centerEl = firstMapLink.closest('center') || firstMapLink.closest('div[style*="background-color:#253040"]');
        if (centerEl) {
          centerEl.parentElement.insertBefore(bar, centerEl);
          return true;
        }
      }
      // 2. Any div containing "2980 Custom Maps" or similar count text
      const countDiv = [...document.querySelectorAll('div')]
        .find(d => /\d+ Custom Maps/.test(d.textContent) && d.children.length < 5);
      if (countDiv) {
        countDiv.parentElement.insertBefore(bar, countDiv);
        return true;
      }
      // 3. Fallback: after the nav bar
      const nav = document.querySelector('div[style*="titlebackgroundbarwide"]') ||
                  document.querySelector('center');
      if (nav) {
        nav.parentElement.insertBefore(bar, nav.nextSibling);
        return true;
      }
      return false;
    })();

    if (!inserted) document.body.prepend(bar);
  }

  function btnStyle() {
    return `background:#2a4060; color:#d0e8ff; border:1px solid #4a6080; border-radius:3px;
            padding:4px 10px; cursor:pointer; font-size:12px;`;
  }

  function setStatus(msg) {
    const el = document.getElementById('cw2-sorter-status');
    if (el) el.textContent = msg;
  }

  function showOverlay(maps, sortField) {
    // Remove previous overlay
    document.getElementById(OVERLAY_ID)?.remove();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = `
      width: 750px; margin: 10px auto; background: #1a2535;
      border: 1px solid #4a6080; border-radius: 4px;
      font-family: sans-serif; font-size: 12px; color: #e0e0e0;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'padding:8px 12px; background:#253040; display:flex; justify-content:space-between; align-items:center;';
    header.innerHTML = `
      <span style="font-weight:bold; color:#a0c8ff; font-size:14px;">
        ${maps.length} Maps — sorted by ${sortField} (highest first)
      </span>
      <button id="cw2-close-overlay" style="${btnStyle()}">✕ Close</button>
    `;
    overlay.appendChild(header);

    const table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:collapse;';
    table.innerHTML = `
      <thead>
        <tr style="background:#253050; color:#a0c8ff; text-align:left;">
          <th style="padding:5px 8px; width:30px;">#</th>
          <th style="padding:5px 8px;" data-col="title">Title</th>
          <th style="padding:5px 8px;" data-col="author">Author</th>
          <th style="padding:5px 8px; text-align:right; cursor:pointer;" data-col="downloads">Downloads ↕</th>
          <th style="padding:5px 8px; text-align:right; cursor:pointer;" data-col="scores">Scores ↕</th>
          <th style="padding:5px 8px; text-align:right; cursor:pointer;" data-col="comments">Comments ↕</th>
          <th style="padding:5px 8px;">Best Time</th>
        </tr>
      </thead>
      <tbody id="cw2-sort-tbody"></tbody>
    `;

    // Click headers to re-sort
    let currentSort = sortField;
    let ascending = false;
    table.querySelectorAll('th[data-col]').forEach(th => {
      const col = th.dataset.col;
      if (!['downloads','scores','comments'].includes(col)) return;
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        if (currentSort === col) ascending = !ascending;
        else { currentSort = col; ascending = false; }
        const sorted = [...maps].sort((a, b) => ascending ? a[col] - b[col] : b[col] - a[col]);
        renderRows(sorted, currentSort);
        header.querySelector('span').textContent =
          `${maps.length} Maps — sorted by ${currentSort} (${ascending ? 'lowest' : 'highest'} first)`;
      });
    });

    overlay.appendChild(table);

    const renderRows = (rows, activeCol) => {
      const tbody = table.querySelector('#cw2-sort-tbody');
      tbody.innerHTML = '';
      rows.forEach((m, i) => {
        const tr = document.createElement('tr');
        tr.style.cssText = i % 2 === 0 ? 'background:#252f3f;' : 'background:#1e2838;';
        tr.innerHTML = `
          <td style="padding:4px 8px; color:#606070;">${i + 1}</td>
          <td style="padding:4px 8px;">
            <a href="viewmaps.php?embedded=false&gameVer=&mapid=${m.mapId}"
               style="color:#d0e8ff; text-decoration:none;"
               target="_blank">${escHtml(m.title)}</a>
          </td>
          <td style="padding:4px 8px; color:#b0c8e0;">${escHtml(m.author)}</td>
          <td style="padding:4px 8px; text-align:right; color:${activeCol==='downloads'?'#ffdd88':'#e0e0e0'}; font-weight:${activeCol==='downloads'?'bold':'normal'};">
            ${m.downloads.toLocaleString()}
          </td>
          <td style="padding:4px 8px; text-align:right; color:${activeCol==='scores'?'#ffdd88':'#e0e0e0'}; font-weight:${activeCol==='scores'?'bold':'normal'};">
            ${m.scores.toLocaleString()}
          </td>
          <td style="padding:4px 8px; text-align:right; color:${activeCol==='comments'?'#ffdd88':'#e0e0e0'}; font-weight:${activeCol==='comments'?'bold':'normal'};">
            ${m.comments.toLocaleString()}
          </td>
          <td style="padding:4px 8px; color:#909090;">${escHtml(m.bestTime)}</td>
        `;
        tbody.appendChild(tr);
      });
    };

    renderRows(maps, sortField);
    overlay.appendChild(table);

    // Insert overlay after toolbar
    const toolbar = document.getElementById(TOOLBAR_ID);
    toolbar?.parentElement?.insertBefore(overlay, toolbar.nextSibling);

    document.getElementById('cw2-close-overlay').addEventListener('click', () => overlay.remove());
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Main sort routine ──────────────────────────────────────────────────────

  let sorting = false;

  async function startSort(field) {
    if (sorting) return;
    sorting = true;

    const { author, duration } = getCurrentParams();

    // First fetch page 1 to get total count
    setStatus('Fetching page 1…');
    let firstDoc;
    try {
      firstDoc = await fetchPage(0, author, duration);
    } catch (e) {
      setStatus('Error fetching data.');
      sorting = false;
      return;
    }

    const totalPages = getTotalPages(firstDoc);
    const allMaps = parseMapsFromDoc(firstDoc);
    setStatus(`Page 1/${totalPages} — ${allMaps.length} maps so far…`);

    // Fetch remaining pages in batches of 8 to avoid hammering the server
    const BATCH = 8;
    for (let start = 1; start < totalPages; start += BATCH) {
      const batch = [];
      for (let p = start; p < Math.min(start + BATCH, totalPages); p++) {
        batch.push(fetchPage(p, author, duration));
      }
      const docs = await Promise.all(batch);
      for (const doc of docs) allMaps.push(...parseMapsFromDoc(doc));
      setStatus(`Page ${Math.min(start + BATCH, totalPages)}/${totalPages} — ${allMaps.length} maps…`);
    }

    // Sort
    allMaps.sort((a, b) => b[field] - a[field]);
    setStatus(`Done — ${allMaps.length} maps loaded.`);
    showOverlay(allMaps, field);
    sorting = false;
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  buildToolbar();

})();
