require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    alvey: {
      url: "https://elves-core2.alvey.io/",
      chainId: 3797,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000,
      gas: 5000000,
      timeout: 60000
    },
    alvey1: {
      url: "https://elves-core1.alvey.io/",
      chainId: 3797,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000,
      gas: 5000000,
      timeout: 60000
    },
    alvey3: {
      url: "https://elves-core3.alvey.io/",
      chainId: 3797,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000,
      gas: 5000000,
      timeout: 60000
    }
  }
};


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    alvey: {
      url: "https://elves-core2.alvey.io/",
      chainId: 3797,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000,
      gas: 5000000,
      timeout: 60000
    },
    alvey1: {
      url: "https://elves-core1.alvey.io/",
      chainId: 3797,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000,
      gas: 5000000,
      timeout: 60000
    },
    alvey3: {
      url: "https://elves-core3.alvey.io/",
      chainId: 3797,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000,
      gas: 5000000,
      timeout: 60000
    }
  }
};
