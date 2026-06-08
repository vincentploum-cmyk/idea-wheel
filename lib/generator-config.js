const RAW_MODES = {
  b2b: {
    name: 'B2B',
    connector: 'in the',
    prefix: 'I want to build an agent that',
    labels: ['ACTION', 'WORKFLOW', 'FOR'],
    banks: [
      ['Automates','Streamlines','Manages','Centralizes','Tracks','Handles','Standardizes','Simplifies','Accelerates','Consolidates','Replaces','Organizes','Monitors','Optimizes','Prioritizes'],
      ['time & expense reporting', 'referrals', 'client onboarding', 'invoicing', 'contract management', 'compliance reporting', 'staff scheduling', 'job site inspections', 'quote generation', 'lead management', 'document management', 'project tracking', 'vendor management', 'customer follow-ups', 'payroll', 'performance reviews', 'inventory management', 'billing & collections', 'field operations', 'service request routing', 'safety incident reporting', 'equipment maintenance', 'crew dispatching', 'patient intake', 'referral management', 'renewal reminders', 'work order management', 'quality control checks', 'subcontractor coordination', 'delivery scheduling'],
      ['Healthcare','Legal services','Construction','Logistics','Insurance','Dental practices','Manufacturing','Accounting firms','Property management','Restaurants','Staffing agencies','Real estate','Veterinary clinics','Auto repair shops','Marketing agencies','Financial advisors','Cleaning services','Retail','Physical therapy','Childcare'],
    ],
    pairIndexes: {0: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 1: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 2: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 3: [0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 24, 25, 26, 28], 4: [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28], 5: [0, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 6: [2, 7, 8, 18, 21, 22], 7: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 8: [0, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 23, 24, 25, 26, 28], 9: [0, 2, 3, 4, 5, 7, 9, 10, 12, 13, 14, 15, 16, 17, 20, 21, 23, 24, 25, 26, 27, 28], 10: [0, 2, 3, 4, 5, 9, 10, 13, 14, 16, 17, 19, 20, 23, 24, 25, 26], 11: [0, 1, 2, 4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 24, 25, 26, 27, 28], 12: [0, 1, 4, 5, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28], 13: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 14: [0, 9, 11, 12, 13, 14, 15, 17, 19, 20, 22, 23, 24, 25, 26, 27]},
  },
  consumer: {
    name: 'Consumer',
    connector: 'for',
    prefix: 'I want to make an app that',
    labels: ['ACTION', 'EXPERIENCE', 'FOR'],
    banks: [
      ['Tracks', 'Improves', 'Manages', 'Builds', 'Optimizes', 'Plans', 'Simplifies', 'Coaches', 'Monitors', 'Reduces', 'Strengthens', 'Structures', 'Accelerates', 'Organizes', 'Develops'],
      ['daily habits', 'sleep', 'personal finances', 'mental health', 'fitness', 'meal planning', 'career growth', 'productivity', 'stress', 'skills', 'daily schedule', 'nutrition', 'home routines', 'creative projects', 'work-life balance', 'learning', 'relationships', 'social life', 'spending habits', 'morning routines', 'workout recovery', 'focus & deep work', 'journaling', 'language learning', 'financial independence', 'digital wellbeing', 'parenting', 'reading habits', 'dating', 'side hustle'],
      ['busy professionals', 'new parents', 'college students', 'freelancers', 'athletes', 'small business owners', 'retirees', 'remote workers', 'people with ADHD', 'musicians', 'young adults', 'solopreneurs', 'teachers', 'healthcare workers', 'content creators', 'night shift workers', 'seniors living alone', 'couples', 'first-time homeowners', 'job seekers', 'new graduates', 'introverts', 'chronic illness patients', 'travel enthusiasts', 'new immigrants'],
    ],
    pairIndexes: {0: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 1: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 2: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 3: [0, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29], 4: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 5: [0, 2, 4, 6, 7, 9, 10, 11, 12, 13, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 6: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 7: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29], 8: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 9: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 10: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 29], 11: [0, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29], 12: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 13: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], 14: [0, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 29]},
  },
};

const MODE_NAME_TO_KEY = {
  B2B: 'b2b',
  Consumer: 'consumer',
};

const TARGET_BANK_SIZES = {
  b2b: [12, 24, 16],
  consumer: [12, 24, 18],
};

const MIN_TRAINING_ROWS = 8;
const MIN_PAIR_ROWS = 4;

function slug(value = '') {
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function titleize(value = '') {
  return String(value)
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function toValuePairMap(actions, workflows, pairIndexes) {
  return actions.reduce((acc, action, actionIndex) => {
    acc[action] = (pairIndexes[actionIndex] || []).map((workflowIndex) => workflows[workflowIndex]).filter(Boolean);
    return acc;
  }, {});
}

export const DEFAULT_MODE_CONFIGS = Object.fromEntries(
  Object.entries(RAW_MODES).map(([modeKey, mode]) => [
    modeKey,
    {
      name: mode.name,
      connector: mode.connector,
      prefix: mode.prefix,
      labels: mode.labels,
      banks: mode.banks.map((bank) => [...bank]),
      pairMap: toValuePairMap(mode.banks[0], mode.banks[1], mode.pairIndexes),
    },
  ])
);

function sortByLength(values) {
  return [...values].sort((a, b) => b.length - a.length);
}

function inferValue(text, values) {
  const clean = slug(text);
  return sortByLength(values).find((value) => clean.includes(slug(value))) || null;
}

function inferScope(row) {
  const modeKey = MODE_NAME_TO_KEY[row.modeName] || MODE_NAME_TO_KEY[row.mode_name] || null;
  if (!modeKey) return null;
  const defaults = DEFAULT_MODE_CONFIGS[modeKey];
  const agentText = row.agentDesc || row.agent_desc || row.freeformIdea || '';
  const action = row.action || inferValue(agentText, defaults.banks[0]);
  const workflow = row.workflow || inferValue(agentText, defaults.banks[1]);
  const industry = row.industry || inferValue(agentText, defaults.banks[2]);
  if (!action || !workflow || !industry) return null;
  return { modeKey, action, workflow, industry };
}

function getNestedScore(row) {
  const overall = row?.eval?.scores?.overall || row?.eval?.scores?.Overall || 0;
  if (!overall) return 0;
  return Math.max(-2.5, Math.min(5, (overall - 55) / 10));
}

function validationWeight(row) {
  const verdict = row.verdictType || row.verdict_type || row?.judge?.decision;
  const base = verdict === 'build' ? 7 : verdict === 'warning' ? 1.5 : verdict === 'avoid' ? -6 : 0;
  const confidence = row?.judge?.confidence === 'high' ? 1 : row?.judge?.confidence === 'low' ? -0.75 : 0;
  return base + confidence + getNestedScore(row);
}

function outcomeWeight(signal) {
  switch (signal) {
    case 'blueprint_completed': return 10;
    case 'blueprint_started': return 6;
    case 'blueprint_copied': return 6;
    case 'shortlist_saved': return 4;
    case 'market_scan_completed': return 3;
    case 'designer_completed': return 2;
    case 'launch_completed': return 2;
    case 'infra_completed': return 1.5;
    default: return 0.5;
  }
}

function bucketFor(map, key) {
  if (!map.has(key)) {
    map.set(key, { score: 0, count: 0 });
  }
  return map.get(key);
}

function applyScore(map, key, delta) {
  const bucket = bucketFor(map, key);
  bucket.score += delta;
  bucket.count += 1;
}

function valueMetric(stats, value, index) {
  const stat = stats.get(value) || { score: 0, count: 0 };
  const defaultBias = Math.max(0, 2 - index * 0.08);
  const supportBonus = Math.min(2.5, stat.count * 0.35);
  return {
    value,
    score: stat.score + supportBonus + defaultBias,
    count: stat.count,
    rawScore: stat.score,
    defaultIndex: index,
  };
}

function selectBank(defaultBank, stats, targetSize, enabled) {
  if (!enabled) {
    return {
      values: [...defaultBank],
      weights: defaultBank.map(() => 1),
    };
  }

  const ranked = defaultBank
    .map((value, index) => valueMetric(stats, value, index))
    .sort((a, b) => {
      if (Math.abs(b.score - a.score) < 0.8) return a.defaultIndex - b.defaultIndex;
      return b.score - a.score;
    });

  const kept = ranked.slice(0, targetSize).sort((a, b) => b.score - a.score);
  return {
    values: kept.map((item) => item.value),
    weights: kept.map((item) => Math.max(0.35, Math.min(6, 1 + item.score / 6))),
  };
}

function pairMetric(stats, key) {
  return stats.get(key) || { score: 0, count: 0 };
}

function scoreTrainingData({ validations = [], outcomes = [] }) {
  const scorecard = Object.fromEntries(
    Object.keys(DEFAULT_MODE_CONFIGS).map((modeKey) => [modeKey, {
      actions: new Map(),
      workflows: new Map(),
      industries: new Map(),
      actionWorkflow: new Map(),
      workflowIndustry: new Map(),
      validationCount: 0,
      outcomeCount: 0,
    }])
  );

  for (const row of validations) {
    const scope = inferScope(row);
    if (!scope) continue;
    const card = scorecard[scope.modeKey];
    const delta = validationWeight(row);
    card.validationCount += 1;
    applyScore(card.actions, scope.action, delta);
    applyScore(card.workflows, scope.workflow, delta);
    applyScore(card.industries, scope.industry, delta);
    applyScore(card.actionWorkflow, `${scope.action}::${scope.workflow}`, delta * 1.15);
    applyScore(card.workflowIndustry, `${scope.workflow}::${scope.industry}`, delta);
  }

  for (const row of outcomes) {
    const scope = inferScope(row);
    if (!scope) continue;
    const card = scorecard[scope.modeKey];
    const delta = outcomeWeight(row.signal);
    card.outcomeCount += 1;
    applyScore(card.actions, scope.action, delta);
    applyScore(card.workflows, scope.workflow, delta);
    applyScore(card.industries, scope.industry, delta);
    applyScore(card.actionWorkflow, `${scope.action}::${scope.workflow}`, delta * 1.35);
    applyScore(card.workflowIndustry, `${scope.workflow}::${scope.industry}`, delta * 1.15);
  }

  return scorecard;
}

function buildPairMap(modeKey, selectedActions, selectedWorkflows, scorecard) {
  const defaults = DEFAULT_MODE_CONFIGS[modeKey];
  const pairMap = {};
  const pairWeights = {};

  for (const action of selectedActions) {
    const allowed = (defaults.pairMap[action] || []).filter((workflow) => selectedWorkflows.includes(workflow));
    if (!allowed.length) continue;

    const ranked = allowed
      .map((workflow) => {
        const pair = pairMetric(scorecard.actionWorkflow, `${action}::${workflow}`);
        return {
          workflow,
          count: pair.count,
          score: pair.score + ((scorecard.workflows.get(workflow)?.score || 0) * 0.35),
        };
      })
      .sort((a, b) => b.score - a.score);

    const hasTraining = ranked.reduce((sum, item) => sum + item.count, 0) >= MIN_PAIR_ROWS;
    const kept = hasTraining ? ranked.slice(0, Math.max(6, Math.ceil(ranked.length * 0.72))) : ranked;

    pairMap[action] = kept.map((item) => item.workflow);
    pairWeights[action] = Object.fromEntries(
      kept.map((item) => [item.workflow, Math.max(0.35, Math.min(6, 1 + item.score / 6))])
    );
  }

  return { pairMap, pairWeights };
}

function buildWorkflowIndustryWeights(selectedWorkflows, selectedIndustries, scorecard) {
  const result = {};
  for (const workflow of selectedWorkflows) {
    result[workflow] = Object.fromEntries(
      selectedIndustries.map((industry) => {
        const pair = pairMetric(scorecard.workflowIndustry, `${workflow}::${industry}`);
        const industryScore = scorecard.industries.get(industry)?.score || 0;
        const weight = Math.max(0.35, Math.min(6, 1 + (pair.score + industryScore * 0.25) / 6));
        return [industry, weight];
      })
    );
  }
  return result;
}

function modeMeta(modeKey, scorecard, selectedBanks) {
  return {
    modeKey,
    trainingRows: scorecard.validationCount + scorecard.outcomeCount,
    validationRows: scorecard.validationCount,
    outcomeRows: scorecard.outcomeCount,
    actions: selectedBanks[0].length,
    workflows: selectedBanks[1].length,
    industries: selectedBanks[2].length,
  };
}

export function buildAdaptiveGeneratorConfig(trainingData = {}) {
  const scorecard = scoreTrainingData(trainingData);
  const modes = {};
  const meta = {};

  for (const [modeKey, defaults] of Object.entries(DEFAULT_MODE_CONFIGS)) {
    const card = scorecard[modeKey];
    const trainingRows = card.validationCount + card.outcomeCount;
    const enabled = trainingRows >= MIN_TRAINING_ROWS;
    const targetSizes = TARGET_BANK_SIZES[modeKey] || defaults.banks.map((bank) => bank.length);

    const actionBank = selectBank(defaults.banks[0], card.actions, targetSizes[0], enabled);
    const workflowBank = selectBank(defaults.banks[1], card.workflows, targetSizes[1], enabled);
    const industryBank = selectBank(defaults.banks[2], card.industries, targetSizes[2], enabled);

    const selectedBanks = [actionBank.values, workflowBank.values, industryBank.values];
    const { pairMap, pairWeights } = buildPairMap(modeKey, actionBank.values, workflowBank.values, card);
    const workflowIndustryWeights = buildWorkflowIndustryWeights(workflowBank.values, industryBank.values, card);

    modes[modeKey] = {
      ...defaults,
      banks: selectedBanks,
      weights: [actionBank.weights, workflowBank.weights, industryBank.weights],
      pairMap,
      pairWeights,
      workflowIndustryWeights,
      learning: {
        enabled,
        trainingRows,
      },
    };
    meta[modeKey] = modeMeta(modeKey, card, selectedBanks);
  }

  return {
    modes,
    meta,
    generatedAt: new Date().toISOString(),
  };
}

export function buildGeneratorIdea(modeConfig, action, workflow, industry) {
  const title = `${titleize(workflow)} for ${titleize(industry)}`;
  const verb = slug(action);
  return {
    action,
    workflow,
    industry,
    connector: modeConfig.connector,
    modeName: modeConfig.name,
    label: modeConfig.name,
    title,
    tagline: modeConfig.name === 'B2B'
      ? `A B2B agent that ${verb} ${workflow} in the ${industry} industry.`
      : `A consumer app that ${verb} ${workflow} for ${industry}.`,
    blurb: modeConfig.name === 'B2B'
      ? `Built for ${industry} teams that need to ${verb} ${workflow} faster, with less manual work and more consistency.`
      : `Built for ${industry} who want a simpler way to ${verb} ${workflow} without another bloated app.`,
    freeformIdea: modeConfig.name === 'B2B'
      ? `${verb} ${workflow} in the ${industry} industry`
      : `${verb} ${workflow} ${modeConfig.connector} ${industry}`,
  };
}
