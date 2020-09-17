// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract CALMProtocol {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	// Tokens used for staking and rewards
	IERC20 public poolToken;
	IERC20 public coinToken;

	// Mapping of Staker Address => Balance
	mapping(address => uint256) stakeBalances;

	// Mapping of Staker Address => Last Claimed Block
	mapping(address => uint256) lastClaimBlock;

	// Rewards
	uint256 blockReward = 1 wei; // wei is the smallest atomic unit of any coin

	// Events
	event Staked(address indexed user, uint256 amount);
	event Withdrawn(address indexed user, uint256 amount);
	event RewardPaid(address indexed user, uint256 reward);

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
		poolToken.safeTransferFrom(msg.sender, address(this), _amount);

		// Claim any tokens on staking, this greatly simplifies the calculation for claim amounts
		claim();

		// Record how many tokens that were staked & when
		stakeBalances[msg.sender] = stakeBalances[msg.sender].add(_amount);

		// Emit staked event
		emit Staked(msg.sender, _amount);
	}

	function unstake() external {
		// Make sure that the sender has stake to unstake
		require(stakeBalances[msg.sender] > 0, "Not staking");

		// First, send all unclaimed rewards -- this also resets claim block
		claim();

		// Transfer ownership of the pool tokens back to the owner
		if (stakeBalances[msg.sender] > 0) {
			poolToken.safeTransfer(msg.sender, stakeBalances[msg.sender]);

			// Reset to 0
			stakeBalances[msg.sender] = 0;

			// Emit unstaked event
			emit Withdrawn(msg.sender, stakeBalances[msg.sender]);
		}
	}

	function claim() public {
		// Make sure that this claimant has tokens to claim
		uint256 claimBalance = getClaimAmount(msg.sender);

		// Set the most recent time they claimed
		lastClaimBlock[msg.sender] = block.number;

		if (claimBalance > 0) {
			// Transfer the tokens to the claimant
			coinToken.safeTransfer(msg.sender, claimBalance);

			// Emit event
			emit RewardPaid(msg.sender, claimBalance);
		}
	}

	/**`
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

		// Determine number of blocks that have passed
		uint256 blocksSinceLastClaim = block.number.sub(lastClaimBlock[_claimant]);

		// Calculate the reward
		return blocksSinceLastClaim.mul(blockReward).mul(stakeBalances[_claimant]).div(1000);
	}

	function getTotalStaked(address _addr) public view returns(uint256) {
		return stakeBalances[_addr];
	}
}
