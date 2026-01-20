const { ethers } = require("hardhat");

async function main() {
    const maoToken = process.env.MAO_TOKEN;
    const piToken = process.env.PI_TOKEN;
    const wheelGame = process.env.WHEEL_GAME;

    if (!maoToken || !piToken || !wheelGame) {
        throw new Error("Missing MAO_TOKEN / PI_TOKEN / WHEEL_GAME in env");
    }

    const mao = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)"],
        maoToken
    );
    const pi = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)"],
        piToken
    );

    const [maoBal, piBal] = await Promise.all([
        mao.balanceOf(wheelGame),
        pi.balanceOf(wheelGame)
    ]);

    const formatEther = ethers.formatEther ? ethers.formatEther : ethers.utils.formatEther;
    console.log("合约地址:", wheelGame);
    console.log("MAO 奖池余额:", formatEther(maoBal));
    console.log("PI 奖池余额:", formatEther(piBal));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
