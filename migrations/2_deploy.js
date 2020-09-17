const TestERC20Token = artifacts.require("TestERC20Token");
const CALMProtocol = artifacts.require("CALMProtocol");

module.exports = async function(deployer, network, accounts) {
  let coinAddress, uniswapTokenAddress;

  // If not on Mainnet Ethereum, deploy test contracts
  if (network.indexOf('mainnet') === -1)
  {
    console.log(`On non-mainnet network ${network}, deploying test contracts.`);

    // Deploy test $COIN with full supply to owner
    await deployer.deploy(TestERC20Token, "coin_artist_test", "$COINTEST", web3.utils.toWei("3470000", "ether"));
    coinAddress = (await TestERC20Token.deployed()).address;

    // Deploy test $UNI-V2 with initial amount to owner
    await deployer.deploy(TestERC20Token, "UNI-V2", "$UNI-V2-COINTEST", web3.utils.toWei("10000", "ether"));
    uniswapTokenAddress = (await TestERC20Token.deployed()).address;
  }
  else
  {
    console.log(`On mainnet network, using real addresses.`);

    coinAddress = '0x87b008e57f640d94ee44fd893f0323af933f9195';
    uniswapTokenAddress = '0xcce852e473ecfdebfd6d3fd5bae9e964fd2a3fa7';
  }

  /**
   * Note: will want to cover the Rinkeby case individually, to allow for using REAL
   * Uniswap contracts for better tests. We should deploy $COINTEST separately, create a
   * pool, and then use those tokens for more realistic testing.
   **/

  console.log("Deploying C.A.L.M. Protocol");
  await deployer.deploy(CALMProtocol, uniswapTokenAddress, coinAddress);
};
