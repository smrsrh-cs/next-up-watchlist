# 🎬 Next-Up: Movie & TV Show Watchlist Tracker

A sleek, dark-themed personal watchlist tracker where you can easily log movies and TV shows you want to watch next and track episode progress.

Built as a simple mini-project with **pure HTML, CSS, and Vanilla JavaScript** on the frontend and **Node.js with SQLite** on the backend.

---

## 🎯 Features

- **Simple & Sleek Dark UI**: Clean slate/charcoal dark theme. No clutter, no complex menus.
- **Log Movies & TV Shows**: Quick input form right at the top to add titles.
- **Episode Progress Tracking**: For TV shows, track your current episode (e.g. `Episode 4 / 10`) with `+` and `-` buttons that update in real time.
- **Status Pipeline**: Switch status anytime between **📌 Plan to Watch**, **🍿 Watching**, and **✅ Completed**.
- **Filter Tabs**: Instantly filter your list by *All*, *Movies*, *TV Shows*, *Watching*, or *Completed* with real-time count badges.
- **Delete Titles**: Remove items from your list anytime with 1 click.
- **Persistent Database**: Automatically saves your watchlist into SQLite (`watchlist.db`).

---

## 🏗️ System Architecture

The application follows a clean **3-Tier Client-Server Architecture**:

```mermaid
flowchart TD
    subgraph Client ["Frontend Layer (Browser)"]
        UI["User Interface (HTML5 / CSS3)"]
        State["Client Controller & DOM Engine (app.js)"]
        Fetch["Fetch API (Async HTTP Calls)"]
        UI -->|"User Actions (Add, +/- Ep, Filter)"| State
        State -->|"Reactive DOM Re-render"| UI
        State -->|"REST API Requests"| Fetch
    end

    subgraph Server ["Backend Layer (Node.js & Express)"]
        Router["Express Server (server.js)"]
        Middleware["Middlewares (cors, express.json, express.static)"]
        Endpoints["REST API Endpoints (/api/watchlist)"]
        Router --> Middleware
        Middleware --> Endpoints
    end

    subgraph Database ["Persistence Layer (SQLite)"]
        Driver["node:sqlite Driver (database.js)"]
        DBFile[("watchlist.db (Relational Database)")]
        Driver <-->|"SQL Prepared Queries"| DBFile
    end

    Fetch <-->|"JSON over HTTP / REST"| Router
    Endpoints <-->|"Synchronous DB Operations"| Driver
```

### 🔄 Data Flow Lifecycle

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
    Browser-->>User: Render Cards & Live Count Badges

    User->>Browser: Click "+ Ep" on a TV Show
    Browser->>Server: PATCH /api/watchlist/:id (current_ep + 1)
    Server->>DB: UPDATE watchlist SET current_episode = ?, status = ?
    DB-->>Server: Record updated
    Server-->>Browser: JSON { success: true, data: updatedItem }
    Browser-->>User: Update Card Progress Bar & Counts
```

---

## 🚀 How to Run

1. Open PowerShell and navigate to the project directory:
   ```powershell
   cd "C:\Users\HP\OneDrive\Desktop\fsw"
   ```

2. Start the server:
   ```powershell
   node server.js
   ```

3. Open your browser:
   👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📁 Project Structure

```
fsw/
├── public/                # 100% Pure HTML, CSS, JavaScript frontend
│   ├── index.html         # Clean, semantic layout (~80 lines)
│   ├── style.css          # Sleek dark theme styling (~170 lines)
│   └── app.js             # Vanilla JS for API calls & episode updates (~120 lines)
├── server.js              # Clean Node.js Express backend (~95 lines)
├── database.js            # SQLite database initialization
├── watchlist.db           # Persistent SQLite database file
├── package.json           # Dependencies (express, cors)
└── README.md
```
