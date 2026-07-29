import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface WorkflowStep {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string | number>;
}

interface DeployWorkflow {
  name: string;
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  concurrency: {
    group: string;
    'cancel-in-progress': boolean;
  };
  jobs: {
    deploy: {
      'runs-on': string;
      'timeout-minutes': number;
      steps: WorkflowStep[];
    };
  };
}

const source = readFileSync('.github/workflows/deploy-pages.yml', 'utf8');
const workflow = parse(source) as DeployWorkflow;
const steps = workflow.jobs.deploy.steps;

describe('Cloudflare Pages workflow 契约', () => {
  it('支持任意 branch push 与手动部署，并按 ref 取消旧运行', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['push', 'workflow_dispatch']);
    expect(workflow.on.push).toEqual({
      branches: ['**'],
      'tags-ignore': ['**'],
    });
    expect(workflow.concurrency).toEqual({
      group: 'cloudflare-pages-${{ github.ref }}',
      'cancel-in-progress': true,
    });
  });

  it('与标准 CI 使用相同 major 版本的 checkout action', () => {
    expect(steps.find((step) => step.name === 'Checkout')?.uses).toBe(
      'actions/checkout@v4',
    );
  });

  it('只授予读取源码和写入 Deployment 的权限', () => {
    expect(workflow.permissions).toEqual({
      contents: 'read',
      deployments: 'write',
    });
  });

  it('使用 Node.js 22 和 npm cache 执行完整质量门禁', () => {
    const setupNode = steps.find((step) => step.uses === 'actions/setup-node@v4');
    expect(setupNode?.with).toEqual({
      'node-version': 22,
      cache: 'npm',
    });

    expect(steps.flatMap((step) => step.run ?? []).slice(0, 4)).toEqual([
      'npm ci',
      'npm run check',
      'npm run build',
      'npm test',
    ]);
  });

  it('质量门禁后初始化 Pages project，再执行 Wrangler 部署', () => {
    const initializeIndex = steps.findIndex(
      (step) => step.name === 'Ensure Cloudflare Pages project',
    );
    const testIndex = steps.findIndex((step) => step.run === 'npm test');
    const deployIndex = steps.findIndex((step) => step.id === 'deploy');
    const initialize = steps[initializeIndex];

    expect(initialize).toEqual({
      name: 'Ensure Cloudflare Pages project',
      env: {
        CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
        CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
        CLOUDFLARE_PAGES_PROJECT: 'devformat-tools',
        CLOUDFLARE_PAGES_PRODUCTION_BRANCH: 'main',
      },
      run: 'node .github/scripts/ensure-pages-project.mjs',
    });
    expect(initializeIndex).toBeGreaterThan(testIndex);
    expect(deployIndex).toBeGreaterThan(initializeIndex);
  });

  it('使用固定 Pages 项目和约定 secrets 上传 dist', () => {
    const deploy = steps.find((step) => step.id === 'deploy');
    expect(deploy).toMatchObject({
      uses: 'cloudflare/wrangler-action@v3',
      with: {
        apiToken: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
        accountId: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
        wranglerVersion: '4',
        command: 'pages deploy dist --project-name=devformat-tools',
        gitHubToken: '${{ secrets.GITHUB_TOKEN }}',
      },
    });
  });

  it('只把部署 URL 写入 Job Summary', () => {
    const summary = steps.find((step) => step.name === 'Publish deployment URLs');
    expect(summary?.env).toEqual({
      DEPLOYMENT_URL: '${{ steps.deploy.outputs.deployment-url }}',
      DEPLOYMENT_ALIAS_URL: '${{ steps.deploy.outputs.pages-deployment-alias-url }}',
    });
    expect(summary?.run).toContain('$GITHUB_STEP_SUMMARY');
    expect(summary?.run).toContain('$DEPLOYMENT_URL');
    expect(summary?.run).toContain('$DEPLOYMENT_ALIAS_URL');
    expect(summary?.run).not.toMatch(/CLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID)/);
  });

  it('workflow 源码不包含 Cloudflare 凭据字面量', () => {
    expect(source).not.toMatch(/apiToken:\s*(?!\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN\s*\}\})\S+/);
    expect(source).not.toMatch(/accountId:\s*(?!\$\{\{\s*secrets\.CLOUDFLARE_ACCOUNT_ID\s*\}\})\S+/);
  });
});
