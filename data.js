/* ============================================================
   SPINUP — idea dataset
   8 wheel segments, each a fully formed idea + blueprint
   ============================================================ */
window.SPINUP_DATA = {
  segments: [
    {
      id: "health", label: "Health", color: "#7c3aed",
      title: "VitalLoop",
      tagline: "At-home metabolic coaching from a finger-prick and a phone camera.",
      blurb: "A $39/mo membership that turns a monthly at-home blood panel into a living, AI-personalized nutrition and habit plan — closing the loop between lab work and daily life.",
      validation: {
        verdict: "Strong pull. Consumer health is crowded, but continuous-metabolic coaching for non-diabetics is wide open.",
        demand: 84, competition: "Medium",
        market: { tam: "$214B", tamLabel: "Preventive & metabolic health", growth: "+17%", growthLabel: "CAGR through 2030" },
        signals: [
          { label: "Search demand", value: "‘metabolic health’ +210% in 3y", strength: 88 },
          { label: "Willingness to pay", value: "62% would pay $30–50/mo", strength: 74 },
          { label: "Incumbent gap", value: "No loop between labs & habits", strength: 81 }
        ]
      },
      blueprint: {
        product: { summary: "A loop, not a dashboard. Test → insight → one weekly experiment → re-test.",
          features: ["Mail-in metabolic panel with 48h turnaround", "AI coach that proposes ONE change per week", "Habit streaks tied to real biomarkers"] },
        gtm: { summary: "Land with biohacker creators, expand to anxious-but-healthy 30-somethings.",
          channels: ["Creator affiliate program (15% rev share)", "Employer wellness bundles", "‘Free baseline panel’ acquisition offer"] },
        infra: { summary: "Asset-light: partner CLIA lab, own the software + logistics layer.",
          stack: ["Partner CLIA lab network", "HIPAA-ready backend", "LLM coach w/ guardrails", "Stripe subscriptions"] },
        proto: { summary: "Mobile-first PWA. Three core screens carry the whole experience.",
          screens: ["Results timeline", "This week’s experiment", "Re-test reminder"] }
      }
    },
    {
      id: "climate", label: "Climate", color: "#9333ea",
      title: "Cumulus",
      tagline: "A marketplace for verified carbon credits from small regenerative farms.",
      blurb: "Pairs satellite + soil-sensor verification with a clean buying experience so mid-market companies can fund real, local soil carbon — not sketchy offsets.",
      validation: {
        verdict: "Regulatory tailwinds are real, but trust is the entire battle. Verification IS the product.",
        demand: 71, competition: "High",
        market: { tam: "$96B", tamLabel: "Voluntary carbon market by 2030", growth: "+31%", growthLabel: "CAGR" },
        signals: [
          { label: "Buyer urgency", value: "Scope-3 reporting now mandatory in EU", strength: 79 },
          { label: "Supply gap", value: "Small farms locked out of credit sales", strength: 83 },
          { label: "Trust deficit", value: "47% distrust existing offsets", strength: 64 }
        ]
      },
      blueprint: {
        product: { summary: "Verification-first marketplace: every credit ships with a satellite + soil receipt.",
          features: ["Satellite MRV with per-acre soil sampling", "Public ‘proof page’ per credit", "Buyer portfolio dashboard"] },
        gtm: { summary: "Sell to sustainability leads at mid-market brands; recruit farms via co-ops.",
          channels: ["Farm co-op partnerships", "Sustainability-officer outbound", "Open verification standard as moat"] },
        infra: { summary: "Heavy on data pipeline + registry integration; light on physical assets.",
          stack: ["Satellite imagery API", "IoT soil sensors", "Credit registry integration", "Postgres + geospatial"] },
        proto: { summary: "Two-sided web app — a buyer storefront and a farmer onboarding flow.",
          screens: ["Credit storefront", "Proof page", "Farm onboarding"] }
      }
    },
    {
      id: "fintech", label: "Fintech", color: "#c026d3",
      title: "Float",
      tagline: "Zero-fee instant payroll advances for gig and shift workers.",
      blurb: "Workers tap earned-but-unpaid wages instantly; employers pay a flat platform fee. No predatory interest, no tips, no overdraft — just access to money already earned.",
      validation: {
        verdict: "Massive demand, thin margins. Wins on employer distribution, not consumer ads.",
        demand: 90, competition: "Medium",
        market: { tam: "$28B", tamLabel: "Earned-wage access by 2028", growth: "+24%", growthLabel: "CAGR" },
        signals: [
          { label: "Worker pain", value: "78% of US workers live paycheck-to-paycheck", strength: 92 },
          { label: "Employer benefit", value: "EWA cuts turnover ~19%", strength: 80 },
          { label: "Regulatory shift", value: "EWA carve-outs from lending rules", strength: 66 }
        ]
      },
      blueprint: {
        product: { summary: "Boring on purpose. Instant, transparent, flat-fee access to earned wages.",
          features: ["Real-time earned-wage ledger", "Instant payout to any debit card", "Auto-reconcile on payday"] },
        gtm: { summary: "B2B2C — sell to HR/ops as a retention benefit; workers self-onboard.",
          channels: ["Payroll-platform integrations", "Staffing-agency partnerships", "Referral inside the app"] },
        infra: { summary: "Risk + ledger is the hard part. Push money movement to partners.",
          stack: ["Payroll API integrations", "Ledger + risk engine", "Card-network payout rails", "Plaid"] },
        proto: { summary: "Dead-simple mobile app — the balance and one button do the work.",
          screens: ["Available balance", "Instant cash out", "Repayment timeline"] }
      }
    },
    {
      id: "creator", label: "Creator", color: "#db2777",
      title: "Encore",
      tagline: "Turn a podcast or video back-catalog into a searchable, sellable course.",
      blurb: "Point Encore at years of episodes; it restructures them into a navigable, searchable curriculum creators can sell — unlocking the value buried in the archive.",
      validation: {
        verdict: "Great wedge product. Risk is creator churn — must produce revenue fast.",
        demand: 76, competition: "Medium",
        market: { tam: "$47B", tamLabel: "Creator economy tooling", growth: "+22%", growthLabel: "CAGR" },
        signals: [
          { label: "Latent supply", value: "Millions of hrs of evergreen archive", strength: 85 },
          { label: "Monetization gap", value: "Creators earn <5% from back-catalog", strength: 78 },
          { label: "AI unlock", value: "Transcription + structuring now cheap", strength: 72 }
        ]
      },
      blueprint: {
        product: { summary: "Ingest the archive → AI builds modules, chapters, and search.",
          features: ["Auto-curriculum from raw episodes", "Semantic search across everything", "Hosted, sellable course pages"] },
        gtm: { summary: "Pursue mid-tail creators with deep archives and small teams.",
          channels: ["Podcast-host integrations", "‘Audit your archive’ free report", "Creator-newsletter sponsorships"] },
        infra: { summary: "Pipeline-heavy: transcription, embeddings, structuring, hosting.",
          stack: ["Whisper transcription", "Vector embeddings", "LLM structuring", "Course hosting + payments"] },
        proto: { summary: "Web studio + a clean learner-facing course player.",
          screens: ["Archive importer", "Curriculum editor", "Course player"] }
      }
    },
    {
      id: "ai", label: "AI Tools", color: "#ff4d8d",
      title: "Bench",
      tagline: "An AI ops analyst that watches your dashboards and pings you before things break.",
      blurb: "Connect your data tools; Bench learns what ‘normal’ looks like, flags anomalies in plain English, and drafts the Slack message you’d send — your always-on analyst.",
      validation: {
        verdict: "Hot category, fast-moving. Differentiation = trust + signal-to-noise, not model access.",
        demand: 82, competition: "High",
        market: { tam: "$62B", tamLabel: "Data & analytics tooling", growth: "+27%", growthLabel: "CAGR" },
        signals: [
          { label: "Team pain", value: "Analysts spend 40% of time on monitoring", strength: 81 },
          { label: "Budget shift", value: "AI line-items now in ops budgets", strength: 77 },
          { label: "Noise risk", value: "Alert fatigue kills most tools", strength: 58 }
        ]
      },
      blueprint: {
        product: { summary: "Fewer, better alerts. Every ping comes with a draft explanation + action.",
          features: ["Anomaly detection on any metric", "Plain-English root-cause drafts", "One-click Slack / ticket handoff"] },
        gtm: { summary: "Bottoms-up PLG into data teams, then expand to ops & finance.",
          channels: ["Free tier wired to dashboards", "Data-influencer partnerships", "Usage-based expansion"] },
        infra: { summary: "Connectors + a tuned anomaly layer; LLM only for explanation.",
          stack: ["Warehouse + BI connectors", "Anomaly-detection engine", "LLM explanation layer", "Slack / Jira hooks"] },
        proto: { summary: "Lives where work happens — a web feed plus deep Slack integration.",
          screens: ["Signal feed", "Anomaly detail", "Slack digest"] }
      }
    },
    {
      id: "edu", label: "Education", color: "#5b5bf5",
      title: "Cohortly",
      tagline: "Tiny, high-touch cohort classes taught by working domain experts.",
      blurb: "A platform for 8-person, 3-week cohorts where practitioners teach the exact skill they do daily — accountability and access, not another video library.",
      validation: {
        verdict: "Outcomes-driven learning is durable. Operations & instructor supply are the constraint.",
        demand: 68, competition: "Medium",
        market: { tam: "$57B", tamLabel: "Professional upskilling", growth: "+15%", growthLabel: "CAGR" },
        signals: [
          { label: "Completion gap", value: "MOOCs see <10% completion", strength: 83 },
          { label: "Trust shift", value: "Learners prefer practitioners to academics", strength: 70 },
          { label: "Instructor pull", value: "Experts want side income + status", strength: 67 }
        ]
      },
      blueprint: {
        product: { summary: "Small + live + accountable. The cohort is the product, not the content.",
          features: ["8-seat cohorts, capped on purpose", "Built-in accountability + standups", "Outcome guarantee or refund"] },
        gtm: { summary: "Recruit star instructors first; their audience becomes your funnel.",
          channels: ["Instructor revenue share", "Employer L&D budgets", "Alumni referral loops"] },
        infra: { summary: "Scheduling + community + payments; keep teaching live, not pre-recorded.",
          stack: ["Live video + scheduling", "Cohort community layer", "Payments + payouts", "Email automation"] },
        proto: { summary: "A discovery catalog plus an inside-the-cohort workspace.",
          screens: ["Cohort catalog", "Cohort workspace", "Instructor console"] }
      }
    },
    {
      id: "logistics", label: "Logistics", color: "#ff6f61",
      title: "Lastmile",
      tagline: "Shared same-day delivery that finally makes sense for indie retailers.",
      blurb: "Pools deliveries across nearby small shops into shared driver routes — giving independents same-day shipping at a price big-box logistics keeps for themselves.",
      validation: {
        verdict: "Real wedge against incumbents, but density is everything. Win one city block at a time.",
        demand: 73, competition: "High",
        market: { tam: "$48B", tamLabel: "Same-day local delivery", growth: "+19%", growthLabel: "CAGR" },
        signals: [
          { label: "SMB demand", value: "Indies lose sales to same-day gap", strength: 80 },
          { label: "Cost barrier", value: "Solo couriers price out small shops", strength: 76 },
          { label: "Density lever", value: "Pooling cuts per-drop cost ~40%", strength: 71 }
        ]
      },
      blueprint: {
        product: { summary: "Pooled routes. Shops batch into shared runs; customers track in real time.",
          features: ["Auto-batched neighborhood routes", "Live tracking + proof of delivery", "Flat per-drop pricing"] },
        gtm: { summary: "Density-first: saturate one neighborhood, then replicate the playbook.",
          channels: ["Door-to-door merchant signups", "POS-integration partnerships", "Local merchant associations"] },
        infra: { summary: "Routing optimization + driver ops are the moat. Stay marketplace-light.",
          stack: ["Route-optimization engine", "Driver dispatch app", "Merchant POS plugins", "Maps + ETA"] },
        proto: { summary: "Three surfaces: merchant, driver, and a customer tracking page.",
          screens: ["Merchant dispatch", "Driver run", "Customer tracking"] }
      }
    },
    {
      id: "social", label: "Social", color: "#a21caf",
      title: "Campfire",
      tagline: "Small-group audio rooms built for hobby communities, not influencers.",
      blurb: "Cozy, recurring 12-person audio rooms organized around niche hobbies — the warmth of a group call with the discoverability of a community, minus the broadcast noise.",
      validation: {
        verdict: "Audio social is a graveyard of hype — but ‘small + recurring + niche’ is an untested angle.",
        demand: 61, competition: "Low",
        market: { tam: "$19B", tamLabel: "Community & social platforms", growth: "+13%", growthLabel: "CAGR" },
        signals: [
          { label: "Loneliness pull", value: "Demand for small, real groups rising", strength: 75 },
          { label: "Niche gap", value: "Hobbies underserved by big platforms", strength: 69 },
          { label: "Retention risk", value: "Audio social historically churns hard", strength: 44 }
        ]
      },
      blueprint: {
        product: { summary: "Small by design. Capped rooms, recurring schedule, one hobby each.",
          features: ["12-seat recurring rooms", "Hobby-based discovery", "Lightweight host tools"] },
        gtm: { summary: "Seed with existing micro-communities; grow room-by-room, not viral.",
          channels: ["Partner with hobby creators", "Subreddit / Discord seeding", "Host incentive program"] },
        infra: { summary: "Realtime audio + community graph; keep moderation human-scaled.",
          stack: ["WebRTC audio infra", "Community + scheduling DB", "Push notifications", "Moderation tooling"] },
        proto: { summary: "Mobile-first: discovery, the live room, and a host setup flow.",
          screens: ["Room discovery", "Live room", "Host a room"] }
      }
    }
  ]
};
