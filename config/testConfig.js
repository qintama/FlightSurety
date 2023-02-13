
var FlightSuretyApp = artifacts.require("FlightSuretyApp");
var FlightSuretyData = artifacts.require("FlightSuretyData");
var BigNumber = require('bignumber.js');

var Config = async function(accounts) {
    
    // These test addresses are useful when you need to add
    // multiple users in test scripts
    let testAddresses = [
        "0x4a28EB22722717398c02aeD4d8219515F297858F",
        "0x04e177e2D3C166BEdA6a68c18E7D982d82DC8649",
        "0x2D1fc4b3cd548577ab186D22d0e62375b7b46508",
        "0x4a26074D3F8F32Cf10364c49FFD4268F47Fbb11b",
        "0x3a14d001fe2D65dF381152a32BC92f16177d2594",
        "0xdf19263a59008CCED0C8FEbB5Eb86DaAd28Cf74a",
        "0x3D45965E2c0CAFB2e1d23bA4618f3279d709D0e6",
        "0x64F3CE35C2B1fe23CC1d39da9e57F6Cb2Ca4a870",
        "0x9e8988Ab26a58bAB64CA0F41c8Fc2BCD43EAd143",
        "0xEaaa6A9d034E2C783173b3C54E9B4b2B1A8bF3Cc",
        "0x33088D166FE3765A07F0547aa6907bC3df06E76C"
    ];


    let owner = accounts[0];
    let firstAirline = accounts[1];

    let flightSuretyData = await FlightSuretyData.new(firstAirline);
    let flightSuretyApp = await FlightSuretyApp.new(flightSuretyData.address);
    let flightName = `flight-${Math.floor(Math.random(10))}`;
    let nowTime = new Date();
    nowTime.setDate(nowTime.getDate() + 1)
    let flightDeparture = nowTime.getTime(); // depature time always on tomorrow
    
    return {
        owner: owner,
        firstAirline: firstAirline,
        weiMultiple: (new BigNumber(10)).pow(18),
        testAddresses: testAddresses,
        flightSuretyData: flightSuretyData,
        flightSuretyApp: flightSuretyApp,
        flightName: flightName,
        flightDeparture: flightDeparture
    }
}

module.exports = {
    Config: Config
};