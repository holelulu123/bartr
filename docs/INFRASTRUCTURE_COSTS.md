# Bartr — Infrastructure Cost Projections

Last updated: 2026-03-02

---

## 1. Service Providers

| Service | Provider | URL |
|---------|----------|-----|
| VPS (server) | Hetzner Cloud | https://www.hetzner.com/cloud |
| Domain | Porkbun | https://porkbun.com |
| SSL Certificate | Let's Encrypt / Porkbun (free) | — |
| Transactional Email | Resend | https://resend.com |
| Backups (future) | Backblaze B2 | — |

---

## 2. Fixed Costs

### Domain: bartr.vip (Porkbun)

| Year | Annual Cost | Monthly Equivalent | Notes |
|------|------------|-------------------|-------|
| 1 (2026) | $4.12 | $0.34 | First-year registration |
| 2 (2027) | $5.15 | $0.43 | Renewal price |
| 3 (2028) | $5.41 | $0.45 | +5% YoY inflation |
| 4 (2029) | $5.68 | $0.47 | +5% YoY inflation |
| 5 (2030) | $5.96 | $0.50 | +5% YoY inflation |

Included free with domain (Porkbun):
- WHOIS Privacy ($8.99 value)
- SSL Certificate ($69.99 value)
- Email Forwarding ($3.00 value)
- URL Forwarding

### SSL Certificate

**Free** — Porkbun includes one, and Let's Encrypt provides unlimited free certificates with auto-renewal every 90 days.

### Transactional Email: Resend

Used for email verification codes on registration. One email per signup + occasional resends.

| Plan | Price/mo | Emails/mo | Daily Limit | Overage | Notes |
|------|----------|-----------|-------------|---------|-------|
| **Free** | $0 | 3,000 | 100/day | — | 1 domain, 1-day retention |
| **Pro** | $20 | 50,000 | Unlimited | $0.90/1K | 10 domains, 3-day retention |
| **Scale** | $90 | 100,000 | Unlimited | $0.90/1K | 1,000 domains, 7-day retention |

**Our usage**: Each new user triggers 1 verification email (~1 resend on average = ~2 emails/signup). The free tier covers **~1,500 new registrations/month** (100/day cap). At 1.5x growth this lasts until ~Month 8 (~1,700 users). The Pro tier ($20/mo) then covers up to ~25,000 registrations/month — enough through Year 2+.

| Month | New Users | Emails (est.) | Resend Plan | Cost/mo |
|-------|-----------|---------------|-------------|---------|
| 1-7 | ≤1,139 | ≤2,278 | Free | $0 |
| 8-14 | 1,709–19,463 | 3,418–38,926 | Pro | $20 |
| 15+ | 29,194+ | 58,388+ | Scale | $90 |

> **Note**: Conservative growth (20% MoM) stays on the free tier for 18+ months.

---

## 3. Hetzner Cloud VPS Plans (Current Pricing, pre-April 2026)

### Shared vCPU (Intel/AMD) — EU locations, 20 TB traffic included

| Plan | vCPU | RAM | SSD | Price/mo | Price/hr |
|------|------|-----|-----|----------|----------|
| **CX23** | 2 | 4 GB | 40 GB | €3.49 | €0.006 |
| **CX33** | 4 | 8 GB | 80 GB | €5.49 | €0.009 |
| **CX43** | 8 | 16 GB | 160 GB | €9.49 | €0.016 |
| **CX53** | 16 | 32 GB | 320 GB | €17.49 | €0.029 |

### ARM (Ampere) — cheaper, same performance

| Plan | vCPU | RAM | SSD | Price/mo |
|------|------|-----|-----|----------|
| **CAX11** | 2 | 4 GB | 40 GB | €3.79 |
| **CAX21** | 4 | 8 GB | 80 GB | €6.49 |
| **CAX31** | 8 | 16 GB | 160 GB | €12.49 |
| **CAX41** | 16 | 32 GB | 320 GB | €24.49 |

### Additional Storage (Volumes)

| Resource | Price |
|----------|-------|
| Block storage volume | €0.044–0.050/GB/month |
| 10 GB volume | ~€0.50/month |
| 50 GB volume | ~€2.50/month |
| 100 GB volume | ~€5.00/month |

> **Note**: Hetzner is raising prices by 30-37% on April 1, 2026. The projections below use post-increase estimates.

---

## 4. Growth Model

### Assumptions

- Starting users: **100** (Month 1)
- Monthly growth rate: **1.5x** (50% month-over-month)
- Each user: ~3.6 MB storage (22 KB DB + 3.6 MB images) — see INFRASTRUCTURE.md
- Infrastructure cost inflation: **5% annually** (applied from Year 2)
- Hetzner prices: post-April 2026 estimates (~35% above current)

### User Growth Projection

| Month | Users | DAU (15%) | Storage Needed | Upgrade Trigger |
|-------|-------|-----------|---------------|-----------------|
| 1 | 100 | 15 | 360 MB | — |
| 2 | 150 | 23 | 540 MB | — |
| 3 | 225 | 34 | 810 MB | — |
| 4 | 338 | 51 | 1.2 GB | — |
| 5 | 506 | 76 | 1.8 GB | — |
| 6 | 759 | 114 | 2.7 GB | — |
| 7 | 1,139 | 171 | 4.1 GB | RAM upgrade → CX33 |
| 8 | 1,709 | 256 | 6.2 GB | — |
| 9 | 2,563 | 384 | 9.2 GB | — |
| 10 | 3,844 | 577 | 13.8 GB | — |
| 11 | 5,767 | 865 | 20.8 GB | CPU upgrade → CX43 |
| 12 | 8,650 | 1,298 | 31.1 GB | — |
| 13 | 12,975 | 1,946 | 46.7 GB | Storage volume needed |
| 14 | 19,463 | 2,919 | 70.1 GB | CPU upgrade → CX53 |
| 15 | 29,194 | 4,379 | 105.1 GB | — |
| 16 | 43,791 | 6,569 | 157.6 GB | Volume expand |
| 17 | 65,687 | 9,853 | 236.5 GB | Dedicated / split |
| 18 | 98,530 | 14,780 | 354.7 GB | Multi-server setup |

---

## 5. Monthly Cost Projection — Year 1

Using post-April 2026 Hetzner pricing (~35% markup on current prices).

| Month | Users | Hetzner Plan | Server/mo | Volume/mo | Domain/mo | Resend/mo | **Total/mo** |
|-------|-------|-------------|-----------|-----------|-----------|-----------|-------------|
| 1 | 100 | CX23 (2C/4G/40G) | €4.71 | — | $0.34 | $0 (free) | **~€5.03** |
| 2 | 150 | CX23 | €4.71 | — | $0.34 | $0 | **~€5.03** |
| 3 | 225 | CX23 | €4.71 | — | $0.34 | $0 | **~€5.03** |
| 4 | 338 | CX23 | €4.71 | — | $0.34 | $0 | **~€5.03** |
| 5 | 506 | CX23 | €4.71 | — | $0.34 | $0 | **~€5.03** |
| 6 | 759 | CX23 | €4.71 | — | $0.34 | $0 | **~€5.03** |
| 7 | 1,139 | CX33 (4C/8G/80G) | €7.41 | — | $0.34 | $0 | **~€7.73** |
| 8 | 1,709 | CX33 | €7.41 | — | $0.34 | $20 (Pro) | **~€26** |
| 9 | 2,563 | CX33 | €7.41 | — | $0.34 | $20 | **~€26** |
| 10 | 3,844 | CX33 | €7.41 | — | $0.34 | $20 | **~€26** |
| 11 | 5,767 | CX43 (8C/16G/160G) | €12.81 | — | $0.34 | $20 | **~€31** |
| 12 | 8,650 | CX43 | €12.81 | — | $0.34 | $20 | **~€31** |

**Year 1 Total: ~€87** (server) + **$4.12** (domain) + **~$100** (Resend, 5 months Pro) = **~€183 / ~$199**

---

## 6. Monthly Cost Projection — Year 2

Domain renewal: $5.15/year ($0.43/month). Infrastructure inflation: +5%.

| Month | Users | Hetzner Plan | Server/mo | Volume/mo | Domain/mo | Resend/mo | **Total/mo** |
|-------|-------|-------------|-----------|-----------|-----------|-----------|-------------|
| 13 | 12,975 | CX43 | €13.45 | €2.50 (50G) | $0.43 | $20 (Pro) | **~€35** |
| 14 | 19,463 | CX53 (16C/32G/320G) | €23.61 | €2.50 | $0.43 | $20 | **~€44** |
| 15 | 29,194 | CX53 | €23.61 | €5.00 (100G) | $0.43 | $90 (Scale) | **~€94** |
| 16 | 43,791 | CX53 | €23.61 | €7.50 (150G) | $0.43 | $90 | **~€96** |
| 17 | 65,687 | CX53 + 2nd VPS | €47.22 | €10.00 | $0.43 | $90 | **~€122** |
| 18 | 98,530 | Multi-server | €70.00 | €15.00 | $0.43 | $90 | **~€150** |

**Year 2 Total: ~€450** (server) + **$5.15** (domain) + **~$500** (Resend) = **~€910** (est.)

---

## 7. Multi-Year Cost Summary

| Year | Users (end) | Avg Monthly Cost | Annual Total | Domain | Resend | **Grand Total** |
|------|-------------|-----------------|-------------|--------|--------|----------------|
| 1 | ~8,650 | ~€15 | ~€87 | $4.12 | ~$100 | **~€183** |
| 2 | ~98,530 | ~€76 | ~€450 | $5.15 | ~$500 | **~€910** |
| 3 | ~1.1M+ | ~€240 | ~€1,800 | $5.41 | ~$1,080 | **~€2,870** |
| 4 | Plateau | ~€290 | ~€2,400 | $5.68 | ~$1,080 | **~€3,470** |
| 5 | Plateau | ~€300 | ~€2,520 | $5.96 | ~$1,080 | **~€3,590** |

> Year 3+ assumes growth slows significantly and plateaus. 1.5x monthly growth is unsustainable long-term — realistic marketplaces plateau at 10-50K active users.

---

## 8. Upgrade Decision Guide

| Trigger | Action | Downtime | Reversible? |
|---------|--------|----------|-------------|
| CPU > 80% sustained | Upgrade plan (CX23→CX33→CX43→CX53) | ~1 min | Yes (CPU/RAM only) |
| RAM > 85% | Upgrade plan | ~1 min | Yes (CPU/RAM only) |
| Disk > 70% | Add Volume (no disk upgrade) | None | Yes |
| DAU > 5,000 | Consider CX43 | ~1 min | Yes |
| DAU > 15,000 | Consider CX53 or split services | ~1 min | Yes |
| DAU > 50,000 | Multi-server: separate DB + API | Planned maintenance | — |

### Upgrade path (recommended)

```
Month 1-6:   CX23  (2C / 4G / 40G)    €4.71/mo
Month 7-10:  CX33  (4C / 8G / 80G)    €7.41/mo    ← upgrade CPU+RAM only
Month 11-13: CX43  (8C / 16G / 160G)  €12.81/mo   ← upgrade CPU+RAM only
Month 14+:   CX53  (16C / 32G / 320G) €23.61/mo   ← upgrade CPU+RAM only
Storage:     Add Volumes as needed     €0.05/GB/mo  ← no downtime
```

> Always upgrade CPU+RAM **without** disk expansion so you can downgrade later if needed. Use Volumes for extra storage — they're live-attachable and detachable.

---

## 9. Realistic Cost Scenario

The 1.5x growth model is **optimistic**. Here's what it looks like with more conservative growth:

### Conservative: 20% monthly growth (more realistic for a niche marketplace)

| Month | Users | Plan | Resend | Monthly Cost |
|-------|-------|------|--------|-------------|
| 1 | 100 | CX23 | Free | ~€5 |
| 6 | 249 | CX23 | Free | ~€5 |
| 12 | 619 | CX23 | Free | ~€5 |
| 18 | 1,541 | CX33 | Free | ~€8 |
| 24 | 3,834 | CX33 | Pro ($20) | ~€26 |
| 36 | 23,738 | CX43 | Pro ($20) | ~€32 |

**Year 1 total: ~€60.** You stay on the cheapest VPS plan and the free Resend tier the entire first year.

---

## 10. Donation Revenue Projections

Revenue model: BTC donation address only (no fees, no subscriptions).

### Key Assumptions

| Metric | Bear Case | Conservative | Best Case |
|--------|-----------|-------------|-----------|
| Donor rate (% of active users) | 0.3% | 1% | 3% |
| Avg donation per donor/month | €3 | €5 | €10 |
| Donor retention (stay monthly) | 20% | 40% | 60% |
| Growth rate (monthly users) | 1.1x (10%) | 1.2x (20%) | 1.5x (50%) |

### Bear Case — Slow growth, few donors

Barely anyone donates. Growth is slow. You're paying out of pocket for a while.

| Month | Users | DAU | Donors | Revenue/mo | Costs/mo | **Net/mo** |
|-------|-------|-----|--------|-----------|----------|-----------|
| 1 | 100 | 15 | 0 | €0 | €5 | **-€5** |
| 3 | 121 | 18 | 0 | €0 | €5 | **-€5** |
| 6 | 161 | 24 | 1 | €3 | €5 | **-€2** |
| 12 | 285 | 43 | 1 | €3 | €5 | **-€2** |
| 18 | 506 | 76 | 2 | €6 | €5 | **+€1** |
| 24 | 898 | 135 | 3 | €9 | €5 | **+€4** |
| 36 | 2,827 | 424 | 5 | €15 | €8 | **+€7** |

**Break-even: ~Month 16-18**
Year 1 out-of-pocket: ~€55. Year 2: ~€20 subsidized then profitable.
Total loss before break-even: **~€70**

### Conservative — Steady growth, modest donations

Realistic for a niche privacy marketplace that builds a small loyal community.

| Month | Users | DAU | Donors | Revenue/mo | Costs/mo | **Net/mo** |
|-------|-------|-----|--------|-----------|----------|-----------|
| 1 | 100 | 15 | 0 | €0 | €5 | **-€5** |
| 3 | 144 | 22 | 1 | €5 | €5 | **€0** |
| 6 | 249 | 37 | 2 | €10 | €5 | **+€5** |
| 12 | 619 | 93 | 4 | €20 | €5 | **+€15** |
| 18 | 1,541 | 231 | 8 | €40 | €8 | **+€32** |
| 24 | 3,834 | 575 | 16 | €80 | €8 | **+€72** |
| 36 | 23,738 | 3,561 | 56 | €280 | €14 | **+€266** |

**Break-even: ~Month 3**
Year 1 revenue: ~€120. Year 1 costs: ~€60. **Year 1 profit: ~€60.**
Year 2 revenue: ~€600. Year 2 costs: ~€100. **Year 2 profit: ~€500.**

### Best Case — Viral growth, engaged community

The marketplace fills a real need, word spreads in crypto/privacy communities, users are generous.

| Month | Users | DAU | Donors | Revenue/mo | Costs/mo | **Net/mo** |
|-------|-------|-----|--------|-----------|----------|-----------|
| 1 | 100 | 15 | 1 | €10 | €5 | **+€5** |
| 3 | 225 | 34 | 3 | €30 | €5 | **+€25** |
| 6 | 759 | 114 | 10 | €100 | €5 | **+€95** |
| 12 | 8,650 | 1,298 | 58 | €580 | €13 | **+€567** |
| 18 | 98,530 | 14,780 | 266 | €2,660 | €85 | **+€2,575** |
| 24 | Plateau ~100K | 15,000 | 270 | €2,700 | €90 | **+€2,610** |

**Break-even: Month 1**
Year 1 revenue: ~€3,000. Year 1 costs: ~€91. **Year 1 profit: ~€2,900.**

### Revenue Comparison Chart

```
Monthly Revenue (€) — All Scenarios

€2,700 |                                                          *** BEST
       |                                                   ***
€500   |                                             ***
       |                                       ***
€280   |                                                     ··· CONSERVATIVE
€100   |                               ***              ···
       |                         ***              ···
€40    |                                     ···
€15    |                   ***         ···              --- BEAR
€10    |             ***         ···
€5     |       *** ···     ---
€0     | ··· --- ---
       +----+----+----+----+----+----+----+----→ Month
        1    3    6    9    12   18   24   36
```

### Cumulative Profit/Loss

| Timeframe | Bear | Conservative | Best |
|-----------|------|-------------|------|
| Month 6 | -€28 | -€5 | +€240 |
| Month 12 | -€55 | +€60 | +€2,900 |
| Month 24 | -€20 | +€560 | +€20,000+ |
| Month 36 | +€80 | +€3,500 | +€50,000+ |

---

## 11. Break-Even Analysis

| Scenario | Break-even Month | Users at Break-even | Donors at Break-even |
|----------|-----------------|--------------------|--------------------|
| Bear | ~16-18 | ~450 | 2-3 |
| Conservative | ~3 | ~144 | 1-2 |
| Best | 1 | 100 | 1 |

**The minimum to cover costs: 1 donor giving €5/month.** That's all it takes in the early months when costs are ~€5/month.

---

## 12. Summary: What You Pay Starting Out

| Item | Cost | Frequency |
|------|------|-----------|
| bartr.vip domain | $4.12 (~€3.80) | First year |
| Hetzner CX23 | €4.71 | Monthly |
| SSL certificate | Free | Auto-renews |
| Resend (email verification) | Free (first 7 months) | Monthly |
| **Total to launch** | **~€8.50 first month** | |
| **Total Year 1** | **~€183 / ~$199** | |

That's less than **€8/month** for the first 7 months (free Resend tier covers up to ~1,500 signups/month). Once growth exceeds the free tier, Resend Pro adds $20/month.

Even in the **bear case** (conservative 20% growth), you stay on the free Resend tier for 18+ months and total out-of-pocket before profitability is only ~€70.
