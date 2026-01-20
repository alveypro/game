const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const maoToken = process.env.MAO_TOKEN;
    const piToken = process.env.PI_TOKEN;
    const marketingWallet = process.env.MARKETING_WALLET;

    if (!maoToken || !piToken || !marketingWallet) {
        throw new Error("Missing MAO_TOKEN / PI_TOKEN / MARKETING_WALLET in env");
    }

    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    const formatEther = ethers.formatEther ? ethers.formatEther : ethers.utils.formatEther;
    console.log("部署账户余额:", formatEther(balance));

    const Factory = await ethers.getContractFactory("WheelGameCommitReveal");
    const contract = await Factory.deploy(maoToken, piToken, marketingWallet);
    if (contract.waitForDeployment) {
        await contract.waitForDeployment();
    } else {
        await contract.deployed();
    }

    const contractAddress = contract.getAddress ? await contract.getAddress() : contract.address;
    console.log("✅ Commit-Reveal 合约已部署:", contractAddress);

    const network = await ethers.provider.getNetwork();
    const deploymentInfo = {
        contract: "WheelGameCommitReveal",
        address: contractAddress,
        maoToken,
        piToken,
        marketingWallet,
        deployer: deployer.address,
        chainId: network.chainId.toString(),
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
        "deployment-commit-reveal.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("📄 部署信息已保存到 deployment-commit-reveal.json");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
