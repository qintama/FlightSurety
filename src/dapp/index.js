import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import './flightsurety.css';
import DOM from './dom';
import Web3 from "web3";

const App = {
    web3: null,
    flightSuretyApp: null,
    account: null,
    airlines: [],
    passengers: [],
    gasFee: 3000000,
    insureeCreditedFlights: [],

    start: async function() {
        const { web3 } = this;
    
        try {
            const config = Config.localhost;
            this.flightSuretyApp = new web3.eth.Contract(
                FlightSuretyApp.abi,
                config.appAddress,
            );

            this.isOperational();
            this.watchContractEvents();
            this.setUpUserInteractions();
        } catch (error) {
          console.error("Could not connect to contract or chain.", error);
        }
    },

    setAccount: async function() {
        const { web3 } = this;
        const accounts = await web3.eth.getAccounts();
        this.account = accounts[0];
        console.log('set account to', this.account);
    },

    isOperational: function () {
        this.flightSuretyApp.methods
            .isOperational()
            .call({ from: this.account }, (error, result) => {
                console.log(error,result);
                this.display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
            });
    },

    watchContractEvents: function () {
        this.flightSuretyApp.events
            .AirLineRegistered({ fromBlock: 0 })
                .on('data', (event) => {
                    console.log('airline registered', event)
                    const {
                        airline,
                        _registered,
                        registeredCount
                    } = event.returnValues;
                    this.display('Airline', 'Airline Registered', [
                        {
                            label: 'New Airline',
                            error: null,
                            value: `${airline}, registered Airlines: ${registeredCount}`,
                        },
                    ]);
                })
                .on('error', (error) => {
                    console.log('airline not registered', error);
                    this.display('Error', 'Airline Register', [
                        {
                            label: 'Failed to Register',
                            error: null,
                                value: '',
                        },
                    ]);
                });
        
        this.flightSuretyApp.events
                .AirlineParticipated({ fromBlock: 0 })
                    .on('data', (event) => {
                        const {
                            airline, 
                            _funding, 
                            participatedCount
                        } = event.returnValues;
                        this.display('Airline', 'Airline Funded', [
                            {
                                label: 'New Airline',
                                error: null,
                                value: `${airline}, participated Airlines: ${participatedCount}`,
                            },
                        ]);
                    })
                    .on('error', (error) => {
                        console.log('airline fund failed', error);
                        this.display('Error', 'Airline Funding', [
                            {
                                label: 'Failed to fund airline',
                                error: null,
                                value: '',
                            },
                        ]);
                    });

        this.flightSuretyApp.events
            .FlightRegistered({ fromBlock: 0 })
                .on('data', (event) => {
                    const {
                        airline, 
                        name, 
                        departureTimestamp,
                        _statusCode,
                    } = event.returnValues;
                    let depatureTime = new Date(departureTimestamp * 1000);
                    this.display('Flight', 'Flight Registered', [
                        {
                            label: 'New Flight',
                            error: null,
                            value: `airline: ${airline}, Flight: ${name}, departure timestamp: ${departureTimestamp}, departure at: ${depatureTime}`,
                        },
                    ]);
                })
                .on('error', (error) => {
                    console.log('flight registering failed', error);
                    this.display('Error', 'Flight Register', [
                        {
                            label: 'Failed to register flight',
                            error: null,
                            value: '',
                        },
                    ]);
                });

        this.flightSuretyApp.events
            .InsuranceBought({ fromBlock: 0 })
                .on('data', (event) => {
                    const {
                        passenger, 
                        insuredAmount, 
                        compensationAmount,
                        airline,
                        name,
                        departureTimestamp,
                    } = event.returnValues;
                    let depatureTime = new Date(departureTimestamp * 1000);
                    const payment = Web3.utils.fromWei(insuredAmount, 'ether');
                    const compensation = Web3.utils.fromWei(compensationAmount, 'ether');
                    this.display('Insurance', 'Insurance Bought', [
                        {
                            label: 'Passenger bought Insurance',
                            error: null,
                            value: `Passenger: ${passenger}, Payment: ${payment} ether, Compensation: ${compensation} ether Airline: ${airline}, Flight: ${name}, departure timestamp: ${departureTimestamp}, departure at: ${depatureTime}`,
                        },
                    ]);
                })
                .on('error', (error) => {
                    console.log('buy insurance failed', error);
                    this.display('Error', 'Buy Insurance', [
                        {
                            label: 'Failed to buy insurance',
                            error: null,
                            value: '',
                        },
                    ]);
                });

        this.flightSuretyApp.events
            .FlightInsureesCredited({ fromBlock: 0 })
                .on('data', (event) => {
                    const {
                        airline,
                        name,
                        departureTimestamp,
                        _statusCode,
                    } = event.returnValues;
                    const isAlreadyReported = this.insureeCreditedFlights.find(element => {
                        return element.airline === airline && element.name === name && element.departureTimestamp === departureTimestamp; 
                    });
                    if (isAlreadyReported) {
                        return;
                    }
                    this.insureeCreditedFlights.push({
                        airline: airline,
                        name: name,
                        departureTimestamp: departureTimestamp,
                    })
                    let depatureTime = new Date(departureTimestamp * 1000);
                    this.display('Flight Status', 'Credit Insurees', [
                        {
                            label: 'Flight is late, insurees of this flight are credited, can withdraw their compensation',
                            error: null,
                            value: `Airline: ${airline}, Flight: ${name}, departure timestamp: ${departureTimestamp}, departure at: ${depatureTime}`,
                        },
                    ]);
                })
                .on('error', (error) => {
                    console.log('credit flight insurees failed', error);
                });

        this.flightSuretyApp.events
            .InsuranceWithdrawed({ fromBlock: 0 })
                .on('data', (event) => {
                    const {
                        _withdrawed,
                        insuranceAmount,
                        withdrawAmount,
                    } = event.returnValues;
                    const insuredBalance = Web3.utils.fromWei(insuranceAmount, 'ether');
                    const compensation = Web3.utils.fromWei(withdrawAmount, 'ether');
                    this.display('Insurance', 'Compensation Withdraw', [
                        {
                            label: 'Compensation Withdrawed',
                            error: null,
                            value: `Insured Balance: ${insuredBalance} ether, Compensation withdrawed: ${compensation} ether`,
                        },
                    ]);
                })
                .on('error', (error) => {
                    console.log('credit flight insurees failed', error);
                });             
    },

    setUpUserInteractions: function () {
        DOM.elid('register-airline').addEventListener('click', () => {
            let airline = DOM.elid('register-airline-address').value;

            this.flightSuretyApp.methods
                .registerAirline(airline)
                .send(
                    { 
                        from: this.account,
                        gas: this.gasFee,
                    }, 
                    (err, result) => {
                        console.log(err, result);
                    });
        });

        DOM.elid('fund-airline').addEventListener('click', () => {
            let airline = DOM.elid('fund-airline-address').value;
            let amount = DOM.elid('fund-amount').value;
            amount = Web3.utils.toWei(amount, 'ether');

            this.flightSuretyApp.methods
                .fundAirline(airline)
                .send(
                    { 
                        from: this.account,
                        value: amount,
                        gas: this.gasFee,
                    }, 
                    (err, result) => {
                        console.log(err, result);
                    });
        });

        DOM.elid('register-flight').addEventListener('click', () => {
            let flight = DOM.elid('register-flight-name').value;
            let departureTime = DOM.elid('register-flight-departure-timestamp').value;
            let departureTimeStamp = new Date(departureTime).getTime();
            
            this.flightSuretyApp.methods
                .registerFlight(
                    flight,
                    departureTimeStamp
                )
                .send(
                    { 
                        from: this.account,
                        gas: this.gasFee,
                    }, 
                    (err, result) => {
                        console.log(err, result);
                    });
        });

        DOM.elid('buy-insurance').addEventListener('click', () => {
            let airline = DOM.elid('buy-insurance-airline').value;
            let flight = DOM.elid('buy-insurance-flight-name').value;
            let departureTimeStamp = DOM.elid('buy-insurance-flight-departure-timestamp').value;
            let amount = DOM.elid('buy-insurance-amount').value;
            amount = Web3.utils.toWei(amount, 'ether');

            this.flightSuretyApp.methods
                .buyInsurance(
                    airline,
                    flight,
                    departureTimeStamp
                )
                .send(
                    { 
                        from: this.account,
                        value: amount,
                        gas: this.gasFee,
                    }, 
                    (err, result) => {
                        console.log(err, result);
                    });
        });

        DOM.elid('get-insruance-profile').addEventListener('click', () => {
            let airline = DOM.elid('insruance-profile-airline').value;
            let flight = DOM.elid('insruance-profile-flight-name').value;
            let departureTimeStamp = DOM.elid('insruance-profile-flight-departure-timestamp').value;
            
            this.flightSuretyApp.methods
                .getInsuranceProfile(
                    airline,
                    flight,
                    departureTimeStamp
                )
                .call({ from: this.account }, (err, result) => {
                    console.log(err, result);
                    const bought = result.bought ? '- Insurance Bought': '- Insurance not bought';
                    const credited = result.credited ? '- Insurance ready to withdraw': '- Insurance not ready to withdraw';
                    const withdrawed = result.withdrawed ? '- Compensation already withdrawed': '- Compensation can withdraw';
                    const balance = Web3.utils.fromWei(result.balance, 'ether');
                    const creditBalance = Web3.utils.fromWei(result.creditBalance, 'ether');
                    confirm(`Here's your Insurance Profile:\n ${bought}\n ${credited}\n ${withdrawed}\n - Paid: ${balance} ether\n - Compensation: ${creditBalance} ether\n`)
                });
        });

        DOM.elid('withdraw-compensation').addEventListener('click', () => {
            let airline = DOM.elid('withdraw-compensation-airline').value;
            let flight = DOM.elid('withdraw-compensation-flight-name').value;
            let departureTimeStamp = DOM.elid('withdraw-compensation-flight-departure-timestamp').value;
            
            this.flightSuretyApp.methods
                .withdrawInsurance(
                    airline,
                    flight,
                    departureTimeStamp
                )
                .send(
                    { 
                        from: this.account,
                        gas: this.gasFee,
                    }, 
                    (err, result) => {
                        console.log(err, result);
                    });
        });

        DOM.elid('fetch-flight-status').addEventListener('click', () => {
            let airline = DOM.elid('fetch-flight-status-airline').value;
            let flight = DOM.elid('flight-number').value;
            let departureTimeStamp = DOM.elid('fetch-flight-status-flight-departure-timestamp').value;
           
            this.flightSuretyApp.methods
                .fetchFlightStatus(
                    airline, 
                    flight, 
                    departureTimeStamp
                )
                .send(
                    { 
                        from: this.account,
                        gas: this.gasFee,
                    }, 
                    (err, result) => {
                        console.log(err, result);
                    });
        });
    },

    display: function (title, description, results) {
        let displayDiv = DOM.elid("display-wrapper");
        let section = DOM.section();
        section.appendChild(DOM.h2(title));
        section.appendChild(DOM.h5(description));
        results.map((result) => {
            let row = section.appendChild(DOM.div({className:'row'}));
            row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
            row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
            section.appendChild(row);
        })
        displayDiv.append(section);
    }
}

window.App = App;
window.addEventListener("load", function() {
    if (window.ethereum) {
      // use MetaMask's provider
      App.web3 = new Web3(window.ethereum);
      window.ethereum.enable(); // get permission to access accounts
      App.setAccount();
      window.ethereum.on('accountsChanged', (accounts) => {
        App.setAccount();
      });
    } else {
      console.warn(
        "No web3 detected. Falling back to http://127.0.0.1:8545. You should remove this fallback when you deploy live",
      );
      // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
      App.web3 = new Web3(
        new Web3.providers.HttpProvider("http://127.0.0.1:8545"),
      );
    }
  
    App.start();
  });





