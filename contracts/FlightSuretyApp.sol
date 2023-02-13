pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract

    FlightSuretyData flightSuretyData;

    // events
    event AirLineRegistered(
        address airline,
        bool isRegistered,
        uint256 registeredCount
    );
    
    event AirlineAddedToVote(
        address airline,
        uint256 votingQueueCount
    );
    
    event AirlineVotedAndRegistered(
        address airline, 
        uint256 votes, 
        uint256 registeredCount, 
        uint256 votingQueueCount
    );
    
    event AirlineVoted(
        address airline,
        uint256 votes,
        uint256 votingQueueCount
    );

    event AirlineParticipated(
        address airline,
        uint256 funding,
        uint256 participatedCount
    );

    event FlightRegistered(
        address airline,
        string name,
        uint256 departureTimestamp,
        uint8 statusCode
    );

    event FlightChosen(
        string name, 
        uint256 departureTimestamp, 
        address airline, 
        address passenger
    );

    event InsuranceBought(
        address passenger, 
        uint256 insuredAmount, 
        uint256 compensationAmount, 
        address airline,
        string name,
        uint256 departureTimestamp
    );

    event FlightInsureesCredited(
        address airline,
        string name,
        uint256 departureTimestamp,
        uint8 statusCode
    );

    event FlightStatusUpdated(
        address airline,
        string name,
        uint256 departureTimestamp,
        uint8 statusCode
    );

    event InsuranceWithdrawed(
        bool withdrawed, 
        uint256 insuranceAmount, 
        uint256 withdrawAmount
    );
 
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
         // Modify to call data contract's status
        require(true, "Contract is currently not operational");  
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

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor
                                (
                                    address dataContract
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() 
                            public 
                            pure 
                            returns(bool) 
    {
        return true;  // Modify to call data contract's status
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    function getAirlineInfo(address airline)
        public
        view
        requireIsOperational
        returns 
        (
            bool registered,
            bool participated,
            uint256 funding,
            bool openForVote,
            uint256 votes
        )
    {
        (
            registered,
            participated,
            funding,
            openForVote,
            votes
        ) = flightSuretyData.getAirlineState(airline);
    }
  
   /**
    * @dev Add an airline to the registration queue
    *
    */   
    function registerAirline
                            (   
                                address airline
                            )
                            public
                            requireIsOperational
    {
        require(airline != address(0), "invalid airline address");
        require(!flightSuretyData.isAirlineRegistered(airline), "airline already registered");
        require(!flightSuretyData.isAirlineOpenForVote(airline), "airline is already registered and open for vote");
        require(flightSuretyData.isAirlineParticipated(msg.sender), "only participated airline can register new airline");

        bool registered = false;
        bool participated = false;
        uint256 funding = 0;
        bool openForVote = false;
        uint256 votes = 0;

        bool needConsensus = flightSuretyData.requireConsensus();

        if (!needConsensus) {
            registered = true;
            flightSuretyData.setAirlineState(
                airline, 
                registered, 
                participated, 
                funding, 
                openForVote, 
                votes
            );
            uint256 registeredCount = flightSuretyData.incrementCountRegisteredAirlines();
            
            emit AirLineRegistered(airline, registered, registeredCount);
        } else {
            openForVote = true;
            flightSuretyData.setAirlineState(
                airline, 
                registered, 
                participated, 
                funding, 
                openForVote, 
                votes
            );
            uint256 votingQueueCount = flightSuretyData.incrementCountVotingQueueAirlines();
            emit AirlineAddedToVote(airline, votingQueueCount);
        }
    }

    function voteAirline(address airline)
        public
        requireIsOperational
    {
        require(airline != address(0), "invalid airline address");
        require(flightSuretyData.isAirlineParticipated(msg.sender), "only participated airline can vote an airline");
        require(flightSuretyData.isAirlineOpenForVote(airline), "airline is not open for vote");
        require(!flightSuretyData.isAlreadyVotedAirline(airline, msg.sender), "already voted for this ariline");
        
        flightSuretyData.setAirlineVoter(airline, msg.sender, true);
        uint256 votesVoted = flightSuretyData.incrementAirlineVotes(airline);

        uint256 votingQueueCount = flightSuretyData.getCountVotingQueueAirlines();
        
        bool over50PercentVotes = votesVoted > flightSuretyData.getCountParticipatedAirlines().div(2);
        if (over50PercentVotes) {
            (
                bool registered,
                bool participated,
                uint256 funding,
                bool openForVote,
                uint256 votes
            ) = flightSuretyData.getAirlineState(airline);

            openForVote = false;
            registered = true;

            flightSuretyData.setAirlineState(
                airline, 
                registered, 
                participated, 
                funding, 
                openForVote, 
                votes
            );

            uint256 registeredCount = flightSuretyData.incrementCountRegisteredAirlines();
            votingQueueCount = flightSuretyData.decrementCountVotingQueueAirlines();

            emit AirlineVotedAndRegistered(airline, votes, registeredCount, votingQueueCount);
        } else {
            emit AirlineVoted(airline, votesVoted, votingQueueCount);
        }
    }

    function fundAirline(address airline) 
        public
        payable
        requireIsOperational
    {
        require(!flightSuretyData.isAirlineParticipated(airline), "airline is already participated");
        require(msg.sender == airline, "airline can only fund itself");
        require(msg.value >= 10 ether, "need 10 ether to fund");

        (
            uint256 funding,
            uint256 participatedCount
        ) = flightSuretyData.fund.value(msg.value)(airline);

        emit AirlineParticipated(airline, funding, participatedCount);
    }


   /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight
        (
            string name,
            uint256 departureTimestamp
        )
        public
        requireIsOperational
    {
        require(flightSuretyData.isAirlineParticipated(msg.sender), "only participated airline can register flight");
        bytes32 key = getFlightKey(msg.sender, name, departureTimestamp);
        require(!flightSuretyData.isFlightRegistered(key), "flight already registered");

        flightSuretyData.setFlightState(
            key,
            true,
            STATUS_CODE_UNKNOWN,
            departureTimestamp,
            msg.sender
        );

        emit FlightRegistered(msg.sender, name, departureTimestamp, STATUS_CODE_UNKNOWN);
    }

    function buyInsurance 
        (
            address airline,
            string name,
            uint256 departureTimestamp
        )
        public
        payable
        requireIsOperational
    {
        require(msg.value <= 1 ether && msg.value > 0, "passenger can only purchase insurance upto 1 ether");
        bytes32 key = getFlightKey(airline, name, departureTimestamp);
        // require(flightSuretyData.getFlightPassengerTicket(key, msg.sender), "ticket is not purchased by passenger, cannot purchase insurance");
        require(!flightSuretyData.isInsuranceBought(key, msg.sender), "flight's insruance already bought by this passenger");

        (
            uint256 insuredAmount,
            uint256 compensationAmount
        ) = flightSuretyData.buyInsurance.value(msg.value)(key, msg.sender);
    
        emit InsuranceBought(
            msg.sender, 
            insuredAmount, 
            compensationAmount, 
            airline,
            name,
            departureTimestamp
        );
    }

    function getInsuranceProfile
        (
            address airline,
            string name,
            uint256 departureTimestamp
        )
        public
        view
        requireIsOperational
        returns
        (
            bool bought,
            bool credited,
            bool withdrawed,
            uint256 balance,
            uint256 creditBalance
        )
    {
        bytes32 key = getFlightKey(airline, name, departureTimestamp);
        require(flightSuretyData.isInsuranceBought(key, msg.sender), "flight's insruance not bought by this passenger");
        (
            bought,
            credited,
            withdrawed,
            balance,
            creditBalance
        ) = flightSuretyData.getInsuranceProfile(key, msg.sender);
    }

   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus
        (
            address airline,
            string memory flight,
            uint256 timestamp,
            uint8 statusCode
        )
        internal
        requireIsOperational
    {
        bytes32 key = getFlightKey(airline, flight, timestamp);
        flightSuretyData.updateFlightStatusCode(key, statusCode);

        if (statusCode == STATUS_CODE_LATE_AIRLINE) {
            flightSuretyData.creditInsurees(key);
            emit FlightInsureesCredited(airline, flight, timestamp, statusCode);
        } else {
            emit FlightStatusUpdated(airline, flight, timestamp, statusCode);
        }
    }

    function withdrawInsurance
        (
            address airline,
            string name,
            uint256 departureTimestamp
        ) 
        public
        requireIsOperational
    {
        bytes32 key = getFlightKey(airline, name, departureTimestamp);
        require(flightSuretyData.isInsuranceBought(key, msg.sender), "passenger did not buy this flight's insurance");
        require(!flightSuretyData.isPassengerCompensationWithdrawed(key, msg.sender), "passenger's insurance already withdrawed");
        require(flightSuretyData.isPassengerInsuranceCredited(key, msg.sender), "passenger's insurance is not credited for this flight");

        (
            bool withdrawed,
            uint256 insuranceAmount,
            uint256 withdrawAmount
        ) = flightSuretyData.withdrawInsurance(key, msg.sender);

        emit InsuranceWithdrawed(withdrawed, insuranceAmount, withdrawAmount);
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus
                        (
                            address airline,
                            string flight,
                            uint256 timestamp                            
                        )
                        external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    } 


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3])
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (                       
                                address account         
                            )
                            internal
                            returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   
