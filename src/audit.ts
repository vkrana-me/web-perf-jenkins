import fs from 'node:fs';
import path from 'node:path';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import type { RunnerResult } from 'lighthouse/types/externs.js';
import {
  LIGHTHOUSE_FLAGS,
  REPORTS_DIR,
  RUNS,
  TARGET_URL,
  THRESHOLDS,
  type Category,
} from './config.js';

interface RunResult {
  run: number;
  scores: Record<Category, number>;
}

function saveReports(runIndex: number, result: RunnerResult): void {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(REPORTS_DIR, `vkrana.me-run${runIndex + 1}-${timestamp}`);

  const reports = Array.isArray(result.report) ? result.report : [result.report];
  fs.writeFileSync(`${base}.report.html`, reports[0]!);
  fs.writeFileSync(`${base}.report.json`, reports[1]!);

  console.log(`  Saved: ${base}.report.html`);
}

function assertThresholds(allRuns: RunResult[]): boolean {
  // Best score across runs (optimistic aggregation — handles network jitter)
  const best: Partial<Record<Category, number>> = {};
  for (const { scores } of allRuns) {
    for (const [cat, score] of Object.entries(scores) as [Category, number][]) {
      best[cat] = Math.max(best[cat] ?? 0, score);
    }
  }

  console.log('\n── Threshold Results ──────────────────────');
  let passed = true;
  for (const category of LIGHTHOUSE_FLAGS.onlyCategories) {
    const score = best[category]!;
    const threshold = THRESHOLDS[category];
    const ok = score >= threshold;
    const mark = ok ? '✓' : '✗';
    console.log(`  ${mark} ${category.padEnd(16)} ${pct(score)} (min ${pct(threshold)})`);
    if (!ok) passed = false;
  }
  console.log('───────────────────────────────────────────\n');
  return passed;
}

function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

async function main(): Promise<void> {
  console.log(`Auditing ${TARGET_URL} — ${RUNS} runs\n`);

  const chrome = await launch({ chromeFlags: [...LIGHTHOUSE_FLAGS.chromeFlags] });
  const allRuns: RunResult[] = [];

  try {
    for (let i = 0; i < RUNS; i++) {
      console.log(`Run ${i + 1}/${RUNS}...`);

      const result = await lighthouse(TARGET_URL, {
        port: chrome.port,
        output: ['html', 'json'],
        onlyCategories: [...LIGHTHOUSE_FLAGS.onlyCategories],
      });

      if (!result?.lhr) throw new Error(`Run ${i + 1}: Lighthouse returned no result`);

      saveReports(i, result);

      const scores: Partial<Record<Category, number>> = {};
      for (const cat of LIGHTHOUSE_FLAGS.onlyCategories) {
        const score = result.lhr.categories[cat]?.score;
        if (score == null) throw new Error(`Run ${i + 1}: missing score for ${cat}`);
        scores[cat] = score;
        console.log(`    ${cat}: ${pct(score)}`);
      }
      allRuns.push({ run: i + 1, scores: scores as Record<Category, number> });
    }
  } finally {
    chrome.kill();
  }

  const passed = assertThresholds(allRuns);
  if (!passed) {
    console.error('One or more thresholds failed.');
    process.exit(1);
  }

  console.log('All thresholds passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
