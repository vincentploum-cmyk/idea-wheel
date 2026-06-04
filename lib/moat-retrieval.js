import { loadLearningContext } from './moat-store';

const MODE_PACKS = {
  B2B: {
    wedgeBias: 'Win by embedding into an expensive workflow, proving time saved, and creating operational lock-in through data + approval loops.',
    proofPoints: ['hours saved per week', 'error reduction', 'faster handoff or approval', 'audit trail or accountability'],
    antiPatterns: ['generic chat wrapper', 'horizontal assistant with no workflow depth', 'idea that requires behavior change before value appears'],
    prototypeMoments: ['before/after queue compression', 'one-click triage or summary', 'automated decision recommendation with rationale'],
  },
  Consumer: {
    wedgeBias: 'Win by delivering fast personal value, habit reinforcement, and a clearly emotional or identity-based payoff.',
    proofPoints: ['time to first value under 60 seconds', 'personalization quality', 'repeat-use trigger', 'shareable result or progress loop'],
    antiPatterns: ['generic companion app', 'too many setup steps', 'utility with no emotional hook'],
    prototypeMoments: ['personalized recommendation instantly', 'habit or streak moment', 'surprising summary or plan generated from small input'],
  },
};

const INDUSTRY_RULES = [
  {
    test: /(health|dental|pharm|veterinary|mental health|insurance|legal|mortgage|government)/i,
    pack: {
      archetype: 'regulated-trust workflow',
      entities: ['account', 'case', 'policy', 'record', 'approval'],
      mustHaves: ['audit trail', 'permissions', 'structured record system', 'human review checkpoint'],
      communityHints: ['compliance-heavy operator groups', 'industry Slack communities', 'association forums'],
      moatAdvice: 'Do not compete on generic AI. Win on trust, reviewability, and workflow fit.',
    },
  },
  {
    test: /(construction|field services|logistics|distribution|trucking|property management|home services|restaurants|cleaning)/i,
    pack: {
      archetype: 'ops-routing workflow',
      entities: ['job', 'route', 'crew', 'ticket', 'location'],
      mustHaves: ['live status board', 'exception handling', 'dispatch or schedule view', 'mobile-friendly operator flow'],
      communityHints: ['trade communities', 'owner-operator forums', 'ops vendor partner groups'],
      moatAdvice: 'Win on daily workflow compression, not on abstract automation claims.',
    },
  },
  {
    test: /(e-commerce|marketing|publishing|content|creator|youtube|tiktok|newsletter|affiliate|etsy|print-on-demand|podcast)/i,
    pack: {
      archetype: 'audience-revenue workflow',
      entities: ['campaign', 'asset', 'offer', 'audience segment', 'conversion event'],
      mustHaves: ['performance deltas', 'content or offer ranking', 'next-best-action recommendations', 'clear monetization loop'],
      communityHints: ['creator communities', 'growth newsletters', 'platform-specific subreddits'],
      moatAdvice: 'Win by turning noisy revenue workflows into repeated decisions, not by generating more content alone.',
    },
  },
  {
    test: /(education|edtech|children|kids|student|college|teacher|homeschool)/i,
    pack: {
      archetype: 'learning-loop workflow',
      entities: ['learner', 'lesson', 'session', 'progress checkpoint', 'practice item'],
      mustHaves: ['progress visibility', 'adaptive feedback', 'parent/teacher summary', 'reward or retention loop'],
      communityHints: ['teacher creator groups', 'parent communities', 'education product communities'],
      moatAdvice: 'Win on progression and retention, not on one-off content generation.',
    },
  },
];

const WORKFLOW_RULES = [
  {
    test: /(onboarding|intake|review|approval|due diligence|compliance|qualification)/i,
    pack: {
      workflowType: 'decision gate',
      uiMoments: ['queue with priorities', 'risk score with evidence', 'approve / reject with reasoning'],
      defensibility: 'Decision gates become sticky when they accumulate history, rationales, and exception patterns.',
    },
  },
  {
    test: /(scheduling|dispatch|routing|handoff|triage)/i,
    pack: {
      workflowType: 'coordination engine',
      uiMoments: ['timeline or board', 'exception alerts', 'recommended next action'],
      defensibility: 'Coordination engines get sticky when they absorb routing logic and team-specific constraints.',
    },
  },
  {
    test: /(budgeting|forecast|score|predict|recommend|analyze)/i,
    pack: {
      workflowType: 'decision support',
      uiMoments: ['scenario comparison', 'trend chart', 'confidence or rationale pane'],
      defensibility: 'Decision support gets sticky when users trust the model because it explains and improves over time.',
    },
  },
];

const ACTION_PACKS = {
  Automate: { moatHint: 'Automation moats come from orchestration depth and exception handling, not just task replacement.' },
  Predict: { moatHint: 'Prediction moats require private data, feedback loops, and trustable explanations.' },
  Detect: { moatHint: 'Detection moats come from labeled edge cases, false-positive tuning, and reviewer workflows.' },
  Personalize: { moatHint: 'Personalization moats come from profile memory and repeated learning, not from one-off LLM responses.' },
  Match: { moatHint: 'Matching moats come from proprietary preference data and better fit signals over time.' },
  Analyze: { moatHint: 'Analysis moats come from domain-specific entities, benchmarks, and reusable insight primitives.' },
};

function mergePacks(...packs) {
  return packs.filter(Boolean).reduce((acc, pack) => {
    for (const [key, value] of Object.entries(pack)) {
      if (Array.isArray(value)) {
        acc[key] = Array.from(new Set([...(acc[key] || []), ...value]));
      } else if (value && typeof value === 'object') {
        acc[key] = { ...(acc[key] || {}), ...value };
      } else if (value && !acc[key]) {
        acc[key] = value;
      }
    }
    return acc;
  }, {});
}

function firstMatchingPack(value, rules) {
  return rules.find((rule) => rule.test.test(value || ''))?.pack || null;
}

export async function buildRetrievalContext({ modeName, industry, action, workflow }) {
  const modePack = MODE_PACKS[modeName] || MODE_PACKS.B2B;
  const industryPack = firstMatchingPack(industry, INDUSTRY_RULES);
  const workflowPack = firstMatchingPack(workflow, WORKFLOW_RULES);
  const actionPack = ACTION_PACKS[action] || null;
  const learning = await loadLearningContext({ modeName, industry, action, workflow });

  const pack = mergePacks(modePack, industryPack, workflowPack, actionPack);
  return {
    summary: {
      mode: modeName,
      industry,
      action,
      workflow,
      archetype: pack.archetype || pack.workflowType || 'general wedge',
      moatAdvice: pack.moatAdvice || pack.moatHint || modePack.wedgeBias,
    },
    entities: pack.entities || [],
    proofPoints: pack.proofPoints || [],
    mustHaves: pack.mustHaves || [],
    antiPatterns: pack.antiPatterns || [],
    prototypeMoments: Array.from(new Set([...(pack.prototypeMoments || []), ...(pack.uiMoments || [])])),
    communityHints: pack.communityHints || [],
    defensibility: pack.defensibility || null,
    learning,
  };
}
