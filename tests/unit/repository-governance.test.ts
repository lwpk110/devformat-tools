import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('仓库交付治理契约', () => {
  test('AGENTS 禁止直推 main 并定义 Issue 到自动合并流程', () => {
    const guidance = read('AGENTS.md')
    expect(guidance).toContain('禁止直接向 `main` commit 或 push')
    expect(guidance).toContain('Issue → 原子任务 → 功能分支 → commit/push → PR')
    expect(guidance).toContain('request_copilot_review')
    expect(guidance).toContain('squash merge')
  })

  test.each([
    ['feature.yml', 'type:feature'],
    ['bug.yml', 'type:bug'],
  ])('%s 是带标准标签的有效 Issue form', (file, label) => {
    const form = parse(read(`.github/ISSUE_TEMPLATE/${file}`))
    expect(form.name).toBeTypeOf('string')
    expect(form.description).toBeTypeOf('string')
    expect(form.labels).toContain(label)
    expect(form.body.length).toBeGreaterThanOrEqual(4)
    const ids = form.body.flatMap((item: { id?: string }) => item.id ?? [])
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('Issue 配置禁止空白 Issue', () => {
    const config = parse(read('.github/ISSUE_TEMPLATE/config.yml'))
    expect(config.blank_issues_enabled).toBe(false)
  })

  test('PR 模板要求关联 Issue、验证和审核门禁', () => {
    const template = read('.github/pull_request_template.md')
    expect(template).toContain('Closes #')
    expect(template).toContain('## Why')
    expect(template).toContain('## What Changed')
    expect(template).toContain('## Verification')
    expect(template).toContain('Copilot review')
  })

  test('PR 模板声明 agent-managed 接管契约且不将 Secret Scanning 作为门禁', () => {
    const template = read('.github/pull_request_template.md')
    expect(template).toContain('agent-managed')
    expect(template).toContain('## Agent Delivery')
    expect(template).toContain('## Agent Delivery Status')
    expect(template).not.toContain('Secret scanning 未发现阻塞问题')
  })

  test('agent-managed 标签说明自动化接管范围', () => {
    const label = read('.github/labels/agent-managed.md')
    expect(label).toContain('仅对显式添加该标签的 PR')
    expect(label).toContain('不会接管手工 PR')
  })

  test('AGENTS 定义 MCP 驱动的 agent-managed 交付闭环', () => {
    const guidance = read('AGENTS.md')
    expect(guidance).toContain('`agent-managed`')
    expect(guidance).toContain('GitHub MCP')
    expect(guidance).toContain('有效 unresolved feedback')
    expect(guidance).toContain('验证 Issue 已关闭')
    expect(guidance.toLowerCase()).not.toContain('secret scanning')
  })

  test('CI 在 main 的 PR 上使用 Node 20 执行完整门禁', () => {
    const workflow = parse(read('.github/workflows/ci.yml'))
    expect(workflow.on.pull_request.branches).toContain('main')
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.jobs.quality['timeout-minutes']).toBe(15)
    const steps = workflow.jobs.quality.steps
    const setupNodeStep = steps.find(
      (step: { uses?: string }) => step.uses === 'actions/setup-node@v4',
    )
    expect(setupNodeStep).toBeDefined()
    expect(setupNodeStep?.with?.['node-version']).toBe(20)
    expect(steps.map((step: { run?: string }) => step.run).filter(Boolean)).toEqual([
      'npm ci',
      'npm run build',
      'npm test',
      'npm run check',
    ])
  })
})
