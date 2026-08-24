#!/usr/bin/env node

/**
 * Grok / xAI Token 批量刷新与凭证换取脚本
 * 
 * 用法:
 *   node scripts/grok-token-fetcher.mjs --input .local/FF260825440746.txt --output .local/refreshed_cards.txt
 *   node scripts/grok-token-fetcher.mjs --input accounts.txt --mode refresh --format sub2api
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  XAI_AUTH_CONFIG,
  buildRefreshTokenPayload,
  parseAccountsForAuth,
} from '../src/lib/grok/auth.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: '',
    output: '',
    format: 'cards', // 'cards' | 'tokens' | 'sub2api'
    concurrency: 3,
    delayMs: 500,
    endpoint: XAI_AUTH_CONFIG.tokenEndpoint,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--input' || arg === '-i') {
      options.input = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
    } else if (arg === '--concurrency' || arg === '-c') {
      options.concurrency = parseInt(args[++i], 10) || 3;
    } else if (arg === '--delay' || arg === '-d') {
      options.delayMs = parseInt(args[++i], 10) || 500;
    }
  }

  return options;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshTokenItem(account, endpoint) {
  if (!account.refreshToken) {
    return {
      email: account.email,
      password: account.password,
      success: false,
      error: '缺少 Refresh Token',
    };
  }

  try {
    const payload = buildRefreshTokenPayload(account.refreshToken);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
      body: payload.toString(),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        email: account.email,
        password: account.password,
        oldRefreshToken: account.refreshToken,
        success: false,
        error: data.error_description || data.error || `HTTP ${res.status}`,
      };
    }

    return {
      email: account.email,
      password: account.password,
      oldRefreshToken: account.refreshToken,
      newRefreshToken: data.refresh_token || account.refreshToken,
      accessToken: data.access_token,
      success: true,
    };
  } catch (err) {
    return {
      email: account.email,
      password: account.password,
      oldRefreshToken: account.refreshToken,
      success: false,
      error: err.message,
    };
  }
}

async function main() {
  const options = parseArgs();
  if (!options.input) {
    console.error('请指定输入文件: node scripts/grok-token-fetcher.mjs --input <filepath> [--output <filepath>]');
    process.exit(1);
  }

  const inputPath = resolve(process.cwd(), options.input);
  console.log(`[1/3] 读取文件: ${inputPath}`);
  const content = readFileSync(inputPath, 'utf8');
  const accounts = parseAccountsForAuth(content);
  console.log(`[2/3] 共解析出 ${accounts.length} 个账号，开始批量获取/刷新...`);

  const results = [];
  for (let i = 0; i < accounts.length; i += 1) {
    const acc = accounts[i];
    process.stdout.write(`[${i + 1}/${accounts.length}] 处理 ${acc.email} ... `);
    const res = await refreshTokenItem(acc, options.endpoint);
    if (res.success) {
      console.log(`✅ 成功获取新 RT (${(res.newRefreshToken || '').slice(0, 10)}...)`);
    } else {
      console.log(`⚠️ 提示: ${res.error}`);
    }
    results.push(res);
    if (options.delayMs > 0 && i < accounts.length - 1) {
      await sleep(options.delayMs);
    }
  }

  const successful = results.filter((r) => r.success);
  console.log(`\n[3/3] 汇总: 成功 ${successful.length} / ${results.length}`);

  let outputText = '';
  if (options.format === 'tokens') {
    outputText = results.map((r) => r.newRefreshToken || r.oldRefreshToken || '').filter(Boolean).join('\n');
  } else if (options.format === 'sub2api') {
    const doc = {
      type: 'sub2api-data',
      version: 1,
      exported_at: new Date().toISOString(),
      proxies: [],
      accounts: results.map((r) => ({
        name: r.email,
        platform: 'grok',
        type: 'oauth',
        credentials: {
          refresh_token: r.newRefreshToken || r.oldRefreshToken || '',
        },
        extra: {
          email: r.email,
          ...(r.password ? { password: r.password } : {}),
        },
        status: 'active',
      })),
    };
    outputText = JSON.stringify(doc, null, 2);
  } else {
    outputText = results
      .map((r) => `${r.email}----${r.password || ''}----${r.newRefreshToken || r.oldRefreshToken || ''}`)
      .join('\n');
  }

  if (options.output) {
    const outputPath = resolve(process.cwd(), options.output);
    writeFileSync(outputPath, outputText, 'utf8');
    console.log(`结果已保存至: ${outputPath}`);
  } else {
    console.log('\n--- 输出结果 ---\n');
    console.log(outputText);
  }
}

main().catch((err) => {
  console.error('执行出错:', err);
  process.exit(1);
});
