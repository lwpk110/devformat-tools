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
    expect(source).toContain('GitHub 将 PR 状态评论视为 pull request 写操作。')
    expect(source).toContain("github.event.check_suite.pull_requests[0].number != ''")
    expect(source).toContain("['success', 'neutral', 'skipped'].includes(check.conclusion)")
    expect(source).toContain("copilotReview?.state === 'CHANGES_REQUESTED'")
    expect(source).toContain("comment.user?.login === 'github-actions[bot]'")
    expect(source).toContain('pageInfo { hasNextPage }')
    expect(source).toContain('reviewThreadsTruncated')
    expect(source).toContain('checkSuitePullRequests.length !== 1')
    expect(workflow.permissions['pull-requests']).toBe('write')
  })
})

describe('Copilot review 恢复工作流', () => {
  test('定时扫描托管 PR 并保留手动触发入口', () => {
    const workflow = parse(read('.github/workflows/agent-delivery-recovery.yml'))

    expect(workflow.on.schedule).toEqual([{ cron: '*/15 * * * *' }])
    expect(workflow.on.workflow_dispatch).toEqual(null)
  })

  test('以真实 reviewer 登记为门禁且不具备合并权限', () => {
    const source = read('.github/workflows/agent-delivery-recovery.yml')
    const workflow = parse(source)

    expect(workflow.permissions).toEqual({
      contents: 'read',
      'pull-requests': 'write',
      issues: 'write',
      checks: 'read',
    })
    expect(source).toContain('requested_reviewers')
    expect(source).toContain('status:blocked')
    expect(source).toContain('@copilot review')
    expect(source).toContain('15 * 60 * 1000')
    expect(source).toContain('60 * 60 * 1000')
    expect(source).toContain('6 * 60 * 60 * 1000')
    expect(source).toContain('<!-- agent-delivery-state:')
    expect(source).toContain("previous.state === 'blocked-review-request-not-accepted'")
    expect(source).toContain("state: 'blocked-no-response'")
    expect(source).toContain('const retryAt = previous.nextCheckAt ?? now + waitBeforeBlockedRetry')
    expect(source).toContain('now >= retryAt')
    expect(source).toContain("comment.user?.login === 'github-actions[bot]'")
    expect(source).toContain("const resetWaiting = previous.state === 'blocked-review-request-not-accepted'")
    expect(source).not.toContain('pulls.merge')
    expect(source).not.toContain('contents: write')
    expect(source).not.toContain("state: 'closed'")
  })
})
