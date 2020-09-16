const fs = require('fs');
const HDWalletProvider = require('truffle-hdwallet-provider');

const infura_key = fs.readFileSync(__dirname + "/.infura").toString().trim();
const rinkeby_private_key = fs.readFileSync(__dirname + "/.secret.rinkeby.key").toString().trim();
const mainnet_private_key = fs.readFileSync(__dirname + "/.secret.mainnet.key").toString().trim();

module.exports = {
  networks: {
    development: {
     host: "127.0.0.1",     // Localhost (default: none)
     port: 8545,            // Standard Ethereum port (default: none)
     network_id: "*",       // Any network (default: none)
    },

    rinkeby: {
      provider: () => new HDWalletProvider(
        rinkeby_private_key,
        'https://rinkeby.infura.io/v3/' + infura_key
      ),
      gas: 6721975,
      gasPrice: 130000000000, // 130 gwei
      network_id: '4'
    },

    mainnet: {
      provider: () => new HDWalletProvider(
        mainnet_private_key,
        'https://mainnet.infura.io/v3/' + infura_key
      ),
      gas: 6721975,
      gasPrice: 130000000000, // 130 gwei
      network_id: '1'
    },
  },
  compilers: {
    solc: {
      version: "0.6"
    }
  }
}
