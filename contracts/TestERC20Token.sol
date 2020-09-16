// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20Token is ERC20, Ownable
{
	constructor(string memory name, string memory symbol, uint256 mintAmountToOwner)
		ERC20(name, symbol) public
	{
		_mint(msg.sender, mintAmountToOwner);
	}

	function mint(address account, uint256 amount) public virtual onlyOwner
	{
		_mint(account, amount);
	}
}
