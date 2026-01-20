// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WheelGameCommitReveal is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable maoToken;
    IERC20 public immutable piToken;

    address public marketingWallet;

    uint256 public maoGameCost = 100 * 10**18;
    uint256 public piGameCost = 1000 * 10**18;

    uint256 public constant PRIZE_POOL_PERCENT = 70;
    uint256 public constant BURN_PERCENT = 15;
    uint256 public constant MARKETING_PERCENT = 15;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    uint256 public constant MIN_REVEAL_BLOCKS = 1;
    uint256 public constant MAX_REVEAL_BLOCKS = 200;

    uint256[6] public maoRewards = [
        0,
        105 * 10**18,
        125 * 10**18,
        200 * 10**18,
        600 * 10**18,
        1000 * 10**18
    ];

    uint256[6] public piRewards = [
        0,
        1050 * 10**18,
        1250 * 10**18,
        2000 * 10**18,
        6000 * 10**18,
        10000 * 10**18
    ];

    uint256[6] public probabilityRanges = [
        5000,
        7200,
        9200,
        9900,
        9980,
        10000
    ];

    struct CommitInfo {
        uint256 blockNumber;
        uint8 tokenType;
        bytes32 commitHash;
        uint256 betAmount;
        bool settled;
    }

    mapping(address => CommitInfo) public commits;

    struct GameResult {
        address player;
        uint8 tokenType;
        uint256 betAmount;
        uint256 rewardAmount;
        uint8 rewardLevel;
        uint256 timestamp;
        uint256 randomSeed;
        bool wasProtected;
    }

    mapping(address => GameResult[]) public playerHistory;

    event PlayCommitted(address indexed player, uint8 tokenType, bytes32 commitHash, uint256 blockNumber);
    event GamePlayed(address indexed player, uint8 tokenType, uint256 betAmount, uint256 rewardAmount, uint8 rewardLevel, uint256 randomSeed, bool wasProtected);
    event CommitExpired(address indexed player, uint8 tokenType, uint256 betAmount);
    event MarketingWalletUpdated(address indexed newWallet);
    event GameCostUpdated(uint8 tokenType, uint256 newCost);

    constructor(address _maoToken, address _piToken, address _marketingWallet) {
        require(_maoToken != address(0) && _piToken != address(0), "Invalid token");
        require(_marketingWallet != address(0), "Invalid marketing wallet");

        maoToken = IERC20(_maoToken);
        piToken = IERC20(_piToken);
        marketingWallet = _marketingWallet;
    }

    function commitPlay(uint8 tokenType, bytes32 commitHash) external nonReentrant whenNotPaused {
        require(commitHash != bytes32(0), "Invalid commit");
        CommitInfo storage info = commits[msg.sender];
        require(info.commitHash == bytes32(0) || info.settled, "Pending commit exists");

        IERC20 token = tokenType == 0 ? maoToken : piToken;
        uint256 betAmount = tokenType == 0 ? maoGameCost : piGameCost;

        token.safeTransferFrom(msg.sender, address(this), betAmount);

        commits[msg.sender] = CommitInfo({
            blockNumber: block.number,
            tokenType: tokenType,
            commitHash: commitHash,
            betAmount: betAmount,
            settled: false
        });

        emit PlayCommitted(msg.sender, tokenType, commitHash, block.number);
    }

    function revealPlay(uint8 tokenType, bytes32 secret) external nonReentrant whenNotPaused {
        CommitInfo storage info = commits[msg.sender];
        require(info.commitHash != bytes32(0), "No commit");
        require(!info.settled, "Commit settled");
        require(info.tokenType == tokenType, "Token mismatch");
        require(block.number > info.blockNumber + MIN_REVEAL_BLOCKS, "Reveal too soon");
        require(block.number <= info.blockNumber + MAX_REVEAL_BLOCKS, "Commit expired");

        bytes32 expected = keccak256(abi.encodePacked(msg.sender, tokenType, secret));
        require(expected == info.commitHash, "Invalid secret");

        bytes32 commitBlockHash = blockhash(info.blockNumber);
        require(commitBlockHash != bytes32(0), "Commit too old");

        uint256 randomSeed = uint256(keccak256(abi.encodePacked(
            secret,
            msg.sender,
            commitBlockHash,
            block.prevrandao
        )));

        IERC20 token = tokenType == 0 ? maoToken : piToken;
        (uint256 rewardAmount, uint8 rewardLevel) = _calculateReward(randomSeed, tokenType);

        _settleGame(token, msg.sender, info.betAmount, rewardAmount, rewardLevel, randomSeed);

        info.settled = true;
        emit GamePlayed(msg.sender, tokenType, info.betAmount, rewardAmount, rewardLevel, randomSeed, false);
    }

    function expireCommit(address player) external nonReentrant whenNotPaused {
        CommitInfo storage info = commits[player];
        require(info.commitHash != bytes32(0), "No commit");
        require(!info.settled, "Commit settled");
        require(block.number > info.blockNumber + MAX_REVEAL_BLOCKS, "Not expired");

        IERC20 token = info.tokenType == 0 ? maoToken : piToken;
        _settleGame(token, player, info.betAmount, 0, 0, 0);

        info.settled = true;
        emit CommitExpired(player, info.tokenType, info.betAmount);
    }

    function _settleGame(
        IERC20 token,
        address player,
        uint256 betAmount,
        uint256 rewardAmount,
        uint8 rewardLevel,
        uint256 randomSeed
    ) private {
        uint256 toBurn = (betAmount * BURN_PERCENT) / 100;
        uint256 toMarketing = (betAmount * MARKETING_PERCENT) / 100;

        uint256 balance = token.balanceOf(address(this));
        uint256 reserved = toBurn + toMarketing;
        uint256 maxReward = balance > reserved ? balance - reserved : 0;

        if (rewardAmount > maxReward) {
            rewardAmount = maxReward;
        }

        if (rewardAmount > 0) {
            token.safeTransfer(player, rewardAmount);
        }

        if (toBurn > 0) {
            token.safeTransfer(BURN_ADDRESS, toBurn);
        }

        if (toMarketing > 0) {
            token.safeTransfer(marketingWallet, toMarketing);
        }

        playerHistory[player].push(GameResult({
            player: player,
            tokenType: token == maoToken ? 0 : 1,
            betAmount: betAmount,
            rewardAmount: rewardAmount,
            rewardLevel: rewardLevel,
            timestamp: block.timestamp,
            randomSeed: randomSeed,
            wasProtected: false
        }));
    }

    function _calculateReward(uint256 randomSeed, uint8 tokenType) private view returns (uint256 rewardAmount, uint8 rewardLevel) {
        uint256 randomNum = randomSeed % 10000;
        uint256[6] memory rewards = tokenType == 0 ? maoRewards : piRewards;

        for (uint8 i = 0; i < 6; i++) {
            if (randomNum < probabilityRanges[i]) {
                rewardLevel = i;
                rewardAmount = rewards[i];
                break;
            }
        }
    }

    function getPlayerHistory(address player) external view returns (GameResult[] memory) {
        return playerHistory[player];
    }

    function getPendingCommit(address player) external view returns (CommitInfo memory) {
        return commits[player];
    }

    function setMarketingWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid wallet");
        marketingWallet = newWallet;
        emit MarketingWalletUpdated(newWallet);
    }

    function setGameCost(uint8 tokenType, uint256 newCost) external onlyOwner {
        require(newCost > 0, "Invalid cost");
        if (tokenType == 0) {
            maoGameCost = newCost;
        } else {
            piGameCost = newCost;
        }
        emit GameCostUpdated(tokenType, newCost);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
