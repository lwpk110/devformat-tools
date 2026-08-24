import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CardKeyConverter } from '../../src/components/CardKeyConverter';

describe('CardKeyConverter 组件交互', () => {
  it('初始状态渲染工作区且结果操作禁用', () => {
    render(<CardKeyConverter />);

    expect(screen.getByText('原始卡密文本')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /上传卡密/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '填入样例数据' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制转换结果' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /下载/ })).toBeDisabled();
  });

  it('点击填入样例数据后渲染成功提示、输出结果和预览表格', async () => {
    const user = userEvent.setup();
    render(<CardKeyConverter />);

    await user.click(screen.getByRole('button', { name: '填入样例数据' }));

    await waitFor(() => expect(screen.getByText(/已成功转换 3 个账号/)).toBeInTheDocument());
    expect(screen.getByRole('table', { name: '转换账号列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制转换结果' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /下载/ })).toBeEnabled();

    // 检查表格中解析出的邮箱
    expect(screen.getByText('tjznoni48159+9kylxo@outlook.com')).toBeInTheDocument();
  });

  it('切换上游平台更新输出与统计中的平台标识', async () => {
    const user = userEvent.setup();
    render(<CardKeyConverter />);

    await user.click(screen.getByRole('button', { name: '填入样例数据' }));
    await waitFor(() => expect(screen.getByText(/已成功转换 3 个账号/)).toBeInTheDocument());

    const claudeRadio = screen.getByRole('radio', { name: 'CLAUDE' });
    await user.click(claudeRadio);

    expect(screen.getByText('上游平台: CLAUDE')).toBeInTheDocument();
  });

  it('切换输出格式更新输出标题与文本格式', async () => {
    const user = userEvent.setup();
    render(<CardKeyConverter />);

    await user.click(screen.getByRole('button', { name: '填入样例数据' }));
    await waitFor(() => expect(screen.getByText(/已成功转换 3 个账号/)).toBeInTheDocument());

    const tokensTab = screen.getByRole('tab', { name: '纯 Token' });
    await user.click(tokensTab);

    expect(screen.getByText('输出结果 · 纯 Token 列表')).toBeInTheDocument();
  });

  it('点击只提取 Grok Token 快捷按钮将格式切换为纯 Token 列表并选定 Grok', async () => {
    const user = userEvent.setup();
    render(<CardKeyConverter initialPlatform="claude" initialFormat="sub2api" />);

    await user.click(screen.getByRole('button', { name: '填入样例数据' }));
    await waitFor(() => expect(screen.getByText(/已成功转换 3 个账号/)).toBeInTheDocument());

    const quickGrokBtn = screen.getByRole('button', { name: '⚡ 只提取 Grok Token' });
    await user.click(quickGrokBtn);

    expect(screen.getByText('输出结果 · 纯 Token 列表')).toBeInTheDocument();
    expect(screen.getByText('上游平台: GROK')).toBeInTheDocument();
  });
});
