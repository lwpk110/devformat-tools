import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'

const root = resolve(import.meta.dirname, '../..')
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

  test('CI 在 main 的 PR 上使用 Node 20 执行完整门禁', () => {
    const workflow = parse(read('.github/workflows/ci.yml'))
    expect(workflow.on.pull_request.branches).toContain('main')
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.jobs.quality['timeout-minutes']).toBe(15)
    const steps = workflow.jobs.quality.steps
    expect(
      steps.find((step: { uses?: string }) => step.uses === 'actions/setup-node@v4').with[
        'node-version'
      ],
    ).toBe(20)
    expect(steps.map((step: { run?: string }) => step.run).filter(Boolean)).toEqual([
      'npm ci',
      'npm run build',
      'npm test',
      'npm run check',
    ])
  })
})
