// 🔓 奖金池授权脚本 - 让新合约能够发放奖励
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    console.log("🔓 开始奖金池授权流程...");
    console.log("============================================================");

    // 合约配置
    const CONFIG = {
        MAO_TOKEN: process.env.MAO_TOKEN || "0x22f49bcb3dad370a9268ba3fca33cb037ca3d022",
        PI_TOKEN: process.env.PI_TOKEN || "0xfd4680e25e05b3435c7f698668d1ce80d2a9f444",
        NEW_WHEEL_GAME: process.env.WHEEL_GAME || "0x562A68418995A6632260F842Bc5267cE0Bd52117",
        PRIZE_POOL: process.env.PRIZE_POOL || "0xE15881Fc413c6cd47a512C24608F94Fa2896b374"
    };

    console.log("📊 配置信息:");
    console.log("MAO代币:", CONFIG.MAO_TOKEN);
    console.log("PI代币:", CONFIG.PI_TOKEN);
    console.log("新游戏合约:", CONFIG.NEW_WHEEL_GAME);
    console.log("奖金池地址:", CONFIG.PRIZE_POOL);

    // 获取签名者（奖金池）
    const [signer] = await ethers.getSigners();
    console.log("📝 当前签名者:", signer.address);
    
    // 验证签名者是否为奖金池地址
    if (signer.address.toLowerCase() !== CONFIG.PRIZE_POOL.toLowerCase()) {
        console.log("⚠️ 注意：当前签名者不是奖金池地址");
        console.log("需要使用奖金池私钥来执行授权");
    }

    try {
        // ERC20 ABI (仅包含需要的函数)
        const ERC20_ABI = [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function allowance(address owner, address spender) external view returns (uint256)",
            "function balanceOf(address account) external view returns (uint256)",
            "function symbol() external view returns (string)"
        ];

        // 连接代币合约
        console.log("\n🔗 连接代币合约...");
        const maoToken = new ethers.Contract(CONFIG.MAO_TOKEN, ERC20_ABI, signer);
        const piToken = new ethers.Contract(CONFIG.PI_TOKEN, ERC20_ABI, signer);

        // 检查当前授权额度
        console.log("\n🔍 检查当前授权额度...");
        const maoAllowance = await maoToken.allowance(CONFIG.PRIZE_POOL, CONFIG.NEW_WHEEL_GAME);
        const piAllowance = await piToken.allowance(CONFIG.PRIZE_POOL, CONFIG.NEW_WHEEL_GAME);
        
        console.log("MAO当前授权额度:", ethers.formatEther(maoAllowance));
        console.log("PI当前授权额度:", ethers.formatEther(piAllowance));

        // 检查奖金池余额
        console.log("\n💰 检查奖金池余额...");
        const maoBalance = await maoToken.balanceOf(CONFIG.PRIZE_POOL);
        const piBalance = await piToken.balanceOf(CONFIG.PRIZE_POOL);
        
        console.log("MAO余额:", ethers.formatEther(maoBalance));
        console.log("PI余额:", ethers.formatEther(piBalance));

        // 设置授权额度（无限授权）
        const APPROVAL_AMOUNT = ethers.MaxUint256; // 使用最大值实现无限授权
        
        console.log("\n🔓 执行无限授权操作...");
        console.log("授权额度: 无限 (MaxUint256)");

        // 授权 MAO 代币
        console.log("\n📝 无限授权 MAO 代币...");
        const maoApproveTx = await maoToken.approve(CONFIG.NEW_WHEEL_GAME, APPROVAL_AMOUNT);
        console.log("MAO授权交易哈希:", maoApproveTx.hash);
        console.log("⏳ 等待 MAO 授权确认...");
        await maoApproveTx.wait();
        console.log("✅ MAO 无限授权成功!");

        // 授权 PI 代币
        console.log("\n📝 无限授权 PI 代币...");
        const piApproveTx = await piToken.approve(CONFIG.NEW_WHEEL_GAME, APPROVAL_AMOUNT);
        console.log("PI授权交易哈希:", piApproveTx.hash);
        console.log("⏳ 等待 PI 授权确认...");
        await piApproveTx.wait();
        console.log("✅ PI 无限授权成功!");

        // 验证授权结果
        console.log("\n🔍 验证授权结果...");
        const newMaoAllowance = await maoToken.allowance(CONFIG.PRIZE_POOL, CONFIG.NEW_WHEEL_GAME);
        const newPiAllowance = await piToken.allowance(CONFIG.PRIZE_POOL, CONFIG.NEW_WHEEL_GAME);
        
        // 检查是否为无限授权 - 修复ethers兼容性
        const isMaxUint = (value) => value.toString() === ethers.MaxUint256.toString();
        
        console.log("✅ MAO新授权额度:", isMaxUint(newMaoAllowance) ? "无限 (MaxUint256)" : ethers.formatEther(newMaoAllowance));
        console.log("✅ PI新授权额度:", isMaxUint(newPiAllowance) ? "无限 (MaxUint256)" : ethers.formatEther(newPiAllowance));

        // 保存授权记录
        const authorizationRecord = {
            timestamp: new Date().toISOString(),
            prizePool: CONFIG.PRIZE_POOL,
            newContract: CONFIG.NEW_WHEEL_GAME,
            maoApprovalTx: maoApproveTx.hash,
            piApprovalTx: piApproveTx.hash,
            approvalAmount: "无限 (MaxUint256)",
            maoAllowance: isMaxUint(newMaoAllowance) ? "无限 (MaxUint256)" : ethers.formatEther(newMaoAllowance),
            piAllowance: isMaxUint(newPiAllowance) ? "无限 (MaxUint256)" : ethers.formatEther(newPiAllowance),
            status: "SUCCESS"
        };

        console.log("\n💾 保存授权记录...");
        const fs = require('fs');
        fs.writeFileSync(
            'PRIZE_POOL_AUTHORIZATION.json',
            JSON.stringify(authorizationRecord, null, 2)
        );

        console.log("\n🎉 奖金池授权完成！");
        console.log("============================================================");
        console.log("📊 授权摘要:");
        console.log("- MAO代币授权: ✅ 成功");
        console.log("- PI代币授权: ✅ 成功");
        console.log("- 授权额度: 无限 (MaxUint256)");
        console.log("- 新合约现在可以发放奖励了!");
        
        console.log("\n📋 下一步:");
        console.log("1. ✅ 奖金池授权 - 已完成");
        console.log("2. 🌐 清除浏览器缓存");
        console.log("3. 🎮 测试游戏功能");
        console.log("4. 📢 公告用户使用新版本");

        return authorizationRecord;

    } catch (error) {
        console.error("❌ 授权失败:", error);
        throw error;
    }
}

// 运行授权脚本
if (require.main === module) {
    main()
        .then((record) => {
            console.log("\n🎯 奖金池授权成功完成!");
            console.log("现在用户可以正常获得50%中奖率的游戏体验了! 🚀");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 授权过程中出现错误:", error);
            process.exit(1);
        });
}

module.exports = main; 
