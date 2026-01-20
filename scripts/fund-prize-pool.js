const { ethers } = require("hardhat");

async function main() {
    const tokenAddress = process.env.FUND_TOKEN;
    const wheelGame = process.env.WHEEL_GAME;
    const amount = process.env.FUND_AMOUNT;

    if (!tokenAddress || !wheelGame || !amount) {
        throw new Error("Missing FUND_TOKEN / WHEEL_GAME / FUND_AMOUNT in env");
    }

    const [deployer] = await ethers.getSigners();
    console.log("付款账户:", deployer.address);

    const token = await ethers.getContractAt(
        [
            "function balanceOf(address) view returns (uint256)",
            "function transfer(address to, uint256 amount) returns (bool)",
            "function decimals() view returns (uint8)"
        ],
        tokenAddress
    );

    const decimals = await token.decimals();
    const value = ethers.parseUnits ? ethers.parseUnits(amount, decimals) : ethers.utils.parseUnits(amount, decimals);

    const balance = await token.balanceOf(deployer.address);
    if (balance < value) {
        throw new Error("余额不足，无法充值");
    }

    const tx = await token.transfer(wheelGame, value);
    console.log("充值交易:", tx.hash);
    await tx.wait(1);
    console.log("✅ 充值成功");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
