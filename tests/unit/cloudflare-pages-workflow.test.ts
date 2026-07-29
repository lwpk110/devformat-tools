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
    expect(workflow.concurrency).toEqual({
      group: 'cloudflare-pages-${{ github.ref }}',
      'cancel-in-progress': true,
    });
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
