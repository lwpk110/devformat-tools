import { readFileSync } from 'node:fs';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConverterTool } from '../../src/components/ConverterTool';

const props = {
  slug: 'json-to-typescript',
  directions: [{
    id: 'json-to-typescript',
    from: 'JSON',
    to: 'TypeScript Interface',
    sampleInput: '{"id":1}',
    sampleOutput: 'export interface Root {\n  id: number;\n}',
    downloadExtension: 'ts',
    summary: 'Generate TypeScript interfaces.',
  }],
};

const bidirectionalProps = {
  slug: 'base64',
  directions: [
    { id: 'base64-encode', from: 'Text', to: 'Base64', sampleInput: 'Hello', sampleOutput: 'SGVsbG8=', downloadExtension: 'txt', summary: 'Encode text.' },
    { id: 'base64-decode', from: 'Base64', to: 'Text', sampleInput: 'SGVsbG8=', sampleOutput: 'Hello', downloadExtension: 'txt', summary: 'Decode Base64.' },
  ],
};

describe('ConverterTool', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始展示服务端样例并可转换用户输入', async () => {
    const user = userEvent.setup();
    render(<ConverterTool {...props} />);

    expect(screen.getByLabelText('JSON input')).toHaveValue(props.directions[0].sampleInput);
    expect(screen.getByLabelText('TypeScript Interface output')).toHaveValue(props.directions[0].sampleOutput);

    fireEvent.change(screen.getByLabelText('JSON input'), { target: { value: '{"name":"Ada"}' } });
    await user.click(
      screen.getByRole('button', { name: 'Convert JSON to TypeScript Interface' }),
    );

    expect(screen.getByLabelText('TypeScript Interface output')).toHaveValue(
      'export interface Root {\n  name: string;\n}',
    );
  });

  it('非法 JSON 显示红色行列错误且清除过期输出', async () => {
    const user = userEvent.setup();
    render(<ConverterTool {...props} />);
    const input = screen.getByLabelText('JSON input');

    await user.clear(input);
    fireEvent.change(input, { target: { value: '{\n  invalid\n}' } });
    await user.click(
      screen.getByRole('button', { name: 'Convert JSON to TypeScript Interface' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/JSON 语法错误.*第 2 行，第 3 列/);
    expect(screen.getByRole('alert')).toHaveClass('text-red-600');
    expect(screen.getByLabelText('TypeScript Interface output')).toHaveValue('');
  });

  it('Copy 成功显示 Copied! 并在 2 秒后恢复', async () => {
    vi.useFakeTimers();
    render(<ConverterTool {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy to Clipboard' }));
    await act(async () => Promise.resolve());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(props.directions[0].sampleOutput);
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('button', { name: 'Copy to Clipboard' })).toBeInTheDocument();
  });

  it('Clipboard 失败保留结果并显示局部错误', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    render(<ConverterTool {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy to Clipboard' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('复制失败'));
    expect(screen.getByLabelText('TypeScript Interface output')).toHaveValue(props.directions[0].sampleOutput);
  });

  it('Clear 清空全部状态，Load Example 恢复并转换示例', async () => {
    const user = userEvent.setup();
    render(<ConverterTool {...props} />);

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByLabelText('JSON input')).toHaveValue('');
    expect(screen.getByLabelText('TypeScript Interface output')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Copy to Clipboard' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Load Example' }));
    expect(screen.getByLabelText('JSON input')).toHaveValue(props.directions[0].sampleInput);
    expect(screen.getByLabelText('TypeScript Interface output')).toHaveValue(props.directions[0].sampleOutput);
  });

  it('双向工具固定左右格式并在中间提供两个转换方向', async () => {
    const user = userEvent.setup();
    render(<ConverterTool {...bidirectionalProps} />);

    const leftInput = screen.getByLabelText('Text input');
    const rightInput = screen.getByLabelText('Base64 input');
    const directionGroup = screen.getByRole('group', { name: 'Conversion direction' });

    expect(leftInput).not.toHaveAttribute('readonly');
    expect(rightInput).not.toHaveAttribute('readonly');
    expect(directionGroup).toContainElement(
      screen.getByRole('button', { name: 'Convert Text to Base64' }),
    );
    expect(directionGroup).toContainElement(
      screen.getByRole('button', { name: 'Convert Base64 to Text' }),
    );
    expect(screen.queryByRole('button', { name: 'Swap direction' })).not.toBeInTheDocument();

    await user.clear(leftInput);
    await user.type(leftInput, 'Codex');
    await user.click(screen.getByRole('button', { name: 'Convert Text to Base64' }));
    expect(rightInput).toHaveValue('Q29kZXg=');

    await user.clear(rightInput);
    await user.type(rightInput, 'V29ybGQ=');
    await user.click(screen.getByRole('button', { name: 'Convert Base64 to Text' }));

    expect(leftInput).toHaveValue('World');
    expect(window.location.pathname).toBe('/');
  });

  it('单向生成器只显示正向按钮并保持输出只读', () => {
    render(<ConverterTool {...props} />);
    expect(screen.queryByRole('button', { name: 'Swap direction' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Convert JSON to TypeScript Interface' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('TypeScript Interface output')).toHaveAttribute('readonly');
  });

  it('反向转换后 Copy 使用左侧最新结果', async () => {
    render(<ConverterTool {...bidirectionalProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Convert Base64 to Text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy to Clipboard' }));
    await act(async () => Promise.resolve());

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello');
  });

  it('Download 使用目标扩展名并释放 object URL', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:result');
    const revokeObjectURL = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<ConverterTool {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:result');
    click.mockRestore();
  });

  it('源码不包含数据外传或 HTML 注入路径', () => {
    const source = readFileSync('src/components/ConverterTool.tsx', 'utf8');
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|method=["']post/i);
    expect(source).not.toContain(['dangerously', 'SetInnerHTML'].join(''));
  });
});
