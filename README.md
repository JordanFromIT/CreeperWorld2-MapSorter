# CreeperWorld2 Map Sorter

A Tampermonkey userscript that adds sorting to the [Creeper World 2 custom maps page](https://knucklecracker.com/creeperworld2/viewmaps.php) — a feature the site doesn't natively support.

Sort all 2980+ community maps by **downloads**, **scores**, or **comments** across all pages at once.

## Features

- Adds a **Sort All Maps** toolbar directly on the maps page
- Fetches and parses all pages in the background (batched to avoid hammering the server)
- Displays a full sorted results table with clickable map titles
- Click any column header in the results to re-sort on the fly
- Respects active author and best-time filters on the page

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Make sure **userscripts are enabled** in the Tampermonkey settings (the toggle on the extension icon)
3. Click **[Install Script](https://raw.githubusercontent.com/JordanFromIT/CreeperWorld2-MapSorter/main/cw2_map_sorter.user.js)** — Tampermonkey will prompt you to confirm
4. Visit the [CW2 custom maps page](https://knucklecracker.com/creeperworld2/viewmaps.php)

The **Sort All Maps** toolbar will appear near the top of the page.

## Usage

| Button | What it does |
|--------|-------------|
| **Downloads** | Sort all maps by total download count (highest first) |
| **Scores** | Sort by number of score submissions |
| **Comments** | Sort by number of comments |

A progress counter shows fetch status while loading. Once done, a sortable table replaces the normal paginated view. Click **✕ Close** to return to normal browsing.

## Notes

- Sorting fetches ~125 pages of map data, which takes a few seconds
- The site doesn't have a "Likes" field — Downloads and Scores are the best popularity proxies available
- Results only reflect maps matching any filters currently active on the page (author, best-time range)

## License

MIT
