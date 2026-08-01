import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SessionConverter } from '../../src/components/SessionConverter';
import { EXAMPLE_SESSION } from '../../src/lib/session/converter';

describe('SessionConverter 批处理工作台', () => {
  it('空状态突出批量导入入口并禁用结果操作', () => {
    render(<SessionConverter />);

    expect(screen.getByRole('heading', { name: '批处理工作台' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上传 JSON/TXT 文件' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制结果' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /下载/ })).toBeDisabled();
  });

  it('加载示例后显示成功统计、账号列表和当前格式', async () => {
    const user = userEvent.setup();
    render(<SessionConverter />);

    await user.click(screen.getByRole('button', { name: '加载示例' }));

    await waitFor(() => expect(screen.getByText('已转换 1 个账号')).toBeInTheDocument());
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '转换账号列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制结果' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '下载 JSON' })).toBeEnabled();
  });

  it('将复制和下载放在结果摘要后的显著操作栏', async () => {
    const user = userEvent.setup();
    render(<SessionConverter />);

    await user.click(screen.getByRole('button', { name: '加载示例' }));
    await waitFor(() => expect(screen.getByText('已转换 1 个账号')).toBeInTheDocument());

    const actions = screen.getByRole('group', { name: '结果操作' });
    const copy = screen.getByRole('button', { name: '复制结果' });
    const download = screen.getByRole('button', { name: '下载 JSON' });

    expect(actions).toContainElement(copy);
    expect(actions).toContainElement(download);
    expect(copy).toHaveClass('min-h-11');
    expect(download).toHaveClass('min-h-11', 'bg-teal-700');
  });

  it('切换输出格式后更新结果标题和格式统计', async () => {
    const user = userEvent.setup();
    render(<SessionConverter />);

    await user.click(screen.getByRole('button', { name: '加载示例' }));
    await waitFor(() => expect(screen.getByText('已转换 1 个账号')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'CPA' }));

    expect(screen.getByRole('heading', { name: '输出结果 · CPA' })).toBeInTheDocument();
    expect(screen.getByText('CPA', { selector: 'p' })).toBeInTheDocument();
  });

  it('多账号 CPA 结果提供 ZIP 下载动作', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn().mockReturnValue('blob:result');
    const revokeObjectURL = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<SessionConverter />);

    const input = screen.getByRole('textbox', { name: '输入 Session JSON' });
    const example = { ...EXAMPLE_SESSION };
    fireEvent.change(input, { target: { value: JSON.stringify([example, example]) } });
    await user.click(screen.getByRole('tab', { name: 'CPA' }));

    await waitFor(() => expect(screen.getByText('已转换 2 个账号')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '下载 ZIP' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '下载 ZIP' }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();

    click.mockRestore();
  });

  it('保留多段 JSON 文本以便逐行解析 session', async () => {
    const { container } = render(<SessionConverter />);
    const fileInput = container.querySelector('input[type="file"]');
    const sessions = [
      JSON.stringify(EXAMPLE_SESSION),
      JSON.stringify({ ...EXAMPLE_SESSION, user: { ...EXAMPLE_SESSION.user, email: 'second@example.com' } }),
    ].join('\n');
    const file = { name: 'sessions.txt', text: async () => sessions } as File;

    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, { target: { files: [file] } });

    expect(await screen.findByText('已转换 2 个账号')).toBeInTheDocument();
  });

  it('选中的格式 tab 使用 aria-selected', () => {
    render(<SessionConverter />);

    expect(screen.getByRole('tab', { name: 'sub2api' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'CPA' })).toHaveAttribute('aria-selected', 'false');
  });
});
