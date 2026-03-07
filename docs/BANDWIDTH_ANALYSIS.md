# Bandwidth Analysis: Polling vs WebSockets

Comparison of current HTTP polling architecture vs WebSocket alternative, with projections across user scales.

## Current Polling Architecture

### Per Authenticated User (always active)

These run on every page while logged in:

| Hook | Endpoint | Interval | Response Size |
|------|----------|----------|---------------|
| Pending proposals (x3) | `GET /trades?role=...&status=...` | 30s | ~10 KB/cycle |

**Baseline per user: ~20 KB/min**

### Page-Specific Polling

Only active when the user is on that page:

| Page | Hook | Interval | Response Size | BW/min |
|------|------|----------|---------------|--------|
| `/exchange` (list) | `useOffers` (proposed 30s) | 30s | ~10 KB | ~20 KB/min |
| `/exchange/[id]` | `useTradesForOffer` | 10s | ~8 KB | ~48 KB/min |
| `/exchange/[id]` | `usePrices` + `useExchangePrices` | 30s | ~13 KB | ~26 KB/min |
| Messages sidebar | `useThreads` | 10s | ~12 KB | ~72 KB/min |
| Active chat | `useMessages` | 3s | ~15 KB | ~300 KB/min |
| Trade completion | `useTradeCompletions` | 15s | ~0.2 KB | ~0.8 KB/min |

### Typical User Session Mix

Not every user is on every page. Realistic distribution assumptions:

| Activity | % of users | Extra BW/min |
|----------|-----------|--------------|
| Browsing `/exchange` list | 40% | +20 KB/min |
| Viewing `/exchange/[id]` | 20% | +74 KB/min |
| Active chat open | 10% | +372 KB/min |
| Messages sidebar (no chat) | 15% | +72 KB/min |
| Idle (navbar only) | 15% | +0 KB/min |

**Weighted average per user: ~20 (base) + 8 + 14.8 + 37.2 + 10.8 + 0 = ~91 KB/min**

---

## Polling Bandwidth Projections

### Per Month (30 days)

| Concurrent Users | BW/min (total) | BW/hour | BW/day | BW/month | Hetzner 20TB? |
|-----------------:|---------------:|--------:|-------:|---------:|:--------------|
| 100 | 8.9 MB | 534 MB | 12.5 GB | **375 GB** | 1.9% |
| 1,000 | 89 MB | 5.3 GB | 125 GB | **3.7 TB** | 18.5% |
| 10,000 | 890 MB | 53 GB | 1.25 TB | **37 TB** | 185% (overage) |
| 100,000 | 8.9 GB | 530 GB | 12.5 TB | **370 TB** | way over |
| 1,000,000 | 89 GB | 5.3 TB | 125 TB | **3,700 TB** | not feasible |

### Request Count Per Month

Each user makes approximately: 3 (proposals) + weighted page polls = ~8 requests/min average

| Concurrent Users | Requests/sec | Requests/day | Requests/month |
|-----------------:|-------------:|-------------:|---------------:|
| 100 | 13 | 1.15M | 35M |
| 1,000 | 133 | 11.5M | 350M |
| 10,000 | 1,333 | 115M | 3.5B |
| 100,000 | 13,333 | 1.15B | 35B |
| 1,000,000 | 133,333 | 11.5B | 350B |

---

## WebSocket Alternative

With WebSockets, the server pushes updates only when data changes. No polling.

### Connection Overhead

- **Per connection**: ~2 KB RAM on server, TCP keepalive every 30s (~64 bytes)
- **Idle connection BW**: ~128 bytes/min (keepalive + pong frames)

### Push-Only Traffic

Instead of polling every N seconds regardless of changes, the server sends data only when something happens:

| Event | Avg payload | Frequency per user |
|-------|-------------|-------------------|
| New exchange offer listed | ~500 bytes | ~2/hour platform-wide |
| Offer updated/removed | ~200 bytes | ~1/hour |
| Price update (broadcast) | ~3 KB | 1/30s (same as polling) |
| Trade status change | ~500 bytes | ~0.5/hour per active trader |
| New message | ~400 bytes | ~5/hour per active chatter |
| Thread list update | ~800 bytes | ~3/hour |
| Proposal notification | ~500 bytes | ~1/hour |

### Key Insight: Most Data Doesn't Change

With polling, every user fetches the full exchange list every 30 seconds even if nothing changed. With WebSockets:

- **Exchange list**: Only pushed when an offer is created/updated/removed (~50 events/hour platform-wide vs 2 req/min per user)
- **Messages**: Only pushed when a message arrives (vs polling every 3 seconds)
- **Trade status**: Only pushed on state change (vs polling every 10-15 seconds)
- **Prices**: Same frequency either way (prices change constantly)

### WebSocket Bandwidth Estimates

**Per user/min** (weighted average):
- Keepalive: 0.128 KB
- Price broadcasts: ~6 KB (same as polling — prices always change)
- Exchange list changes: ~0.1 KB (amortized across all users)
- Messages/trades (10% active): ~0.5 KB
- **Total: ~7 KB/min** (vs ~91 KB/min polling)

**Reduction factor: ~13x less bandwidth**

---

## WebSocket Bandwidth Projections

### Per Month (30 days)

| Concurrent Users | BW/min (total) | BW/hour | BW/day | BW/month | Hetzner 20TB? | vs Polling |
|-----------------:|---------------:|--------:|-------:|---------:|:--------------|:-----------|
| 100 | 0.7 MB | 42 MB | 1 GB | **29 GB** | 0.15% | 13x less |
| 1,000 | 7 MB | 420 MB | 10 GB | **290 GB** | 1.5% | 13x less |
| 10,000 | 70 MB | 4.2 GB | 100 GB | **2.9 TB** | 14.5% | 13x less |
| 100,000 | 700 MB | 42 GB | 1 TB | **29 TB** | 145% (overage) | 13x less |
| 1,000,000 | 7 GB | 420 GB | 10 TB | **290 TB** | not feasible | 13x less |

### Server Resource Comparison

| Concurrent Users | Polling: req/sec | WS: open connections | WS: server RAM |
|-----------------:|-----------------:|---------------------:|---------------:|
| 100 | 13 | 100 | ~200 KB |
| 1,000 | 133 | 1,000 | ~2 MB |
| 10,000 | 1,333 | 10,000 | ~20 MB |
| 100,000 | 13,333 | 100,000 | ~200 MB |
| 1,000,000 | 133,333 | 1,000,000 | ~2 GB |

At 10K+ users, polling hits CPU limits from request parsing overhead. WebSockets eliminate that — the connection is already open.

---

## Side-by-Side Summary

| Scale | Polling BW/month | WebSocket BW/month | Polling req/sec | WS events/sec | Fits Hetzner 20TB? |
|------:|-----------------:|-------------------:|----------------:|---------------:|:--------------------|
| 100 | 375 GB | 29 GB | 13 | <1 | Both fit |
| 1,000 | 3.7 TB | 290 GB | 133 | ~5 | Both fit |
| 10,000 | 37 TB | 2.9 TB | 1,333 | ~50 | WS fits, polling no |
| 100,000 | 370 TB | 29 TB | 13,333 | ~500 | Neither fits single VPS |
| 1,000,000 | 3,700 TB | 290 TB | 133,333 | ~5,000 | Needs CDN + cluster |

---

## Recommendations

| Scale | Architecture |
|-------|-------------|
| **< 5,000 users** | Current polling is fine. Hetzner CX22 handles it. |
| **5,000 - 50,000** | Switch to WebSockets. Single VPS still works with WS. |
| **50,000+** | WebSockets + load balancer + multiple API nodes + read replicas. |
| **500,000+** | Add CDN for static assets, Redis pub/sub for WS fan-out across nodes. |

### Migration Path

1. **Now**: Add 30s polling to `/exchange` list (negligible cost at current scale)
2. **Later**: Add WebSocket layer (Socket.IO or ws) alongside existing REST API
3. **Gradual**: Replace polling hooks one by one with WS subscriptions (messages first — highest frequency)
4. **Keep REST**: REST endpoints remain for initial page loads and mutations; WS only for real-time updates

---

## Notes

- All estimates assume **concurrent** users (online at the same time), not total registered users
- Real traffic is bursty — peak hours may be 3-5x the average
- Response sizes include HTTP headers (~200-400 bytes per response for polling)
- WebSocket frame overhead is ~6-14 bytes per message
- Hetzner counts only **outbound** traffic; inbound is free
- Browser tab backgrounding pauses some polls (messages, threads) reducing real-world BW by ~20-30%
