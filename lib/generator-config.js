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

const B2B_WORKFLOW_INDUSTRY_MAP = {
  'employee certification expiration tracking': ['field-service SMBs', 'independent auto repair shops', 'Healthcare', 'Construction', 'Logistics', 'Dental practices', 'Manufacturing', 'Property management'],
  'proactive job status sms updates': ['field-service SMBs', 'independent auto repair shops', 'Logistics', 'Property management'],
  'product photo upload': ['Shopify owners', 'Amazon FBA and MFN sellers', 'Shopify sellers of tea, coffee, spices, candle and soap supplies', 'Shopify bulk goods sellers'],
  'suppressed listing corrections': ['Amazon FBA and MFN sellers'],
  'bulk inventory across pack sizes': ['Shopify owners', 'Shopify sellers of tea, coffee, spices, candle and soap supplies', 'Shopify bulk goods sellers', 'Manufacturing', 'Restaurants'],
  'weight-based inventory deduction across variant sizes': ['Shopify sellers of tea, coffee, spices, candle and soap supplies', 'Shopify bulk goods sellers', 'Manufacturing', 'Restaurants'],
  'time & expense reporting': ['field-service SMBs', 'independent auto repair shops', 'Healthcare', 'Construction', 'Logistics', 'Insurance', 'Dental practices', 'Manufacturing', 'Accounting firms', 'Property management'],
  referrals: ['Healthcare', 'Legal services', 'Insurance', 'Dental practices', 'Accounting firms', 'Property management'],
  'client onboarding': ['Healthcare', 'Legal services', 'Insurance', 'Accounting firms', 'Property management', 'Manufacturing'],
  invoicing: ['field-service SMBs', 'independent auto repair shops', 'Shopify owners', 'Amazon FBA and MFN sellers', 'Healthcare', 'Legal services', 'Construction', 'Logistics', 'Insurance', 'Dental practices', 'Manufacturing', 'Accounting firms', 'Property management', 'Restaurants'],
  'contract management': ['Healthcare', 'Legal services', 'Construction', 'Logistics', 'Insurance', 'Manufacturing', 'Accounting firms', 'Property management'],
  'compliance reporting': ['field-service SMBs', 'independent auto repair shops', 'Healthcare', 'Construction', 'Logistics', 'Insurance', 'Dental practices', 'Manufacturing', 'Property management', 'Restaurants'],
  'staff scheduling': ['field-service SMBs', 'independent auto repair shops', 'Healthcare', 'Construction', 'Logistics', 'Dental practices', 'Manufacturing', 'Property management', 'Restaurants'],
  'job site inspections': ['field-service SMBs', 'Construction', 'Logistics', 'Manufacturing', 'Property management'],
  'quote generation': ['field-service SMBs', 'independent auto repair shops', 'Legal services', 'Construction', 'Insurance', 'Manufacturing', 'Property management'],
  'lead management': ['field-service SMBs', 'independent auto repair shops', 'Shopify owners', 'Amazon FBA and MFN sellers', 'Healthcare', 'Legal services', 'Construction', 'Insurance', 'Dental practices', 'Manufacturing', 'Accounting firms', 'Property management', 'Restaurants'],
  'document management': ['field-service SMBs', 'independent auto repair shops', 'Healthcare', 'Legal services', 'Construction', 'Logistics', 'Insurance', 'Dental practices', 'Manufacturing', 'Accounting firms', 'Property management'],
  'project tracking': ['field-service SMBs', 'Legal services', 'Construction', 'Logistics', 'Manufacturing', 'Property management'],
  'vendor management': ['independent auto repair shops', 'Shopify owners', 'Shopify sellers of tea, coffee, spices, candle and soap supplies', 'Shopify bulk goods sellers', 'Healthcare', 'Logistics', 'Dental practices', 'Manufacturing', 'Property management', 'Restaurants'],
  'customer follow-ups': ['field-service SMBs', 'independent auto repair shops', 'Shopify owners', 'Amazon FBA and MFN sellers', 'Healthcare', 'Legal services', 'Insurance', 'Dental practices', 'Accounting firms', 'Property management', 'Restaurants'],
  payroll: ['field-service SMBs', 'independent auto repair shops', 'Healthcare', 'Construction', 'Logistics', 'Dental practices', 'Manufacturing', 'Accounting firms', 'Property management', 'Restaurants'],
  'performance reviews': ['field-service SMBs', 'independent auto repair shops', 'Healthcare', 'Construction', 'Logistics', 'Dental practices', 'Manufacturing', 'Accounting firms', 'Property management', 'Restaurants'],
  'inventory management': ['independent auto repair shops', 'Shopify owners', 'Amazon FBA and MFN sellers', 'Shopify sellers of tea, coffee, spices, candle and soap supplies', 'Shopify bulk goods sellers', 'Healthcare', 'Logistics', 'Manufacturing', 'Restaurants'],
  'billing & collections': ['field-service SMBs', 'independent auto repair shops', 'Healthcare', 'Legal services', 'Logistics', 'Insurance', 'Dental practices', 'Accounting firms', 'Property management', 'Restaurants'],
  'field operations': ['field-service SMBs', 'independent auto repair shops', 'Construction', 'Logistics', 'Manufacturing', 'Property management'],
  'service request routing': ['field-service SMBs', 'independent auto repair shops', 'Healthcare', 'Legal services', 'Property management'],
  'safety incident reporting': ['field-service SMBs', 'independent auto repair shops', 'Healthcare', 'Construction', 'Logistics', 'Manufacturing', 'Restaurants'],
  'equipment maintenance': ['field-service SMBs', 'independent auto repair shops', 'Construction', 'Logistics', 'Manufacturing', 'Property management', 'Restaurants'],
  'crew dispatching': ['field-service SMBs', 'independent auto repair shops', 'Construction', 'Logistics', 'Property management'],
  'patient intake': ['Healthcare', 'Dental practices'],
  'referral management': ['Healthcare', 'Insurance', 'Dental practices'],
  'renewal reminders': ['field-service SMBs', 'independent auto repair shops', 'Legal services', 'Insurance', 'Property management'],
  'work order management': ['field-service SMBs', 'independent auto repair shops', 'Construction', 'Logistics', 'Manufacturing', 'Property management'],
  'quality control checks': ['Shopify sellers of tea, coffee, spices, candle and soap supplies', 'Shopify bulk goods sellers', 'Construction', 'Logistics', 'Manufacturing', 'Restaurants'],
  'subcontractor coordination': ['field-service SMBs', 'Construction', 'Manufacturing', 'Property management'],
  'delivery scheduling': ['Shopify owners', 'Amazon FBA and MFN sellers', 'Logistics', 'Restaurants'],
};

const CONSUMER_ACTION_WORKFLOW_MAP = {
  Tracks: ['daily habits', 'sleep', 'personal finances', 'fitness', 'meal planning', 'career growth', 'productivity', 'stress', 'skills', 'daily schedule', 'nutrition', 'home routines', 'creative projects', 'work-life balance', 'learning', 'spending habits', 'morning routines', 'workout recovery', 'focus & deep work', 'journaling', 'language learning', 'financial independence', 'digital wellbeing', 'parenting', 'reading habits', 'dating', 'side hustle'],
  Improves: ['daily habits', 'sleep', 'personal finances', 'mental health', 'fitness', 'meal planning', 'career growth', 'productivity', 'stress', 'skills', 'daily schedule', 'nutrition', 'home routines', 'creative projects', 'work-life balance', 'learning', 'relationships', 'social life', 'spending habits', 'morning routines', 'workout recovery', 'focus & deep work', 'journaling', 'language learning', 'financial independence', 'digital wellbeing', 'parenting', 'reading habits', 'dating', 'side hustle'],
  Manages: ['personal finances', 'mental health', 'fitness', 'meal planning', 'productivity', 'stress', 'daily schedule', 'nutrition', 'home routines', 'work-life balance', 'relationships', 'social life', 'spending habits', 'morning routines', 'digital wellbeing', 'parenting', 'dating', 'side hustle'],
  Builds: ['daily habits', 'fitness', 'career growth', 'productivity', 'skills', 'home routines', 'creative projects', 'learning', 'morning routines', 'focus & deep work', 'language learning', 'financial independence', 'reading habits', 'side hustle'],
  Optimizes: ['sleep', 'personal finances', 'fitness', 'meal planning', 'career growth', 'productivity', 'stress', 'daily schedule', 'nutrition', 'home routines', 'work-life balance', 'spending habits', 'morning routines', 'workout recovery', 'focus & deep work', 'digital wellbeing', 'side hustle'],
  Plans: ['personal finances', 'fitness', 'meal planning', 'career growth', 'daily schedule', 'nutrition', 'home routines', 'creative projects', 'work-life balance', 'social life', 'spending habits', 'morning routines', 'language learning', 'financial independence', 'parenting', 'reading habits', 'dating', 'side hustle'],
  Simplifies: ['personal finances', 'mental health', 'meal planning', 'productivity', 'daily schedule', 'nutrition', 'home routines', 'work-life balance', 'relationships', 'social life', 'spending habits', 'morning routines', 'digital wellbeing', 'parenting', 'reading habits', 'dating', 'side hustle'],
  Coaches: ['sleep', 'fitness', 'meal planning', 'career growth', 'productivity', 'stress', 'skills', 'nutrition', 'work-life balance', 'learning', 'relationships', 'social life', 'workout recovery', 'focus & deep work', 'journaling', 'language learning', 'dating', 'side hustle'],
  Monitors: ['sleep', 'personal finances', 'mental health', 'fitness', 'stress', 'daily schedule', 'nutrition', 'spending habits', 'workout recovery', 'digital wellbeing', 'parenting'],
  Reduces: ['sleep', 'mental health', 'stress', 'work-life balance', 'digital wellbeing', 'parenting', 'dating'],
  Strengthens: ['daily habits', 'mental health', 'fitness', 'career growth', 'productivity', 'skills', 'work-life balance', 'learning', 'relationships', 'social life', 'morning routines', 'focus & deep work', 'language learning', 'reading habits', 'side hustle'],
  Structures: ['daily habits', 'meal planning', 'productivity', 'skills', 'daily schedule', 'home routines', 'creative projects', 'learning', 'spending habits', 'morning routines', 'journaling', 'language learning', 'parenting', 'reading habits', 'side hustle'],
  Accelerates: ['career growth', 'productivity', 'skills', 'learning', 'social life', 'workout recovery', 'focus & deep work', 'language learning', 'financial independence', 'dating', 'side hustle'],
  Organizes: ['personal finances', 'meal planning', 'productivity', 'daily schedule', 'nutrition', 'home routines', 'creative projects', 'learning', 'social life', 'spending habits', 'morning routines', 'journaling', 'parenting', 'reading habits', 'side hustle'],
  Develops: ['daily habits', 'fitness', 'career growth', 'skills', 'creative projects', 'learning', 'relationships', 'social life', 'language learning', 'reading habits', 'side hustle'],
};

const CONSUMER_WORKFLOW_INDUSTRY_MAP = {
  'daily habits': ['busy professionals', 'new parents', 'college students', 'freelancers', 'remote workers', 'people with ADHD', 'young adults', 'solopreneurs', 'teachers', 'content creators', 'night shift workers', 'job seekers', 'new graduates', 'new immigrants'],
  sleep: ['new parents', 'college students', 'athletes', 'retirees', 'remote workers', 'people with ADHD', 'healthcare workers', 'night shift workers', 'seniors living alone', 'chronic illness patients', 'travel enthusiasts'],
  'personal finances': ['busy professionals', 'college students', 'freelancers', 'small business owners', 'young adults', 'solopreneurs', 'teachers', 'first-time homeowners', 'job seekers', 'new graduates', 'new immigrants'],
  'mental health': ['busy professionals', 'new parents', 'college students', 'freelancers', 'remote workers', 'people with ADHD', 'teachers', 'healthcare workers', 'night shift workers', 'introverts', 'chronic illness patients', 'new immigrants'],
  fitness: ['busy professionals', 'college students', 'freelancers', 'athletes', 'remote workers', 'young adults', 'content creators'],
  'meal planning': ['busy professionals', 'new parents', 'college students', 'athletes', 'remote workers', 'healthcare workers', 'night shift workers', 'first-time homeowners', 'chronic illness patients'],
  'career growth': ['busy professionals', 'college students', 'freelancers', 'remote workers', 'young adults', 'solopreneurs', 'teachers', 'healthcare workers', 'content creators', 'job seekers', 'new graduates', 'new immigrants'],
  productivity: ['busy professionals', 'college students', 'freelancers', 'remote workers', 'people with ADHD', 'musicians', 'solopreneurs', 'teachers', 'healthcare workers', 'content creators', 'job seekers', 'new graduates'],
  stress: ['busy professionals', 'new parents', 'college students', 'freelancers', 'remote workers', 'people with ADHD', 'teachers', 'healthcare workers', 'night shift workers', 'chronic illness patients', 'new immigrants'],
  skills: ['busy professionals', 'college students', 'freelancers', 'musicians', 'young adults', 'solopreneurs', 'teachers', 'content creators', 'job seekers', 'new graduates', 'new immigrants'],
  'daily schedule': ['busy professionals', 'new parents', 'college students', 'freelancers', 'remote workers', 'people with ADHD', 'teachers', 'healthcare workers', 'content creators', 'night shift workers'],
  nutrition: ['busy professionals', 'new parents', 'athletes', 'remote workers', 'healthcare workers', 'chronic illness patients', 'first-time homeowners'],
  'home routines': ['busy professionals', 'new parents', 'retirees', 'remote workers', 'seniors living alone', 'couples', 'first-time homeowners', 'new immigrants'],
  'creative projects': ['freelancers', 'musicians', 'remote workers', 'young adults', 'solopreneurs', 'content creators', 'introverts'],
  'work-life balance': ['busy professionals', 'new parents', 'freelancers', 'remote workers', 'solopreneurs', 'teachers', 'healthcare workers', 'content creators', 'night shift workers'],
  learning: ['college students', 'freelancers', 'retirees', 'remote workers', 'people with ADHD', 'musicians', 'young adults', 'teachers', 'job seekers', 'new graduates', 'new immigrants'],
  relationships: ['new parents', 'couples', 'young adults', 'introverts', 'new immigrants', 'chronic illness patients'],
  'social life': ['college students', 'freelancers', 'remote workers', 'young adults', 'introverts', 'new immigrants', 'travel enthusiasts'],
  'spending habits': ['busy professionals', 'college students', 'freelancers', 'small business owners', 'young adults', 'first-time homeowners', 'new graduates', 'new immigrants'],
  'morning routines': ['busy professionals', 'new parents', 'athletes', 'remote workers', 'people with ADHD', 'content creators', 'job seekers'],
  'workout recovery': ['busy professionals', 'college students', 'athletes'],
  'focus & deep work': ['busy professionals', 'college students', 'freelancers', 'remote workers', 'people with ADHD', 'musicians', 'solopreneurs', 'teachers', 'content creators', 'job seekers'],
  journaling: ['busy professionals', 'college students', 'freelancers', 'retirees', 'remote workers', 'introverts', 'chronic illness patients'],
  'language learning': ['college students', 'freelancers', 'retirees', 'remote workers', 'young adults', 'teachers', 'travel enthusiasts', 'new immigrants'],
  'financial independence': ['busy professionals', 'freelancers', 'small business owners', 'young adults', 'solopreneurs', 'first-time homeowners', 'new graduates'],
  'digital wellbeing': ['busy professionals', 'new parents', 'college students', 'remote workers', 'people with ADHD', 'content creators', 'young adults'],
  parenting: ['new parents', 'couples'],
  'reading habits': ['college students', 'retirees', 'remote workers', 'young adults', 'teachers', 'introverts', 'new graduates'],
  dating: ['college students', 'freelancers', 'remote workers', 'young adults', 'introverts', 'new immigrants', 'travel enthusiasts'],
  'side hustle': ['busy professionals', 'college students', 'freelancers', 'small business owners', 'remote workers', 'young adults', 'solopreneurs', 'content creators', 'job seekers', 'new graduates', 'new immigrants'],
};

const CURATED_PAIR_MAPS = {
  consumer: CONSUMER_ACTION_WORKFLOW_MAP,
};

const DISPLAY_ALIASES = {
  b2b: {
    actions: {
      Accelerates: 'Expedites',
    },
    workflows: {
      'employee certification expiration tracking': 'certification renewal tracking',
      'proactive job status sms updates': 'job status text updates',
      'product photo upload': 'photo upload',
      'suppressed listing corrections': 'listing suppression fixes',
      'bulk inventory across pack sizes': 'pack-size inventory tracking',
      'weight-based inventory deduction across variant sizes': 'weight-based inventory deduction',
    },
    industries: {
      'field-service SMBs': 'field service teams',
      'independent auto repair shops': 'auto repair shops',
      'Shopify owners': 'online stores (Shopify)',
      'Amazon FBA and MFN sellers': 'Amazon sellers (FBA/MFN)',
      'Shopify sellers of tea, coffee, spices, candle and soap supplies': 'specialty supply stores (Shopify)',
      'Shopify bulk goods sellers': 'bulk goods stores (Shopify)',
    },
  },
  consumer: {
    actions: {
      Reduces: 'Eases',
      Structures: 'Adds structure to',
      Accelerates: 'Speeds up',
    },
    workflows: {
      'personal finances': 'money management',
      'workout recovery': 'recovery',
      'financial independence': 'wealth building',
      'digital wellbeing': 'screen habits',
      'social life': 'social plans',
    },
    industries: {
      'people with ADHD': 'adults with ADHD',
      'seniors living alone': 'solo seniors',
      'first-time homeowners': 'new homeowners',
      'job seekers': 'people job hunting',
    },
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

const OPPORTUNITY_SEED_CAPS = {
  b2b: { actions: 4, workflows: 10, industries: 8 },
  consumer: { actions: 4, workflows: 8, industries: 8 },
};

const TRUST_QUEUE_LIMIT = 8;
const TRUST_MIN_SCORE = 16;

const MIN_TRAINING_ROWS = 8;
const MIN_PAIR_ROWS = 4;
const TRAINING_HALF_LIFE_DAYS = 45;
const MIN_RECENCY_MULTIPLIER = 0.7;
const MAX_RECENCY_MULTIPLIER = 1.2;
const SESSION_SIGNAL_DECAY = 0.74;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function slug(value = '') {
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function titleize(value = '') {
  return String(value)
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function displayValue(modeConfig, bucket, value = '') {
  return modeConfig?.display?.[bucket]?.[value] || value;
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
      modeKey,
      name: mode.name,
      connector: mode.connector,
      prefix: mode.prefix,
      labels: mode.labels,
      banks: mode.banks.map((bank) => [...bank]),
      pairMap: CURATED_PAIR_MAPS[modeKey] ? { ...CURATED_PAIR_MAPS[modeKey] } : toValuePairMap(mode.banks[0], mode.banks[1], mode.pairIndexes),
      workflowIndustryMap: modeKey === 'b2b' ? { ...B2B_WORKFLOW_INDUSTRY_MAP } : modeKey === 'consumer' ? { ...CONSUMER_WORKFLOW_INDUSTRY_MAP } : {},
      display: DISPLAY_ALIASES[modeKey] || DISPLAY_ALIASES.consumer,
    },
  ])
);

function uniqueValues(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const clean = String(value || '').trim();
    if (!clean) continue;
    const key = slug(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function buildOpportunitySeedPriors(opportunityBank = []) {
  const priors = Object.fromEntries(
    Object.keys(DEFAULT_MODE_CONFIGS).map((modeKey) => [modeKey, {
      actions: [],
      workflows: [],
      industries: [],
      actionBoosts: new Map(),
      workflowBoosts: new Map(),
      industryBoosts: new Map(),
      actionWorkflow: new Map(),
      workflowIndustry: new Map(),
      seedCount: 0,
    }])
  );

  for (const seed of Array.isArray(opportunityBank) ? opportunityBank : []) {
    const modeKey = seed?.mode === 'consumer' ? 'consumer' : 'b2b';
    const defaults = DEFAULT_MODE_CONFIGS[modeKey];
    const prior = priors[modeKey];
    const action = String(seed?.action || '').trim();
    const workflow = String(seed?.workflow || '').trim();
    const industry = String(seed?.industry || '').trim();
    if (!action || !workflow || !industry) continue;

    const strength = Math.max(1.4, Math.min(6, 1.5 + (Number(seed?.score || 0) / 5) + Math.min(2, Number(seed?.times_seen || 1) * 0.35)));
    prior.seedCount += 1;
    prior.actions.push(action);
    prior.workflows.push(workflow);
    prior.industries.push(industry);
    prior.actionBoosts.set(action, (prior.actionBoosts.get(action) || 0) + strength * 0.7);
    prior.workflowBoosts.set(workflow, (prior.workflowBoosts.get(workflow) || 0) + strength * 1.35);
    prior.industryBoosts.set(industry, (prior.industryBoosts.get(industry) || 0) + strength * 1.1);
    prior.actionWorkflow.set(`${action}::${workflow}`, (prior.actionWorkflow.get(`${action}::${workflow}`) || 0) + strength * 1.4);
    prior.workflowIndustry.set(`${workflow}::${industry}`, (prior.workflowIndustry.get(`${workflow}::${industry}`) || 0) + strength * 1.3);

    if (!defaults.banks[0].includes(action)) {
      prior.actionBoosts.set(action, (prior.actionBoosts.get(action) || 0) + 0.5);
    }
  }

  for (const [modeKey, prior] of Object.entries(priors)) {
    const caps = OPPORTUNITY_SEED_CAPS[modeKey] || OPPORTUNITY_SEED_CAPS.b2b;
    prior.actions = uniqueValues(prior.actions).slice(0, caps.actions);
    prior.workflows = uniqueValues(prior.workflows).slice(0, caps.workflows);
    prior.industries = uniqueValues(prior.industries).slice(0, caps.industries);
  }

  return priors;
}

function mergeSeededBank(defaultBank, seedValues = []) {
  return uniqueValues([...(seedValues || []), ...defaultBank]);
}

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

function getOverallScore(row) {
  return Number(
    row?.eval?.scores?.overall
    || row?.eval?.scores?.Overall
    || row?.payload?.overallScore
    || row?.payload?.score
    || 0
  );
}

function scoreLift(score) {
  if (!score) return 0;
  if (score >= 90) return 5;
  if (score >= 80) return 3.6;
  if (score >= 70) return 2.2;
  if (score >= 60) return 0.9;
  if (score >= 50) return -0.4;
  return -2.8;
}

function dimensionLift(row) {
  const scores = row?.eval?.scores || {};
  const dims = ['evidenceCoverage', 'wedgeClarity', 'defensibility', 'specificity']
    .map((key) => Number(scores[key]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!dims.length) return 0;
  const avg = dims.reduce((sum, value) => sum + value, 0) / dims.length;
  return clamp((avg - 68) / 10, -2, 2.75);
}

function verdictLift(verdict) {
  if (verdict === 'build') return 2.1;
  if (verdict === 'warning') return 0.2;
  if (verdict === 'avoid') return -2.4;
  return 0;
}

function recencyMultiplier(row) {
  const stamp = Date.parse(row?.created_at || row?.createdAt || '');
  if (!Number.isFinite(stamp)) return 1;
  const ageDays = Math.max(0, (Date.now() - stamp) / 86_400_000);
  const multiplier = MIN_RECENCY_MULTIPLIER + (MAX_RECENCY_MULTIPLIER - MIN_RECENCY_MULTIPLIER) * Math.pow(0.5, ageDays / TRAINING_HALF_LIFE_DAYS);
  return clamp(multiplier, MIN_RECENCY_MULTIPLIER, MAX_RECENCY_MULTIPLIER);
}

function validationWeight(row) {
  const verdict = row.verdictType || row.verdict_type || row?.judge?.decision;
  const base = verdict === 'build' ? 6.5 : verdict === 'warning' ? 0.75 : verdict === 'avoid' ? -7 : 0;
  const confidence = row?.judge?.confidence === 'high' ? 1.1 : row?.judge?.confidence === 'low' ? -0.85 : 0;
  const tierMultiplier = (row.validationTier || row.validation_tier) === 'precheck' ? 0.5 : 1;
  return (base + confidence + scoreLift(getOverallScore(row)) + dimensionLift(row)) * tierMultiplier;
}

function outcomeWeight(row) {
  const signal = row.signal;
  const base = (() => {
    switch (signal) {
      case 'blueprint_completed': return 9.5;
      case 'blueprint_started': return 5.5;
      case 'blueprint_copied': return 5;
      case 'shortlist_saved': return 4;
      case 'market_scan_completed': return 0.75;
      case 'designer_completed': return 1.75;
      case 'launch_completed': return 1.75;
      case 'infra_completed': return 1.5;
      default: return 0.25;
    }
  })();

  const verdict = row?.payload?.verdictType || row.verdictType || row.verdict_type || null;
  const quality = scoreLift(getOverallScore(row)) * 0.7;
  return base + verdictLift(verdict) + quality;
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

function valueMetric(stats, value, index, seedBoost = 0) {
  const stat = stats.get(value) || { score: 0, count: 0 };
  const defaultBias = Math.max(0, 2 - index * 0.08);
  const supportBonus = Math.min(2.35, Math.log2(stat.count + 1) * 0.95);
  const averageScore = stat.count ? stat.score / stat.count : 0;
  return {
    value,
    score: stat.score * 0.72 + averageScore * 1.55 + supportBonus + defaultBias + seedBoost,
    count: stat.count,
    rawScore: stat.score,
    defaultIndex: index,
  };
}

function selectBank(defaultBank, stats, targetSize, enabled, seedBoosts = new Map()) {
  if (!enabled) {
    return {
      values: [...defaultBank],
      weights: defaultBank.map(() => 1),
    };
  }

  const ranked = defaultBank
    .map((value, index) => valueMetric(stats, value, index, seedBoosts.get(value) || 0))
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
    const delta = validationWeight(row) * recencyMultiplier(row);
    card.validationCount += 1;
    applyScore(card.actions, scope.action, delta);
    applyScore(card.workflows, scope.workflow, delta);
    applyScore(card.industries, scope.industry, delta);
    applyScore(card.actionWorkflow, `${scope.action}::${scope.workflow}`, delta * 1.15);
    applyScore(card.workflowIndustry, `${scope.workflow}::${scope.industry}`, delta);
  }

  const sessionSignalCounts = new Map();
  for (const row of outcomes) {
    const scope = inferScope(row);
    if (!scope) continue;
    const card = scorecard[scope.modeKey];
    const sessionKey = `${scope.modeKey}:${row.sessionId || row.session_id || row.validationId || row.created_at || `${scope.action}:${scope.workflow}:${scope.industry}`}`;
    const signalCount = sessionSignalCounts.get(sessionKey) || 0;
    sessionSignalCounts.set(sessionKey, signalCount + 1);
    const chainMultiplier = Math.max(0.4, Math.pow(SESSION_SIGNAL_DECAY, signalCount));
    const delta = outcomeWeight(row) * recencyMultiplier(row) * chainMultiplier;
    card.outcomeCount += 1;
    applyScore(card.actions, scope.action, delta);
    applyScore(card.workflows, scope.workflow, delta);
    applyScore(card.industries, scope.industry, delta);
    applyScore(card.actionWorkflow, `${scope.action}::${scope.workflow}`, delta * 1.35);
    applyScore(card.workflowIndustry, `${scope.workflow}::${scope.industry}`, delta * 1.15);
  }

  return scorecard;
}

function buildPairMap(modeKey, selectedActions, selectedWorkflows, scorecard, seedPrior = null) {
  const defaults = DEFAULT_MODE_CONFIGS[modeKey];
  const pairMap = {};
  const pairWeights = {};

  for (const action of selectedActions) {
    const seeded = selectedWorkflows.filter((workflow) => (seedPrior?.actionWorkflow.get(`${action}::${workflow}`) || 0) > 0);
    const allowed = uniqueValues([
      ...seeded,
      ...(defaults.pairMap[action] || []).filter((workflow) => selectedWorkflows.includes(workflow)),
    ]).filter((workflow) => selectedWorkflows.includes(workflow));
    if (!allowed.length) continue;

    const ranked = allowed
      .map((workflow) => {
        const pair = pairMetric(scorecard.actionWorkflow, `${action}::${workflow}`);
        const averageScore = pair.count ? pair.score / pair.count : 0;
        const seedBoost = seedPrior?.actionWorkflow.get(`${action}::${workflow}`) || 0;
        return {
          workflow,
          count: pair.count,
          score: pair.score * 0.76 + averageScore * 1.45 + ((scorecard.workflows.get(workflow)?.score || 0) * 0.35) + seedBoost,
        };
      })
      .sort((a, b) => b.score - a.score);

    const hasTraining = ranked.reduce((sum, item) => sum + item.count, 0) >= MIN_PAIR_ROWS || ranked.some((item) => item.score > 0.9);
    const kept = hasTraining ? ranked.slice(0, Math.max(6, Math.ceil(ranked.length * 0.72))) : ranked;

    pairMap[action] = kept.map((item) => item.workflow);
    pairWeights[action] = Object.fromEntries(
      kept.map((item) => [item.workflow, Math.max(0.35, Math.min(6, 1 + item.score / 6))])
    );
  }

  return { pairMap, pairWeights };
}

function buildWorkflowIndustryChoices(modeKey, selectedWorkflows, selectedIndustries, scorecard, seedPrior = null) {
  const defaults = DEFAULT_MODE_CONFIGS[modeKey];
  const workflowIndustryMap = {};
  const workflowIndustryWeights = {};

  for (const workflow of selectedWorkflows) {
    const seeded = selectedIndustries.filter((industry) => (seedPrior?.workflowIndustry.get(`${workflow}::${industry}`) || 0) > 0);
    const curated = (defaults.workflowIndustryMap?.[workflow] || []).filter((industry) => selectedIndustries.includes(industry));
    const trained = selectedIndustries.filter((industry) => {
      const pair = pairMetric(scorecard.workflowIndustry, `${workflow}::${industry}`);
      return pair.count > 0 && (pair.score > -0.5 || (pair.score / pair.count) > -0.2);
    });
    const allowed = uniqueValues([...seeded, ...curated, ...trained]).filter((industry) => selectedIndustries.includes(industry));
    const candidates = allowed.length ? allowed : [...selectedIndustries];

    const ranked = candidates
      .map((industry) => {
        const pair = pairMetric(scorecard.workflowIndustry, `${workflow}::${industry}`);
        const industryScore = scorecard.industries.get(industry)?.score || 0;
        const averageScore = pair.count ? pair.score / pair.count : 0;
        const seedBoost = seedPrior?.workflowIndustry.get(`${workflow}::${industry}`) || 0;
        const weight = Math.max(0.35, Math.min(6, 1 + (pair.score * 0.72 + averageScore * 1.35 + industryScore * 0.25 + seedBoost) / 6));
        return { industry, weight };
      })
      .sort((a, b) => b.weight - a.weight);

    workflowIndustryMap[workflow] = ranked.map((item) => item.industry);
    workflowIndustryWeights[workflow] = Object.fromEntries(ranked.map((item) => [item.industry, item.weight]));
  }

  return { workflowIndustryMap, workflowIndustryWeights };
}

function trustSeedRank(seed) {
  const score = Number(seed?.score || 0);
  const timesSeen = Number(seed?.times_seen || 0);
  const lastSeen = Date.parse(seed?.last_seen_at || seed?.first_seen_at || '') || 0;
  return (score * 1000) + Math.min(250, timesSeen * 25) + lastSeen / 1_000_000;
}

function buildTrustQueue(modeKey, opportunityBank = [], selectedBanks = []) {
  const [actions = [], workflows = [], industries = []] = selectedBanks;
  const seen = new Set();

  return (Array.isArray(opportunityBank) ? opportunityBank : [])
    .filter((seed) => {
      if ((seed?.mode === 'consumer' ? 'consumer' : 'b2b') !== modeKey) return false;
      if (Number(seed?.score || 0) < TRUST_MIN_SCORE) return false;
      if (!seed?.title || !seed?.one_liner) return false;
      if (!actions.includes(seed?.action) || !workflows.includes(seed?.workflow) || !industries.includes(seed?.industry)) return false;
      const key = String(seed?.key || `${seed?.action}::${seed?.workflow}::${seed?.industry}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => trustSeedRank(b) - trustSeedRank(a))
    .slice(0, TRUST_QUEUE_LIMIT)
    .map((seed) => ({
      key: seed.key,
      mode: seed.mode,
      action: seed.action,
      workflow: seed.workflow,
      industry: seed.industry,
      title: seed.title,
      one_liner: seed.one_liner,
      pain_signal: seed.pain_signal,
      why_now: seed.why_now,
      score: Number(seed.score || 0),
      source: seed.source || '',
      source_url: seed.source_url || '',
      last_seen_at: seed.last_seen_at || seed.first_seen_at || '',
      times_seen: Number(seed.times_seen || 1),
    }));
}

function modeMeta(modeKey, scorecard, selectedBanks, opportunitySeedCount = 0) {
  return {
    modeKey,
    trainingRows: scorecard.validationCount + scorecard.outcomeCount,
    validationRows: scorecard.validationCount,
    outcomeRows: scorecard.outcomeCount,
    opportunitySeeds: opportunitySeedCount,
    actions: selectedBanks[0].length,
    workflows: selectedBanks[1].length,
    industries: selectedBanks[2].length,
  };
}

export function buildAdaptiveGeneratorConfig(trainingData = {}, opportunityBank = []) {
  const scorecard = scoreTrainingData(trainingData);
  const seedPriors = buildOpportunitySeedPriors(opportunityBank);
  const modes = {};
  const meta = {};

  for (const [modeKey, defaults] of Object.entries(DEFAULT_MODE_CONFIGS)) {
    const card = scorecard[modeKey];
    const seedPrior = seedPriors[modeKey];
    const trainingRows = card.validationCount + card.outcomeCount;
    const enabled = trainingRows >= MIN_TRAINING_ROWS || seedPrior.seedCount > 0;
    const targetSizes = TARGET_BANK_SIZES[modeKey] || defaults.banks.map((bank) => bank.length);
    // Reels draw ONLY from the curated default vocabulary. Those banks are
    // hand-designed so every action -> workflow -> industry combination reads
    // as a sensible sentence. We deliberately do NOT merge raw opportunity-bank
    // seed strings (e.g. "Diagnoses", "proactive job status sms updates",
    // "field-service SMBs") into the reels — they break grammar and pairing and
    // surface verbatim. Seeds still drive the trust queue (full, coherent ideas)
    // and the adaptive re-ranking/weighting of the curated values below.
    const seededBanks = [
      mergeSeededBank(defaults.banks[0], []),
      mergeSeededBank(defaults.banks[1], []),
      mergeSeededBank(defaults.banks[2], []),
    ];

    const actionBank = selectBank(seededBanks[0], card.actions, targetSizes[0], enabled, seedPrior.actionBoosts);
    const workflowBank = selectBank(seededBanks[1], card.workflows, targetSizes[1], enabled, seedPrior.workflowBoosts);
    const industryBank = selectBank(seededBanks[2], card.industries, targetSizes[2], enabled, seedPrior.industryBoosts);

    const selectedBanks = [actionBank.values, workflowBank.values, industryBank.values];
    const { pairMap, pairWeights } = buildPairMap(modeKey, actionBank.values, workflowBank.values, card, seedPrior);
    const { workflowIndustryMap, workflowIndustryWeights } = buildWorkflowIndustryChoices(modeKey, workflowBank.values, industryBank.values, card, seedPrior);
    const trustQueue = buildTrustQueue(modeKey, opportunityBank, selectedBanks);

    modes[modeKey] = {
      ...defaults,
      banks: selectedBanks,
      weights: [actionBank.weights, workflowBank.weights, industryBank.weights],
      pairMap,
      pairWeights,
      workflowIndustryMap,
      workflowIndustryWeights,
      trustQueue,
      learning: {
        enabled,
        trainingRows,
        opportunitySeeds: seedPrior.seedCount,
        trustQueueCount: trustQueue.length,
      },
    };
    meta[modeKey] = modeMeta(modeKey, card, selectedBanks, seedPrior.seedCount);
  }

  return {
    modes,
    meta,
    generatedAt: new Date().toISOString(),
  };
}

export function buildGeneratorIdea(modeConfig, action, workflow, industry, seed = null) {
  const title = seed?.title || `${titleize(workflow)} for ${titleize(industry)}`;
  const verb = slug(action);
  const displayAction = displayValue(modeConfig, 'actions', action);
  const displayWorkflow = displayValue(modeConfig, 'workflows', workflow);
  const displayIndustry = displayValue(modeConfig, 'industries', industry);
  const reelDescription = modeConfig.name === 'B2B'
    ? `${displayAction} ${displayWorkflow} for ${displayIndustry}`
    : `${displayAction} ${displayWorkflow} ${modeConfig.connector} ${displayIndustry}`;
  return {
    action,
    workflow,
    industry,
    displayAction,
    displayWorkflow,
    displayIndustry,
    connector: modeConfig.connector,
    modeName: modeConfig.name,
    label: modeConfig.name,
    title,
    reelDescription,
    tagline: seed?.one_liner || (modeConfig.name === 'B2B'
      ? `A B2B agent that ${verb} ${workflow} in the ${industry} industry.`
      : `A consumer app that ${verb} ${workflow} for ${industry}.`),
    blurb: seed?.pain_signal
      ? `${seed.pain_signal}${seed?.why_now ? ` ${seed.why_now}` : ''}`
      : modeConfig.name === 'B2B'
      ? `Built for ${industry} teams that need to ${verb} ${workflow} faster, with less manual work and more consistency.`
      : `Built for ${industry} who want a simpler way to ${verb} ${workflow} without another bloated app.`,
    freeformIdea: modeConfig.name === 'B2B'
      ? `${verb} ${workflow} in the ${industry} industry`
      : `${verb} ${workflow} ${modeConfig.connector} ${industry}`,
    seeded: Boolean(seed),
    trustSeedKey: seed?.key || '',
    seedTitle: seed?.title || '',
    painSignal: seed?.pain_signal || '',
    whyNow: seed?.why_now || '',
    source: seed?.source || '',
    sourceUrl: seed?.source_url || '',
  };
}
