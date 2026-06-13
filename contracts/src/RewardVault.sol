// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title RewardVault — distributes OAT rewards for original content
/// @notice The resolver reads GenLayer's read_reward_eligibility() and calls
///         reward() for eligible submissions. Never interprets content itself.
contract RewardVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public resolver;
    uint256 public rewardAmount;

    mapping(uint256 => bool) public claimed;

    event Rewarded(uint256 indexed submissionKey, address indexed author, uint256 amount);
    event ResolverUpdated(address resolver);
    event RewardAmountUpdated(uint256 amount);

    error NotResolver();
    error AlreadyClaimed();
    error InsufficientBalance();

    constructor(IERC20 _token, address _resolver, uint256 _rewardAmount) Ownable(msg.sender) {
        token = _token;
        resolver = _resolver;
        rewardAmount = _rewardAmount;
    }

    function setResolver(address _resolver) external onlyOwner {
        resolver = _resolver;
        emit ResolverUpdated(_resolver);
    }

    function setRewardAmount(uint256 _amount) external onlyOwner {
        rewardAmount = _amount;
        emit RewardAmountUpdated(_amount);
    }

    /// @notice Resolver confirms content is original → pay the author
    function reward(uint256 submissionKey, address author) external nonReentrant {
        if (msg.sender != resolver) revert NotResolver();
        if (claimed[submissionKey]) revert AlreadyClaimed();
        if (token.balanceOf(address(this)) < rewardAmount) revert InsufficientBalance();

        claimed[submissionKey] = true;
        token.safeTransfer(author, rewardAmount);
        emit Rewarded(submissionKey, author, rewardAmount);
    }

    function remainingRewards() external view returns (uint256) {
        return token.balanceOf(address(this)) / rewardAmount;
    }
}
