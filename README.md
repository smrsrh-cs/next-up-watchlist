# Next-Up Watchlist

A movie and TV show watchlist built with HTML, CSS, JavaScript, Express, and SQLite.

## Setup

Install **Node.js 22.13.0 or newer**. The server uses the built-in `node:sqlite` module, which is unavailable in older Node.js versions. Check your version with `node --version`.

Clone the repository and install dependencies:

```sh
git clone https://github.com/smrsrh-cs/next-up-watchlist.git
cd next-up-watchlist
npm ci
npm start
```

If you already have the project, open a terminal in its folder and run `npm ci`, then `npm start`.

Open [http://localhost:3000](http://localhost:3000). If port 3000 is busy, the server tries the next port and prints the address. Keep the terminal running while using the app. Press Ctrl+C to stop it.

Use the server address to open the app; opening `public/index.html` directly will not connect to the API.

The server creates `watchlist.db` in the project folder on first startup and adds four sample titles. Your changes are saved between restarts. No API key, environment file, or separate database server is required.

## Features

- Add movies and TV shows.
- Track episodes with the + and - buttons.
- Set a title to Plan to Watch, Watching, or Completed.
- Filter by type or status and see the count in each category.
- Delete titles from the watchlist.

Completing a title sets its progress to the total episode count. Moving it to Plan resets progress to zero. Finishing a show's last episode marks it Completed; reducing its progress changes it back to Watching.

## Development

Restart the server automatically when server files change:

```sh
npm run dev
```

Run the backend tests:

```sh
npm test
```

Tests cover the API, input validation, static files, port fallback, and database persistence. They use a temporary database and leave your watchlist unchanged.

## Troubleshooting

- **Cannot find module 'express':** run `npm ci` in the project folder.
- **No such built-in module: node:sqlite:** install Node.js 22.13.0 or newer and reopen the terminal.
- **Page cannot connect:** check that `npm start` is still running and use the address printed in the terminal. Click Refresh watchlist after restarting the server.

## Project structure

```text
next-up-watchlist/
├── public/
│   ├── index.html          # Page layout
│   ├── style.css           # Styles
│   └── app.js              # UI events and API requests
├── test/
│   └── watchlist.test.js   # HTTP and persistence tests
├── server.js              # Express routes and server startup
├── database.js            # SQLite setup and sample data
├── watchlist.db            # Created on first run; ignored by Git
├── package.json
├── package-lock.json
└── README.md
```

## Architecture

The browser sends requests to the Express API. The API reads and writes the SQLite database and returns JSON.

```mermaid
flowchart TD
    subgraph Client ["Browser"]
        UI["HTML and CSS"]
        State["Page logic (app.js)"]
        Fetch["Fetch API"]
        UI -->|"User Actions (Add, +/- Ep, Filter)"| State
        State -->|"Update page"| UI
        State -->|"REST API Requests"| Fetch
    end

    subgraph Server ["Server (Node.js and Express)"]
        Router["Express Server (server.js)"]
        Middleware["Middleware"]
        Endpoints["REST API Endpoints (/api/watchlist)"]
        Router --> Middleware
        Middleware --> Endpoints
    end

    subgraph Database ["Database (SQLite)"]
        Driver["node:sqlite Driver (database.js)"]
        DBFile[("watchlist.db (Relational Database)")]
        Driver <-->|"SQL Prepared Queries"| DBFile
    end

    Fetch <-->|"JSON over HTTP / REST"| Router
    Endpoints <-->|"Synchronous DB Operations"| Driver
```

### Request flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as Client (HTML/CSS/JS)
    participant Server as Express Backend (server.js)
    participant DB as SQLite Engine (watchlist.db)

    User->>Browser: Open http://localhost:3000
    Browser->>Server: GET /
    Server-->>Browser: index.html, style.css, app.js

    Browser->>Server: GET /api/watchlist
    Server->>DB: SELECT * FROM watchlist ORDER BY created_at DESC
    DB-->>Server: Return items array
    Server-->>Browser: JSON { success: true, data: [...] }
    Browser-->>User: Display titles and counts

    User->>Browser: Click "+ Ep" on a TV Show
    Browser->>Server: PATCH /api/watchlist/:id (current_ep + 1)
    Server->>DB: UPDATE watchlist SET current_ep = ?, status = ?
    DB-->>Server: Record updated
    Server-->>Browser: JSON { success: true, data: updatedItem }
    Browser-->>User: Update progress and counts
```
