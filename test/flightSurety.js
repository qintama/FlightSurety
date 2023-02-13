
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');
const Web3 = require('web3');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeAppContract(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  // airlines
  it('(airline) first airline is registered and participated when contract is deployed', async () => {
    const {
        registered,
        participated,
    } = await config.flightSuretyApp.getAirlineInfo(config.firstAirline);
    
    assert.equal(registered, true, "first airline is not registered when contract is deployed.");
    assert.equal(participated, true, "first airline is not participated when contract is deployed.");
  });

  it('(airline - Multiparty Consensus) first 4 airlines (including first airline) can be registered by participated airline', async () => {
    const fourthAirlineIndex = 4;
    let registeredAirlineCount = 1;
    for (let index = 2; index <= fourthAirlineIndex; index++) {
        const { logs } = await config.flightSuretyApp.registerAirline(config.testAddresses[index], { from: config.firstAirline });
        registeredAirlineCount += 1;
        const [txLog] = logs;

        assert.equal(txLog.event, 'AirLineRegistered', "should emit event AirLineRegistered");
        assert.equal(txLog.args[0], config.testAddresses[index], "should emit with corresponding address");
        assert.equal(txLog.args[1], true, "should have isRegistered to be true");
        assert.equal(txLog.args[2], registeredAirlineCount, "should incremented registered airlines count");
    }
  });

  it('(airline - Multiparty Consensus) 5th and subsequent airlines requires participated airlines to vote to be registered', async () => {
    const fifthAirlineIndex = 5;
    let votingQueueCount = 0;
    const { logs } = await config.flightSuretyApp.registerAirline(config.testAddresses[fifthAirlineIndex], { from: config.firstAirline });
    votingQueueCount += 1;

    const [txLog] = logs;
    
    assert.equal(txLog.event, 'AirlineAddedToVote', "should emit event AirlineAddedToVote");
    assert.equal(txLog.args[0], config.testAddresses[fifthAirlineIndex], "should emit with corresponding address");
    assert.equal(txLog.args[1], votingQueueCount, "should incremented voting queue count");
  });

  it('(airline - Airline Ante) airlines can fund themselves with 10 ether to be participated', async () => {
    const fourthAirlineIndex = 4;
    let participatedAirlineCount = 1;
    for (let index = 2; index <= fourthAirlineIndex; index++) {
        const { logs } = await config.flightSuretyApp.fundAirline(config.testAddresses[index], { 
            from: config.testAddresses[index],
            value: Web3.utils.toWei('10', 'ether'),
        });
        participatedAirlineCount += 1;
        const [txLog] = logs;

        assert.equal(txLog.event, 'AirlineParticipated', "should emit event AirlineParticipated");
        assert.equal(txLog.args[0], config.testAddresses[index], "should emit with corresponding address");
        assert.equal(txLog.args[1], Web3.utils.toWei('10', 'ether'), "should 10 ether funding");
        assert.equal(txLog.args[2], participatedAirlineCount, "should incremented participated airlines count");
    }
  });

  it('(airline - Multiparty Consensus) participated airlines can vote and register an airline if vote counts > 50% of participated airlines', async () => {
    const fifthAirline = config.testAddresses[5];

    let votes = 0;
    let votingQueueCount = 1;
    // 3 out of 4 multi consensus
    for (let index = 2; index <= 3; index++) {
        const { logs } = await config.flightSuretyApp.voteAirline(fifthAirline, { 
            from: config.testAddresses[index]
        });
        votes += 1;
        const [txLog] = logs;

        assert.equal(txLog.event, 'AirlineVoted', "should emit event AirlineVoted");
        assert.equal(txLog.args[0], fifthAirline, "should emit with fifthAirline address");
        assert.equal(txLog.args[1], votes, "should incremented votes");
        assert.equal(txLog.args[2], votingQueueCount, "should not change voting queue count");
    }
    
    const fourthAirline = config.testAddresses[4];
    const { logs } = await config.flightSuretyApp.voteAirline(fifthAirline, { 
        from: fourthAirline
    });
    votes += 1;
    votingQueueCount = 0;
    const registeredAirlineCount = 5;

    const [txLog] = logs;
    assert.equal(txLog.event, 'AirlineVotedAndRegistered', "should emit event AirlineVotedAndRegistered");
    assert.equal(txLog.args[0], fifthAirline, "should emit with fifthAirline address");
    assert.equal(txLog.args[1], votes, "should incremented votes");
    assert.equal(txLog.args[2], registeredAirlineCount, "should incremented registered airlines count");
    assert.equal(txLog.args[3], votingQueueCount, "should decremented voting queue count");
  });

  it('(airline - register flight) participated airlines can register flights', async () => {
    const fourthAirline = config.testAddresses[4];
    const { logs } = await config.flightSuretyApp.registerFlight(config.flightName, config.flightDeparture, { 
        from: fourthAirline
    });

    const [txLog] = logs;
    assert.equal(txLog.event, 'FlightRegistered', "should emit event FlightRegistered");
    assert.equal(txLog.args[0], fourthAirline, "should emit with fourthAirline address");
    assert.equal(txLog.args[1], config.flightName, "should have flight name");
    assert.equal(txLog.args[2], config.flightDeparture, "should have departure time on next day");
    assert.equal(txLog.args[3], 0, "should have status code 0");
  });

  // passengers
  it('(passenger - Airline Choice & Payment) passenger can buy insurance upto 1 ether of a registered flight by specifying airline address, flight name and departure timestamp', async () => {
    const fourthAirline = config.testAddresses[4];
    const passenger = config.testAddresses[6];
    const insuredBalance = Web3.utils.toWei('0.6', 'ether');
    const compensationAmount = Web3.utils.toWei('0.9', 'ether');

    const { logs } = await config.flightSuretyApp.buyInsurance(fourthAirline, config.flightName, config.flightDeparture, { 
        from: passenger,
        value: Web3.utils.toWei('0.6', 'ether'),
    });

    const [txLog] = logs;
    assert.equal(txLog.event, 'InsuranceBought', "should emit event InsuranceBought");
    assert.equal(txLog.args[0], passenger, "should emit with passenger address");
    assert.equal(txLog.args[1], insuredBalance, "should have insured balance");
    assert.equal(txLog.args[2], compensationAmount, "should have compensation amount 1.5x");
    assert.equal(txLog.args[3], fourthAirline, "should emit with fourthAirline address");
    assert.equal(txLog.args[4], config.flightName, "should have flight name");
    assert.equal(txLog.args[5], config.flightDeparture, "should have departure time on next day");
  });

  it('(passenger - Repayment) If flight is delayed, passengers will be credited for 1.5x the amount they buy insurance', async () => {
    const fourthAirline = config.testAddresses[4];
    const passenger = config.testAddresses[6];
    const oracle = config.testAddresses[7];
    const lateStatusCode = 20;

    await config.flightSuretyApp.registerOracle({ 
        from: oracle,
        value: Web3.utils.toWei('1', 'ether'),
    });

    const { logs } = await config.flightSuretyApp.fetchFlightStatus(fourthAirline, config.flightName, config.flightDeparture, { 
        from: oracle,
    });
    const [txLog] = logs;
    const oracleIndex = txLog.args[0];

    for (let index = 0; index < 3; index++) {
        await config.flightSuretyApp.submitOracleResponse(
            oracleIndex, fourthAirline, config.flightName, config.flightDeparture,
            lateStatusCode,
            { 
                from: oracle,
            }
        );
    }

    const insuredBalance = Web3.utils.toWei('0.6', 'ether');
    const compensationAmount = Web3.utils.toWei('0.9', 'ether');
    const insuranceProfile = await config.flightSuretyApp.getInsuranceProfile(fourthAirline, config.flightName, config.flightDeparture, { 
        from: passenger,
    });

    assert.equal(insuranceProfile.bought, true, "should bought insurance");
    assert.equal(insuranceProfile.credited, true, "should credited insurance");
    assert.equal(insuranceProfile.withdrawed, false, "should not withdraw insurance");
    assert.equal(insuranceProfile.balance, insuredBalance, "should have such insured balance");
    assert.equal(insuranceProfile.creditBalance, compensationAmount, "should have such compensation amount");
  });

  it('(passenger - Withdraw) passenger is able to withdraw compensation from credited insurance', async () => {
    const fourthAirline = config.testAddresses[4];
    const passenger = config.testAddresses[6];

    const { logs } = await config.flightSuretyApp.withdrawInsurance(fourthAirline, config.flightName, config.flightDeparture, { 
        from: passenger,
    });
    const [txLog] = logs;

    const insuredBalance = Web3.utils.toWei('0.6', 'ether');
    const compensationAmount = Web3.utils.toWei('0.9', 'ether');

    assert.equal(txLog.event, 'InsuranceWithdrawed', "should emit event InsuranceWithdrawed");
    assert.equal(txLog.args[0], true, "should withdrawed compensation");
    assert.equal(txLog.args[1], insuredBalance, "should have insured balance");
    assert.equal(txLog.args[2], compensationAmount, "should have compensation amount 1.5x");
  });
});
