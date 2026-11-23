#!/usr/bin/env node
// roles/build-card.mjs —— 合并「人格.md」+「操作.md」成 DSH 实际读取的角色卡
// 用法：node roles/build-card.mjs
// 规则：忽略以 > 开头的行（说明注释）；超过上限直接报错，不静默截断。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const DIR = path.join(HOME, 'roles');
const PERSONA = path.join(DIR, '小鲸鱼.人格.md');
const OPS = path.join(DIR, '小鲸鱼.操作.md');
const OUT = path.join(DIR, '小鲸鱼.md');
const LIMIT = 6000;

const strip = (t) => t.split('\n').filter((l) => !l.trimStart().startsWith('>')).join('\n').trim();

function readOr(p, fallback) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return fallback; }
}

const persona = strip(readOr(PERSONA, ''));
const ops = strip(readOr(OPS, ''));

const body = [
  '# 角色卡：小鲸鱼（汐玥）',
  '',
  persona,
  '',
  '---',
  '',
  ops,
  '',
].join('\n');

if (body.length > LIMIT) {
  console.error(`合并后 ${body.length} 字，超过上限 ${LIMIT}，先精简再跑`);
  process.exit(2);
}

// 备份旧卡（带日期）
try {
  if (fs.existsSync(OUT)) {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    fs.copyFileSync(OUT, `${OUT}.bak-${stamp}`);
  }
} catch { /* 备份失败不阻塞 */ }

const tmp = OUT + '.tmp';
fs.writeFileSync(tmp, body, 'utf8');
fs.renameSync(tmp, OUT);
console.log(`已生成 ${OUT}：${body.length} 字`);
