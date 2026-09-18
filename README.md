<div align="center">

# 🚆 irctc-mcp

**Live Indian Railways data for any AI assistant — via the Model Context Protocol.**

Trains between stations, real-time seat availability, fares, PNR status and full timetables.
**No API key. No signup. No config.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-stdio-000000?style=flat-square)](https://modelcontextprotocol.io)
[![API key](https://img.shields.io/badge/API%20key-not%20required-success?style=flat-square)](#-why-no-api-key)

</div>

---

## What it does

Ask your assistant things like:

> *"Delhi se Mumbai kal ki trains dikhao, 3A me seat hai kya?"*
>
> *"Compare Rajdhani vs Duronto for Howrah–New Delhi on 5 October — cheapest with confirmed seats."*
>
> *"Check PNR 4517896230 and tell me if my waitlist will clear."*

…and it answers from **live railway data**, not from the model's memory.

```
**Howrah Junction (HWH) -> New Delhi (NDLS)** on 2026-10-05
2 passenger(s), General quota, ranked by balanced.

| Train | Name                    | Timing               | Duration | Class | Availability | Fare (2 pax) |
| 12301 | Howrah Rajdhani Express | 16:50 -> 09:55 (+1d) | 17h 05m  | 3A    | AVAILABLE-31 | Rs 7,812     |
| 12301 | Howrah Rajdhani Express | 16:50 -> 09:55 (+1d) | 17h 05m  | 2A    | RAC 10       | Rs 10,888    |

**Best match:** 12301 Howrah Rajdhani Express, departing 16:50, 17h 05m journey.
```

---

## 🛠 Tools

| Tool | What it returns |
| --- | --- |
| `search_stations` | Station lookup by name or code, with disambiguation |
| `find_trains_between_stations` | Direct trains for a route and date — timings, duration, classes |
| `get_train_schedule` | Full stop-by-stop timetable: arrival, departure, halt, distance, day |
| `check_seat_availability` | **Live** availability — `AVAILABLE` / `RAC` / `WL` / `REGRET` + confirmation prediction |
| `get_fare` | **Live** quoted fare per class and quota |
| `get_pnr_status` | Per-passenger booking and current status, coach and berth |
| `plan_journey` | One-shot planner: finds trains, prices them, checks seats, ranks the options |
| `list_reference_data` | Class and quota code reference (`3A`, `SL`, `TQ`, …) |

Plus **3 resources** (`irctc://stations`, `irctc://trains`, `irctc://reference` and an `irctc://train/{number}` template) and **2 prompts** (`plan_trip`, `check_my_booking`).

Every tool returns readable Markdown **and** `structuredContent`, so a client can render prose or consume the JSON.

### Station names are resolved for you

`"NDLS"`, `"New Delhi"`, `"mumbai central"` all work. When a name is genuinely ambiguous, it asks instead of guessing:

```
"delhi" matches more than one station.
Hint: NDLS = New Delhi; DLI = Delhi Junction; NZM = Hazrat Nizamuddin; ...
```

---

## 🚀 Quick start

```bash
git clone https://github.com/<your-username>/irctc-mcp.git
cd irctc-mcp
npm install          # installs + builds
npm start            # live, no key needed
```

### Connect to Claude Desktop

Edit `claude_desktop_config.json`:

- **Windows** — `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS** — `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "irctc": {
      "command": "node",
      "args": ["/absolute/path/to/irctc-mcp/dist/index.js"]
    }
  }
}
```

> **Windows tip:** use forward slashes — `C:/Users/you/irctc-mcp/dist/index.js` — or escape them as `\\`. A single `\` is invalid JSON and is the most common setup mistake.

Fully quit Claude Desktop (tray icon → **Quit**, not just the window) and reopen.

### Connect to Claude Code

```bash
claude mcp add irctc -- node /absolute/path/to/irctc-mcp/dist/index.js
```

### Inspect it manually

```bash
npm run inspect      # MCP Inspector
```

---

## 🔑 Why no API key?

Most "Indian Railways API" projects hand you a signup page. This one doesn't, because the endpoints the public enquiry sites use are reachable directly.

The useful find: **one ConfirmTkt search call returns trains, live seat availability, quoted fares and confirmation predictions together** — so the three most valuable tools resolve from a single cached request.

Optional: setting `IRCTC_RAPIDAPI_KEY` adds a [RapidAPI](https://rapidapi.com/IRCTCAPI/api/irctc1) source at the front of the chain. Nothing requires it.

---

## 🏗 How it works

Every provider implements one `RailProvider` interface, and a **chain** picks the first source that can actually answer each call:

```
[RapidAPI if key set]  →  ConfirmTkt  →  eRail  →  station directory
```

They cover different things on purpose — ConfirmTkt has live availability but no route data; eRail has full routes but no availability. Chaining them per-capability gets every tool its best source, and adding a new provider is one file with **zero changes to the tool layer**.

| Provider | Key? | Covers |
| --- | --- | --- |
| `confirmtkt` | No | Stations, trains between, **live availability**, **fares**, predictions, PNR |
| `erail` | No | Trains between, stop-by-stop schedules |
| `rapidapi` | Optional | Full coverage via a keyed aggregator |
| `station-directory` | No | Station codes from a bundled directory (static reference data) |
| `mock` | No | Deterministic offline sample data for development |

### Failures are reported, never faked

If every source fails, the tool returns an error naming what was tried. It does **not** quietly fall back to estimates, and it does **not** report an outage as "no trains found" — those are two different answers and the code keeps them apart.

### Offline mode

```bash
IRCTC_PROVIDER=mock npm start
```

Runs on a bundled dataset of 82 stations and 24 real trains. Availability and PNR are **simulated** (deterministic, so they stay self-consistent), every response is labelled `OFFLINE MODE`, and the server instructions tell the model to say so.

---

## ⚙️ Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `IRCTC_PROVIDER` | `auto` | `auto`, `confirmtkt`, `erail`, `rapidapi`, `mock` |
| `IRCTC_RAPIDAPI_KEY` | — | Optional: adds a keyed source at the front of the chain |
| `IRCTC_RAPIDAPI_HOST` | `irctc1.p.rapidapi.com` | Alternate RapidAPI listing |
| `IRCTC_TIMEOUT_MS` | `15000` | Per-request timeout |
| `IRCTC_OFFLINE_FALLBACK` | `false` | Append the offline estimator as a last resort |

Responses are cached in-process — 60s for volatile data, up to 24h for schedules and station lists — to keep upstream call volume low.

---

## 🧪 Testing

```bash
npm run test:parsers   # 9 parser tests
npm run smoke          # 39 end-to-end checks
npm run test:all       # build + both
```

`parsers.test.mjs` runs the upstream parsers against **verbatim captured live payloads**, so format regressions are caught without network access. This caught two real bugs during development:

- eRail's route payload opens with `^` rather than `~^` — the naive split silently dropped **every train's origin station**.
- A waitlist string like `RLWL5/WL3` must report the position after the *last* `WL` (current), not the first (booking-time).

`smoke.mjs` spawns the built server with a real MCP client and exercises every tool, resource and prompt, including error paths: unknown train, malformed PNR, class not on that train, bad date format, travelling the wrong way along a route.

---

## 📁 Project structure

```
src/
  index.ts              stdio entry point
  server.ts             wires tools, resources and prompts onto McpServer
  types.ts              domain types, class/quota vocabularies, RailDataError
  data/                 bundled station directory and offline sample timetable
  providers/
    provider.ts         the RailProvider interface
    chain.ts            per-capability failover
    confirmtkt.ts       key-free live: trains, availability, fares, PNR
    erail.ts            key-free live: trains, stop-by-stop schedules
    rapidapi.ts         optional keyed live provider
    directory.ts        bundled station lookup
    mock.ts             offline estimator
    index.ts            env config and provider factory
  tools/register.ts     the eight tool definitions
  util/                 dates (IST), http client, fare model, formatting
scripts/
  parsers.test.mjs      parser tests against real captured payloads
  smoke.mjs             end-to-end MCP session over stdio JSON-RPC
```

## Adding a data source

Implement `RailProvider` and register it in `src/providers/index.ts`. Nothing in the tool layer changes.

```ts
export class MyProvider implements RailProvider {
  readonly name = 'my-provider';
  readonly isLive = true;
  async searchStations(query: string, limit: number) { /* ... */ }
  // ...
}
```

Throw `RailDataError(code, message, hint?)` for anything the user can act on — the tool layer turns it into a clean tool error with the hint attached.

---

## ⚠️ Disclaimer

**Read this before depending on it.**

- This project is **not affiliated with, endorsed by, or connected to IRCTC or Indian Railways.**
- It is **read-only**. It cannot book, cancel or pay for tickets, and it never will. Booking must be completed on IRCTC or through an authorised agent.
- There is **no official free public API** for Indian Railways passenger data. The sources used here are the endpoints public enquiry sites call. They are **unofficial and best-effort**: they can change or break without notice, and using them may be subject to those sites' terms of service.
- **Always verify on IRCTC before booking or travelling.** Do not treat this data as authoritative.
- Fine for personal use, learning and development. For anything commercial, the honest path is an IRCTC agent licence or a paid aggregator with a contract behind it.

## 📄 License

[MIT](LICENSE)

<div align="center">
<sub>Built with the <a href="https://modelcontextprotocol.io">Model Context Protocol</a></sub>
</div>
