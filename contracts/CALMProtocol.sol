// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CALMProtocol {
	using SafeMath for uint256;

	// Tokens used for staking and rewards
	IERC20 public poolToken;
	IERC20 public coinToken;

	// Mapping of Staker Address => (Time of Stake => Amount Staked)
	mapping(address => mapping(uint256 => uint256)) balanceByBlock;

	// Mapping of Staker Address => Array of Times of Stake
	mapping(address => uint256[]) stakeAtBlock;

	// Mapping of Staker Address => Last Claimed Block
	mapping(address => uint256) lastClaimBlock;

	// Rewards
	//uint256 blockReward = 1 finney; // finney is 1e-3 of one ether (coin)
	uint256 blockReward = 1 wei; // wei is the smallest atomic unit of any coin

	constructor(
		address _poolAddress,
		address _coinAddress
	)
		public
	{
		poolToken = IERC20(_poolAddress);
		coinToken = IERC20(_coinAddress);
	}

	function stake(uint256 _amount) external {
		// Make sure that the sender owns some of the token they're sending
		uint256 poolTokenBalance = poolToken.balanceOf(msg.sender);
		require(poolTokenBalance > 0 && poolTokenBalance >= _amount, "Invalid number of tokens to stake");

		// Transfer ownership of the tokens to this pool
		poolToken.transferFrom(msg.sender, address(this), _amount);

		// If this is the first record of staking for this person, set last claim block
		if (stakeAtBlock[msg.sender].length == 0) {
			lastClaimBlock[msg.sender] = block.number;
		}

		// Record how many tokens that were staked & when
		stakeAtBlock[msg.sender].push(block.number);
		balanceByBlock[msg.sender][block.number].add(_amount);
	}

	function unstake() external {
		// Make sure that the sender has stake to unstake
		require(stakeAtBlock[msg.sender].length > 0, "Not staking");

		// First, send all unclaimed rewards
		// TO CHANGE: there are requires that could fail sensibly when calling claim direct
		// but SHOULD NOT FAIL when calling unstake -- it must always be possible to unstake
		claim();

		// Reset claim block
		// This should happen above ^^^

		// For each stake, add up and return
		uint256 totalPoolBalanceToReturn = 0;
		for (uint256 idx = 0; idx < stakeAtBlock[msg.sender].length; idx++) {
			// Collect the total amount
			uint256 blockNumber = stakeAtBlock[msg.sender][idx];
			uint256 poolAmount = balanceByBlock[msg.sender][blockNumber];
			totalPoolBalanceToReturn.add(poolAmount);

			// Wipe out the balance record
			balanceByBlock[msg.sender][blockNumber] = 0;
		}

		// Wipe out the stake block numbers
		delete stakeAtBlock[msg.sender];

		// Transfer ownership of the pool tokens back to the owner
		poolToken.transfer(msg.sender, totalPoolBalanceToReturn);
	}

	function claim() public {
		// Make sure that this claimant has tokens to claim
		uint256 claimBalance = getClaimAmount(msg.sender);
		require(claimBalance > 0, "No tokens to claim");

		// Require we have enough tokens available for them to claim
		require(claimBalance <= coinToken.balanceOf(address(this)), "Not enough tokens available to claim");

		// Set the most recent time they claimed
		lastClaimBlock[msg.sender] = block.number;

		// Transfer the tokens to the claimant
		coinToken.transfer(msg.sender, claimBalance);
	}

	/**
	 * Note: can generalize this by returning and recording POINTS,
	 * which can be leveraged through contract derivations to allow for claiming
	 * arbitrary rewards, such as other FTs or NFTs
	 **/
	function getClaimAmount(address _claimant) public view returns(uint256) {
		// TEMPORARY, needs actual algorithm
		// May need to know what the value of one UNI-V2 is
		// in order to determine a proper reward
		// May also want to take into account the full pool staked here (unlikely)
		// or the amount that remains (also unlikely, beyond require checks)

		uint256 reward = 0;

		// For each block held, get amount staked
		for (uint256 idx = 0; idx < stakeAtBlock[_claimant].length; idx++) {
			// Collect the total amount at each block
			uint256 blockNumber = stakeAtBlock[_claimant][idx];
			uint256 poolAmount = balanceByBlock[_claimant][blockNumber];

			// Determine if this claim was staked after the last claim was filed
			// If so, then use the larger of the two numbers
			uint256 claimantLastClaimBlock = lastClaimBlock[_claimant];
			if (blockNumber > claimantLastClaimBlock) {
				claimantLastClaimBlock = blockNumber;
			}

			// Determine number of blocks that have passed
			uint256 blocksSinceLastClaim = block.number.sub(claimantLastClaimBlock);

			// Determine amount earned since last claim block
			uint256 thisReward = blocksSinceLastClaim.mul(blockReward).mul(poolAmount.div(1000));

			// Keep track of total reward
			reward.add(thisReward);
		}

		return reward;
	}
}
