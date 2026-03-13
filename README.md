# Bond Amortization + Repayment Simulator

A personal bond simulator built for a R2,420,000 bond at 9.25% over 360 months.

## Features

### Tab 1 — Simulator
- Adjust principal, rate, and term
- Drag slider or pick presets for extra monthly payment
- Live stats: payoff date, total interest, interest saved
- Remaining balance area chart (base vs. with extra)
- Monthly interest/principal split bar chart
- Full amortization table

### Tab 2 — Rate Change
- Model the upcoming rate drop (9.25% → 8.9%)
- Set which month the rate changes
- See new monthly payment and monthly saving
- Trajectory chart showing before/after

### Tab 3 — Reality Tracker
- Log what you actually paid extra each month
- Compare actual vs projected vs no-extra balance
- Monthly variance table with on-track status
- Bar chart: target vs actual extra payments

## Local dev

```bash
npm install
npm start
```

## Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Or connect the GitHub repo to Vercel dashboard — it will auto-detect Create React App.

## Stack
- React 18
- Recharts (charts)
- Syne + DM Mono (Google Fonts)
- No backend, no DB — all state is in-memory (can extend with localStorage)
