import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

const ORACLES_COUNT = 20;
const STATUS_CODES = [0, 10, 20, 30, 40, 50];
let oracles = [];

async function authorizeAppContract() {
  await flightSuretyData.methods.authorizeAppContract(config.appAddress).send({
    from: '0x4BF410ed3a5eb02A0F876c8BE40f79642b8F26F2', // contract owner address
  });
  const result = await flightSuretyData.methods.isAuthorizedAppContract(config.appAddress).call({
    from: config.appAddress
  });
  console.log(`flightApp contract is authorized: ${result}`);
}

async function registerOracles() {
  await authorizeAppContract();

  let accounts = await web3.eth.getAccounts();
  let oracleAccounts = accounts.slice(10);
  if (oracleAccounts.length != ORACLES_COUNT) {
    console.error("20 oracle accounts needed, that is, you need to set 30 accounts in Ganache", oracleAccounts.length);
    return;
  }
  
  const fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
  for (let index = 0; index < ORACLES_COUNT; index++) {
    const oracleAccount = oracleAccounts[index];
    try {
      await flightSuretyApp.methods.registerOracle().send({
        from: oracleAccount,
        value: fee,
        gas: 3000000,
      });
      const oracleIndexes = await flightSuretyApp.methods.getMyIndexes().call({ from: oracleAccount });
      oracles.push({
        address: oracleAccount,
        indexes: oracleIndexes,
      });
      console.log(`Oracle No.${index} Registered with address and indexes`, oracleAccount, oracleIndexes);
    } catch (error) {
      console.error("register oracle failed", oracleAccount, error);
    }
  }
  console.log('Oracle Registering completed...');
}

function getRandomStatusCode() {
  const randomIndex = Math.floor(Math.random() * STATUS_CODES.length);
  return STATUS_CODES[randomIndex];
}

registerOracles().then(() => {
  console.log('Watching OracleRequest event....');
  flightSuretyApp.events.OracleRequest({
      fromBlock: 'latest'
    }, function (error, event) {
      if (error) {
        console.log(error);
        return;
      }

      const {
        index,
        airline,
        flight,
        timestamp,
      } = event.returnValues;

      console.log(`Incoming oracle request - index: ${index}, airline: ${airline}, flight: ${flight}, departure: ${timestamp}`)
      const randomStatusCode = getRandomStatusCode();
      // uncomment to force trigger a late flight
      // const randomStatusCode = 20;

      for (let j = 0; j < ORACLES_COUNT; j++) {
        const oracleAccount = oracles[j].address;
        for (let i = 0; i < 3; i++) {
          const oracleIndex = oracles[j].indexes[i];
          flightSuretyApp.methods.submitOracleResponse(
            oracleIndex,
            airline,
            flight,
            timestamp,
            randomStatusCode,
          ).send({
            from: oracleAccount,
            gas: 3000000,
          })
          .then(() => {
            console.log(`Accepted - Oracle(${oracleAccount}) submission of status code: ${randomStatusCode}`);
          })
          .catch(() => {
            console.log(`Rejected - Oracle(${oracleAccount}) submission of status code: ${randomStatusCode}`);
          });
        }
      }
  });
});

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;


