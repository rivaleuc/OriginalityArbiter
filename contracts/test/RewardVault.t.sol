// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import {OATToken} from "../src/OATToken.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RewardVaultTest is Test {
    OATToken token;
    RewardVault vault;
    address resolver = address(0xBEEF);
    address author = address(0x1);
    uint256 rewardAmount = 100e18;

    function setUp() public {
        token = new OATToken(1_000_000e18);
        vault = new RewardVault(IERC20(address(token)), resolver, rewardAmount);
        token.transfer(address(vault), 10_000e18);
    }

    function test_reward() public {
        vm.prank(resolver);
        vault.reward(0, author);
        assertEq(token.balanceOf(author), rewardAmount);
        assertTrue(vault.claimed(0));
    }

    function test_cannot_double_claim() public {
        vm.startPrank(resolver);
        vault.reward(0, author);
        vm.expectRevert(RewardVault.AlreadyClaimed.selector);
        vault.reward(0, author);
        vm.stopPrank();
    }

    function test_only_resolver() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(RewardVault.NotResolver.selector);
        vault.reward(0, author);
    }

    function test_remaining_rewards() public {
        assertEq(vault.remainingRewards(), 100); // 10000 / 100
    }
}
