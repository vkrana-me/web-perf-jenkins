export const TARGET_URL = 'https://vkrana.me';

export const LIGHTHOUSE_FLAGS = {
  chromeFlags: ['--no-sandbox', '--headless', '--disable-gpu', '--disable-dev-shm-usage'],
  onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] as const,
} as const;

export type Category = (typeof LIGHTHOUSE_FLAGS.onlyCategories)[number];

export const THRESHOLDS: Record<Category, number> = {
  performance: 0.8,
  accessibility: 0.9,
  'best-practices': 0.9,
  seo: 0.9,
};

export const RUNS = 3;
export const REPORTS_DIR = 'lighthouse-reports';
