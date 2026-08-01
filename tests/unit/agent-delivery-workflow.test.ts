import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('agent delivery 状态工作流', () => {
  test('监听 PR、review 和 check 事件', () => {
    const workflow = parse(read('.github/workflows/agent-delivery-status.yml'))
    expect(workflow.on.pull_request.types).toEqual([
      'opened',
      'reopened',
      'synchronize',
      'labeled',
      'unlabeled',
      'ready_for_review',
    ])
    expect(workflow.on.pull_request_review.types).toEqual(['submitted'])
    expect(workflow.on.check_suite.types).toEqual(['completed'])
  })

  test('只处理 agent-managed PR 且不具备合并能力', () => {
    const source = read('.github/workflows/agent-delivery-status.yml')
    const workflow = parse(source)
    expect(source).toContain("contains(github.event.pull_request.labels.*.name, 'agent-managed')")
    expect(source).toContain('## Agent Delivery Status')
    expect(source).toContain('等待 PR 转为 Ready for review。')
    expect(source).toContain("check.name !== 'summarize'")
    expect(source).not.toContain('if (!managed || pr.draft)')
    expect(source).toContain('actions/github-script@v7')
    expect(source).not.toContain('pulls.merge')
    expect(source).not.toContain('contents: write')
    expect(source).toContain("check.conclusion !== 'success'")
    expect(source).toContain('GitHub 将 PR 状态评论视为 pull request 写操作。')
    expect(workflow.permissions['pull-requests']).toBe('write')
  })
})
