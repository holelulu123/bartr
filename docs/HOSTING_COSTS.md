# Hosting Costs & Capacity Planning

Estimated monthly costs for running Bartr at different user scales.
Covers VPS/cloud compute, object storage, bandwidth, and domain.

All prices in USD. Cloud prices based on AWS EC2 + S3 equivalents —
privacy-friendly VPS providers (Hetzner, 1984, FlokiNET) are typically
30–60% cheaper for the same specs.

---

## What the stack needs

Every deployment runs these services on the same machine (single VPS):

| Service | RAM | CPU | Disk |
|---|---|---|---|
| Next.js (SSR) | ~200 MB | low-medium | minimal |
| Fastify API | ~100 MB | low | minimal |
| PostgreSQL | ~256 MB base + data | low | grows with users |
| Redis | ~50 MB | very low | minimal |
| MinIO | ~128 MB | low | grows with images |
| Nginx | ~20 MB | very low | minimal |
| OS + headroom | ~300 MB | — | ~10 GB |
| **Total baseline** | **~1 GB** | **1–2 vCPU** | **~15 GB** |

---

## Scale tiers

### Tier 0 — Launch / hobby (0–500 users, ~50 active/day)

This is where you start. One small VPS handles everything comfortably.

**Resources needed:**
- 2 GB RAM, 2 vCPU, 40 GB SSD
- ~50 GB object storage (images)
- ~100 GB bandwidth/month

**AWS EC2 equivalent:** `t3.small` (2 vCPU, 2 GB) ~$17/mo
**Hetzner equivalent:** CX22 (2 vCPU, 4 GB) ~$4.50/mo ← recommended
**1984.is equivalent:** ~$5–8/mo

| Cost item | AWS | Hetzner |
|---|---|---|
| Compute | $17 | $4.50 |
| Storage (40 GB SSD) | included | included |
| Object storage (50 GB) | $1.15 (S3) | $1 (Hetzner Object Storage) |
| Bandwidth (100 GB) | $9 | included (20 TB free) |
| **Total compute + storage** | **~$27/mo** | **~$6/mo** |

---

### Tier 1 — Early traction (500–5,000 users, ~500 active/day)

Traffic is real but still light. Single VPS still works, just bigger.

**Resources needed:**
- 4 GB RAM, 2–4 vCPU, 80 GB SSD
- ~500 GB object storage
- ~500 GB bandwidth/month

**AWS EC2 equivalent:** `t3.medium` (2 vCPU, 4 GB) ~$34/mo
**Hetzner equivalent:** CX32 (4 vCPU, 8 GB) ~$9/mo

| Cost item | AWS | Hetzner |
|---|---|---|
| Compute | $34 | $9 |
| Object storage (500 GB) | $11.50 | $5 |
| Bandwidth (500 GB) | $45 | included |
| **Total** | **~$91/mo** | **~$14/mo** |

---

### Tier 2 — Growth (5,000–50,000 users, ~5,000 active/day)

PostgreSQL and MinIO start to need attention. Still single-server viable
but you'd want to separate the DB or add a read replica.

**Resources needed:**
- 8–16 GB RAM, 4–8 vCPU, 200 GB SSD
- ~5 TB object storage
- ~2 TB bandwidth/month

**AWS EC2 equivalent:** `t3.xlarge` (4 vCPU, 16 GB) ~$150/mo
**Hetzner equivalent:** CX52 (8 vCPU, 32 GB) ~$28/mo

| Cost item | AWS | Hetzner |
|---|---|---|
| Compute | $150 | $28 |
| Object storage (5 TB) | $115 | $25 (Hetzner Object Storage) |
| Bandwidth (2 TB) | $184 | included |
| **Total** | **~$450/mo** | **~$53/mo** |

---

### Tier 3 — Scale (50,000+ users, ~20,000+ active/day)

At this point you separate services: dedicated DB server, CDN for images,
possibly separate API nodes behind a load balancer.

**Resources needed:**
- App server: 8 GB RAM, 4 vCPU
- DB server: 16–32 GB RAM, 8 vCPU, 500 GB NVMe
- CDN for images (replaces MinIO direct serve)
- ~20 TB object storage
- ~10 TB+ bandwidth/month

| Cost item | AWS | Hetzner |
|---|---|---|
| App server (×2) | $150 | $56 |
| DB server (RDS or dedicated) | $400 | $50 |
| Object storage (20 TB) | $460 | $100 |
| CDN (Cloudflare / BunnyCDN) | $0–20 (Cloudflare free tier) | $0–20 |
| Bandwidth | $920 | included |
| **Total** | **~$1,930/mo** | **~$226/mo** |

At Tier 3 the platform needs meaningful donation revenue or community
funding to sustain itself.

---

## Domain costs

| Option | Cost | Notes |
|---|---|---|
| `.com` (Namecheap/Porkbun) | $10–12/yr | Most recognisable |
| `.io` | $35–50/yr | Popular in tech |
| `.net` | $12–15/yr | Generic alternative |
| `.org` | $12–15/yr | Good for community project |
| `.xyz` | $2–5/yr (first year) | Cheap but less trusted |
| **Privacy-friendly registrars** | | |
| Njalla (njal.la) | $15–35/yr | Registrar owns domain, you have agreement — maximum privacy, no WHOIS exposure |
| 1984.is | $12–20/yr | Iceland-based, privacy-first |

**Recommendation for Bartr:** `.com` or `.net` via Njalla or 1984.is.
Njalla is the gold standard for privacy — they register the domain in
their name so your personal information never appears in WHOIS records.

**Total domain cost:** ~$15–35/year depending on TLD and registrar.

---

## Realistic monthly cost summary

| Scale | Users | Hetzner (recommended) | AWS | Domain (annualised) |
|---|---|---|---|---|
| Launch | 0–500 | ~$6/mo | ~$27/mo | +$1–3/mo |
| Early traction | 500–5k | ~$14/mo | ~$91/mo | +$1–3/mo |
| Growth | 5k–50k | ~$53/mo | ~$450/mo | +$1–3/mo |
| Scale | 50k+ | ~$226/mo | ~$1,930/mo | +$1–3/mo |

---

## Why not AWS from the start?

AWS is expensive for what you get. At the launch tier:
- Hetzner: **$6/mo** → covers a year for $72
- AWS: **$27/mo** → covers a year for $324

For a donation-funded community project with zero revenue, starting on
Hetzner (or 1984.is for max privacy) makes far more sense.
Migrate to larger infrastructure only when user growth demands it.

## Privacy-friendly VPS providers

| Provider | Location | Notable |
|---|---|---|
| Hetzner | Germany / Finland | Best price/performance, accepts crypto |
| 1984.is | Iceland | Strong privacy stance, accepts crypto |
| FlokiNET | Iceland / Romania / Finland | Privacy-first, accepts crypto, no-log policy |
| Njalla | Sweden (Nevis-incorporated) | Extreme privacy, also does VPS + domain |

---

*Last updated: 2026-02-27*
