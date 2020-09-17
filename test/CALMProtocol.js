/*global artifacts, assert, before, contract, it, web3*/

const {
  time,
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const CALMProtocol = artifacts.require('./CALMProtocol.sol');
const TestERC20Token = artifacts.require('./TestERC20Token.sol');

contract('C.A.L.M. Protocol Tests', async (accounts) => {
  let coinToken,
      uniswapToken,
      calmProtocol;

  const owner = accounts[0],
        user1 = accounts[1],
        user2 = accounts[2],
        whale = accounts[3];

  async function checkBalance(token, address, amount) {
    let balance = await token.balanceOf(address);
    assert(equal(balance, amount));
  }

  async function checkStaked(user1Amount, user2Amount, whaleAmount) {
    assert(equal(await calmProtocol.getTotalStaked(user1), user1Amount));
    assert(equal(await calmProtocol.getTotalStaked(user2), user2Amount));
    assert(equal(await calmProtocol.getTotalStaked(whale), whaleAmount));
  }

  function etherToWei(amount) {
    return web3.utils.toWei(String(amount), "ether");
  }

  function finneyToWei(amount) {
    return web3.utils.toWei(String(amount), "finney");
  }

  function equal(a, b) {
    return a.eq(web3.utils.toBN(b));
  }

  function toBN(a) {
    return web3.utils.toBN(a);
  }

  before(async () => {
    coinToken    = await TestERC20Token.new("coin_artist","COIN", etherToWei(3470000));
    uniswapToken = await TestERC20Token.new("Uniswap: V2","UNI-V2",0);
    calmProtocol = await CALMProtocol.new(uniswapToken.address, coinToken.address);

    // Distribute initial tokens to the contract, 10% of total
    await coinToken.transfer(calmProtocol.address, etherToWei(347000), {from:owner});

    // Distribute LP tokens to two different users
    await uniswapToken.mint(user1, etherToWei(10), {from: owner});
    await uniswapToken.mint(user2, etherToWei(50), {from: owner});
    await uniswapToken.mint(whale, etherToWei(10000), {from: owner});
  });

  it('Sanity check: Blocks should increment as expected in tests', async () => {
    let initialBlock = await time.latestBlock();
    await time.advanceBlock();
    assert(equal(await time.latestBlock(), initialBlock.add(toBN(1))));
  }); 

  it('CALM Protocol should have minimal balance required at start', async () => {
    await checkBalance(coinToken, calmProtocol.address, etherToWei(347000));
    await checkBalance(uniswapToken, calmProtocol.address, 0);
  });

  it('Users should all have expected amounts of LP token', async () => {
    await checkBalance(uniswapToken, user1, etherToWei(10));
    await checkBalance(uniswapToken, user2, etherToWei(50));
    await checkBalance(uniswapToken, whale, etherToWei(10000));
  });

  it('CALM Protocol should not be able to transfer a user\'s tokens without approval', async () => {
    await expectRevert(
      calmProtocol.stake(etherToWei(10), {from: user1}),
      'ERC20: transfer amount exceeds allowance'
    );
  });

  it('CALM Protocol should not be able to transfer a user\'s tokens without approval for enough tokens', async () => {
    await uniswapToken.approve(calmProtocol.address, etherToWei(5), {from: user1});
    await expectRevert(
      calmProtocol.stake(etherToWei(10), {from: user1}),
      'ERC20: transfer amount exceeds allowance'
    );
  });

  it('User 1 should be able to stake half of their LP', async () => {
    await uniswapToken.approve(calmProtocol.address, etherToWei(10), {from: user1});
    await calmProtocol.stake(etherToWei(5), {from: user1});
    await checkBalance(uniswapToken, user1, etherToWei(5));
    await checkBalance(uniswapToken, calmProtocol.address, etherToWei(5));
  });

  it('User 1 should have zero rewards in the same block', async () => {
    let reward = await calmProtocol.getClaimAmount(user1);
    assert(equal(reward, 0));
  });

  it('User 1 should have initial rewards in the following block', async () => {
    await time.advanceBlock();
    let reward = await calmProtocol.getClaimAmount(user1);
    assert(equal(reward, finneyToWei(5)));
  });

  it('User 2 should not be able to unstake if they haven\'t staked', async () => {
    await expectRevert(
      calmProtocol.unstake({from: user2}),
      'Not staking'
    );
  });

  it('User 2 should be able to stake all of their LP', async () => {
    await uniswapToken.approve(calmProtocol.address, etherToWei(50), {from: user2});
    await calmProtocol.stake(etherToWei(50), {from: user2});
    await checkBalance(uniswapToken, user2, etherToWei(0));
    await checkBalance(uniswapToken, calmProtocol.address, etherToWei(55));
  });

  it('User 2 should have zero rewards in the same block', async () => {
    let reward = await calmProtocol.getClaimAmount(user2);
    assert(equal(reward, 0));
  });

  it('User 2 should have initial rewards in the following block', async () => {
    await time.advanceBlock();
    let reward = await calmProtocol.getClaimAmount(user2);
    assert(equal(reward, finneyToWei(50)));
  });

  it('User 2 should have expected follow-up rewards', async () => {
    let reward;

    await time.advanceBlock();
    reward = await calmProtocol.getClaimAmount(user2);
    assert(equal(reward, finneyToWei(100)));

    await time.advanceBlock();
    reward = await calmProtocol.getClaimAmount(user2);
    assert(equal(reward, finneyToWei(150)));
  });

  it('All users should have the expected amounts staked at this time', async () => {
    await checkStaked(etherToWei(5), etherToWei(50), etherToWei(0));
  });

  it('User 1 should be able to claim their stake, then have rewards reset', async () => {
    let reward;

    // Should have 0 at first
    await checkBalance(coinToken, user1, 0);

    // Make sure the expected reward matches final reward
    reward = await calmProtocol.getClaimAmount(user1);
    await calmProtocol.claim({from: user1});
    await checkBalance(coinToken, user1, reward.add(toBN(finneyToWei(5))));

    // Make sure that the new claim amount is nil
    reward = await calmProtocol.getClaimAmount(user1);
    assert(equal(reward, 0));

    // Push forward a block and make sure we're accruing again
    await time.advanceBlock();
    reward = await calmProtocol.getClaimAmount(user1);
    assert(equal(reward, finneyToWei(5)));
  });

  it('User 1 should be able to add to their stake and see amount increase each block as expected', async () => {
    let reward, nextReward;

    // Stake the remainder
    await calmProtocol.stake(etherToWei(5), {from:user1});

    // Make sure the current claim amount is incremented by the full amount of stake now
    nextReward = await calmProtocol.getClaimAmount(user1);
    assert(equal(toBN(finneyToWei(0)), nextReward));

    //// Now make sure that claim amount is increasing as expected
    await time.advanceBlock();
    nextReward = await calmProtocol.getClaimAmount(user1);
    assert(equal(toBN(finneyToWei(10)), nextReward));

    await time.advanceBlock();
    nextReward = await calmProtocol.getClaimAmount(user1);
    assert(equal(toBN(finneyToWei(20)), nextReward));
  });

  it('All users should have the expected amounts staked at this time', async () => {
    await checkStaked(etherToWei(10), etherToWei(50), etherToWei(0));
  });

  it('User 2 should be able to exit / unstake and get their full expected stake', async () => {
    let reward;

    // Should have 0 at first
    await checkBalance(coinToken, user2, 0);

    // Make sure the expected reward matches final reward
    reward = await calmProtocol.getClaimAmount(user2);
    await calmProtocol.unstake({from: user2});
    await checkBalance(coinToken, user2, reward.add(toBN(finneyToWei(50))));

    // Make sure that the contract has the expected amount of uniswap token
    await checkBalance(uniswapToken, calmProtocol.address, etherToWei(10));

    // Make sure that the new claim amount is nil
    reward = await calmProtocol.getClaimAmount(user2);
    assert(equal(reward, 0));

    // Push forward a block and make sure we're NOT accruing anymore
    await time.advanceBlock();
    reward = await calmProtocol.getClaimAmount(user2);
    assert(equal(reward, 0));
  });

  it('All users should have the expected amounts staked at this time', async () => {
    await checkStaked(etherToWei(10), etherToWei(0), etherToWei(0));
  });

  it('User 2 should be able to join back in and stake all of their LP', async () => {
    await uniswapToken.approve(calmProtocol.address, etherToWei(25), {from: user2});
    await calmProtocol.stake(etherToWei(25), {from: user2});
    await checkBalance(uniswapToken, user2, etherToWei(25));
    await checkBalance(uniswapToken, calmProtocol.address, etherToWei(35));
  });

  it('User 2 should have zero rewards in the same block', async () => {
    let reward = await calmProtocol.getClaimAmount(user2);
    assert(equal(reward, 0));
  });

  it('User 2 should have initial rewards in the following block', async () => {
    await time.advanceBlock();
    let reward = await calmProtocol.getClaimAmount(user2);
    assert(equal(reward, finneyToWei(25)));
  });

  it('User 2 should have expected follow-up rewards', async () => {
    let reward;

    await time.advanceBlock();
    reward = await calmProtocol.getClaimAmount(user2);
    assert(equal(reward, finneyToWei(50)));

    await time.advanceBlock();
    reward = await calmProtocol.getClaimAmount(user2);
    assert(equal(reward, finneyToWei(75)));
  });

  it('All users should have the expected amounts staked at this time', async () => {
    await checkStaked(etherToWei(10), etherToWei(25), etherToWei(0));
  });

});
