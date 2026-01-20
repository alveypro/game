#!/usr/bin/env bash
set -euo pipefail

NETWORK="${1:-alvey}"
BRANCH="${2:-game-main}"

if [ -z "${MAO_TOKEN:-}" ] || [ -z "${PI_TOKEN:-}" ] || [ -z "${MARKETING_WALLET:-}" ]; then
  echo "请先设置环境变量: MAO_TOKEN / PI_TOKEN / MARKETING_WALLET"
  exit 1
fi

echo "== 部署 Commit-Reveal 合约 =="
npx hardhat run scripts/deploy-commit-reveal.js --network "$NETWORK"

if [ ! -f "deployment-commit-reveal.json" ]; then
  echo "未生成 deployment-commit-reveal.json"
  exit 1
fi

NEW_ADDR="$(node -e "const d=require('./deployment-commit-reveal.json'); console.log(d.address);")"
if [ -z "$NEW_ADDR" ]; then
  echo "未获取到新合约地址"
  exit 1
fi

echo "== 更新前端合约地址 =="
node scripts/update-wheel-address.js "$NEW_ADDR"

echo "== 发布到 GitHub Pages =="
bash scripts/publish-github-pages.sh "$BRANCH"

echo "完成：新合约地址已写入并推送。"
