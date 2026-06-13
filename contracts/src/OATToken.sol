// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title OAT — Originality Arbiter Token
contract OATToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Originality Arbiter Token", "OAT") {
        _mint(msg.sender, initialSupply);
    }
}
