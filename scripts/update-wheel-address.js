const fs = require("fs");
const path = require("path");

const address = process.argv[2];
if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    console.error("用法: node scripts/update-wheel-address.js <0x...>");
    process.exit(1);
}

const targets = [
    "index.html",
    "index-ultimate-v88.html"
];

const pattern = /WHEEL_GAME:\s*\"0x[a-fA-F0-9]{40}\"/g;

targets.forEach((file) => {
    const filePath = path.join(process.cwd(), file);
    const content = fs.readFileSync(filePath, "utf8");
    const updated = content.replace(pattern, `WHEEL_GAME: "${address}"`);
    fs.writeFileSync(filePath, updated);
    console.log(`✅ 已更新 ${file} 的 WHEEL_GAME`);
});
