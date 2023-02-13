pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    mapping(address => bool) authorizedAppContracts;

    struct Airline {
        bool registered;
        bool participated;
        uint256 funding;
        bool openForVote;
        uint256 votes;
        uint256 updatedAt;
        mapping(address => bool) voters;
    }

    mapping(address => Airline) private airlines;
    uint256 countRegisteredAirlines = 0;
    uint256 countParticipatedAirlines = 0;
    uint256 countVotingQueueAirlines = 0;

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 departure;        
        address airline;
        // mapping(address => bool) passengers;
        uint256 updatedAt;
    }

    mapping(bytes32 => Flight) private flights;

    struct InsuranceProfile {
        bool bought;
        bool credited;
        bool withdrawed;
        uint256 balance;
        uint256 creditBalance;
    }

    struct Insurance {
        mapping(bytes32 => InsuranceProfile) flightInsuranceProfiles;
        uint256 updatedAt;
    }
    
    mapping(address => Insurance) passengerInsuranceProfiles;

    mapping(bytes32 => address[]) flightInsuredPassengers;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
        (
            address airline
        ) 
        public 
    {
        contractOwner = msg.sender;

        // register first airline
        airlines[airline] = Airline({
            registered: true,
            participated: true,
            funding: 0,
            openForVote: false,
            votes: 0,
            updatedAt: now
        });
        countRegisteredAirlines = countRegisteredAirlines.add(1);
        countParticipatedAirlines = countParticipatedAirlines.add(1);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requiresAuthorizedContract() {
        require(isAuthorizedAppContract(msg.sender), "contract is not authrozied app contract");
        _;

    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireContractOwner 
    {
        operational = mode;
    }

    function authorizeAppContract(address appContract) 
        public
        requireContractOwner
        requireIsOperational
    {
        authorizedAppContracts[appContract] = true;
    }

    function isAuthorizedAppContract(address appContract)
        public
        view
        returns (bool)
    {
        return authorizedAppContracts[appContract];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/
    
    function requireConsensus() 
        view
        external
        requireIsOperational
        requiresAuthorizedContract
        returns (bool)
    {
        return countRegisteredAirlines >= 4;
    }

    function isAirlineRegistered(address airline)
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns (bool result)
    {
        result = airlines[airline].registered;
    }

    function isAirlineOpenForVote(address airline)
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns (bool result)
    {
        result = airlines[airline].openForVote;
    }

    function isAirlineParticipated(address airline)
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns (bool result)
    {
        result = airlines[airline].participated;
    }

    function setAirlineState
        (
            address airline,
            bool registered,
            bool participated,
            uint256 funding,
            bool openForVote,
            uint256 votes
        )
        external
        requireIsOperational
        requiresAuthorizedContract
    {
        airlines[airline] = Airline({
            registered: registered,
            participated: participated,
            funding: funding,
            openForVote: openForVote,
            votes: votes,
            updatedAt: now
        });
    }

    function getAirlineState(address airline)
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns 
        (
            bool registered,
            bool participated,
            uint256 funding,
            bool openForVote,
            uint256 votes
        )
    {
        registered = airlines[airline].registered;
        participated = airlines[airline].participated;
        funding = airlines[airline].funding;
        openForVote = airlines[airline].openForVote;
        votes = airlines[airline].votes;
    }

    function incrementCountRegisteredAirlines() 
        external
        requireIsOperational
        requiresAuthorizedContract
        returns (uint256)
    {
        countRegisteredAirlines = countRegisteredAirlines.add(1);
        return countRegisteredAirlines;
    }

    function incrementCountVotingQueueAirlines() 
        external
        requireIsOperational
        requiresAuthorizedContract
        returns (uint256)
    {
        countVotingQueueAirlines = countVotingQueueAirlines.add(1);
        return countVotingQueueAirlines;
    }

    function isAlreadyVotedAirline(address airline, address from)
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns (bool result)
    {
        result = airlines[airline].voters[from];
    }
    
    function setAirlineVoter
        (
            address airline, 
            address from, 
            bool flag
        ) 
        external
        requireIsOperational
        requiresAuthorizedContract
    {
        airlines[airline].voters[from] = flag;
    }

    function incrementAirlineVotes(address airline)
        external
        requireIsOperational
        requiresAuthorizedContract
        returns (uint256)
    {
        airlines[airline].votes = airlines[airline].votes.add(1);
        return airlines[airline].votes;
    }

    function getCountParticipatedAirlines()
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns (uint256 result)
    {
        result = countParticipatedAirlines;
    }

    function getCountVotingQueueAirlines()
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns (uint256 result)
    {
        result = countVotingQueueAirlines;
    }

    function decrementCountVotingQueueAirlines() 
        external
        requireIsOperational
        requiresAuthorizedContract
        returns (uint256)
    {
        countVotingQueueAirlines = countVotingQueueAirlines.sub(1);
        return countVotingQueueAirlines;
    }

    function fund
        (
            address airline
        )
        external
        payable
        requireIsOperational
        requiresAuthorizedContract
        returns
        (
            uint256 funding,
            uint256 participatedCount
        )
    {
        airlines[airline].funding = msg.value;
        airlines[airline].participated = true;
        countParticipatedAirlines = countParticipatedAirlines.add(1);
        
        funding = airlines[airline].funding;
        participatedCount = countParticipatedAirlines;
    }

    function isFlightRegistered (bytes32 key)
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns (bool)
    {
        return flights[key].isRegistered;
    }

    function setFlightState
        (
            bytes32 key,
            bool isRegistered,
            uint8 statusCode,
            uint256 departureTimestamp,
            address airline
        ) 
        external
        requireIsOperational
        requiresAuthorizedContract
    {
        flights[key] = Flight({
            isRegistered: isRegistered,
            statusCode: statusCode,
            departure: departureTimestamp,
            airline: airline,
            updatedAt: now
        });
    }

    function getFlightState(bytes32 key) 
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns
        (
            bool isRegistered,
            uint8 statusCode,
            uint256 departure,        
            address airline
        )
    {
        isRegistered = flights[key].isRegistered;
        statusCode = flights[key].statusCode;
        departure = flights[key].departure;
        airline = flights[key].airline;
    }

    function isInsuranceBought
        (
            bytes32 key,
            address passenger
        )
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns (bool)
    {
        return passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].bought;
    }

   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buyInsurance
        (
            bytes32 key,
            address passenger                       
        )
        external
        payable
        requireIsOperational
        requiresAuthorizedContract
        returns 
        (
            uint256 insuredAmount,
            uint256 compensationAmount
        )
    {
        passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].bought = true;
        passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].balance = msg.value;
        passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].creditBalance = msg.value.mul(3).div(2);
        passengerInsuranceProfiles[passenger].updatedAt = now;

        insuredAmount = passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].balance;
        compensationAmount = passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].creditBalance;

        flightInsuredPassengers[key].push(passenger);
    }

    function getInsuranceProfile
        (
            bytes32 key,
            address passenger
        )
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns
        (
            bool bought,
            bool credited,
            bool withdrawed,
            uint256 balance,
            uint256 creditBalance
        )
    {
        bought = passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].bought;
        credited = passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].credited;
        withdrawed = passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].withdrawed;
        balance = passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].balance;
        creditBalance = passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].creditBalance;
    }

    function updateFlightStatusCode
        (
            bytes32 key,
            uint8 statusCode
        )
        external
        requireIsOperational
        requiresAuthorizedContract
    {
        flights[key].statusCode = statusCode;
    }

    function creditPassengerCompensation
        (
            bytes32 key,
            address passenger
        )
        internal
        requireIsOperational
    {
        require(passenger != address(0), "invalid passenger address");
        passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].credited = true;
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
        (
            bytes32 key
        )
        external
        requireIsOperational
        requiresAuthorizedContract
    {
        for (uint256 index = 0; index < flightInsuredPassengers[key].length; index++) {
            creditPassengerCompensation(key, flightInsuredPassengers[key][index]);
        }
    }
    
    function isPassengerCompensationWithdrawed
        (
            bytes32 key,
            address passenger
        )
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns (bool)
    {
        return passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].withdrawed;
    }

    function isPassengerInsuranceCredited
        (
            bytes32 key,
            address passenger
        )
        external
        view
        requireIsOperational
        requiresAuthorizedContract
        returns (bool)
    {
        return passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].credited;
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function withdrawInsurance
        (
            bytes32 key,
            address passenger
        )
        external
        returns
        (
            bool withdrawed,
            uint256 insuranceAmount,
            uint256 withdrawAmount
        )
    {
        passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].withdrawed = true;
        
        insuranceAmount = passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].balance;
        passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].balance = 0;
        
        withdrawAmount = passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].creditBalance;
        passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].creditBalance = 0;

        passenger.transfer(withdrawAmount);

        withdrawed = passengerInsuranceProfiles[passenger].flightInsuranceProfiles[key].withdrawed;
    }
}

