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
    expect(source).toContain("contains(github.event.pull_request.labels.*.name, 'agent-managed')")
    expect(source).toContain('## Agent Delivery Status')
    expect(source).toContain('actions/github-script@v7')
    expect(source).not.toContain('pulls.merge')
    expect(source).not.toContain('contents: write')
  })
})
