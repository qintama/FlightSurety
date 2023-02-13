
var Test = require('../config/testConfig.js');
//var BigNumber = require('bignumber.js');

contract('Oracles', async (accounts) => {

  const TEST_ORACLES_COUNT = 20;
  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);

    // Watch contract events
    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;

  });


  it('can register oracles', async () => {
    
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    let hasError = false;
    for(let a=1; a<TEST_ORACLES_COUNT; a++) {
      try {
        await config.flightSuretyApp.registerOracle({ from: accounts[a], value: fee });
        // Enable this when debugging
        let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
        console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
      } catch (error) {
        hasError = true;
        break;
      }
    }
    assert.equal(hasError, false, "should registered 20 oracles");
  });

  it('can request flight status', async () => {
    
    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    // Submit a request for oracles to get status information for a flight
    const tx = await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);
    const validIndex = tx.logs[0].args[0];
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for(let a=1; a<TEST_ORACLES_COUNT; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a]});
      for(let idx=0;idx<3;idx++) {
        let shouldAccept = oracleIndexes[idx] === validIndex;
        let accepted = false;
        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_ON_TIME, { from: accounts[a] });
          accepted = true
          console.log('\nAccepted', `Oracle[${a}]`, oracleIndexes[idx].toNumber(), flight, timestamp);
        }
        catch(e) {
          console.log('\nRejected', `Oracle[${a}]`, oracleIndexes[idx].toNumber(), flight, timestamp);
        }
        assert.equal(shouldAccept, accepted, "should not accept/reject from contract");
      }
    }


  });


 
});
