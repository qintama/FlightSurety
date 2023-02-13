var HDWalletProvider = require("@truffle/hdwallet-provider");
var mnemonic = "that gloom earth spirit total fly seminar embrace february example bundle laugh";

module.exports = {
  networks: {
    test: {
      host: "127.0.0.1",
      port: 8545,
      network_id: '*',
      gas: 5999999
    },
    development: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
      },
      network_id: '*',
      gas: 5999999
    }
  },
  compilers: {
    solc: {
      version: "^0.4.24"
    }
  }
};