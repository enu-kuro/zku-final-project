//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./verifier.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IHasher {
    function poseidon(uint256[5] calldata inputs)
        external
        pure
        returns (uint256);
}

contract HitAndBlow is Verifier, Ownable {
    string private greeting;
    uint8 public constant MAX_ROUND = 50;
    // TODO: 1始まりにした方が良い？solidityで0はnullと同じ扱いなので。
    uint8 public currentRound = 1;
    address[2] public players;
    address public winner;
    mapping(address => uint256) public solutionHashes;

    enum Stages {
        StageZero,
        StageOne,
        StageTwo,
        StageThree,
        StageFour,
        StageFive
    }
    Stages public stage = Stages.StageZero;

    modifier atStage(Stages _stage) {
        require(stage == _stage, "not allowed! ");
        _;
    }

    struct Guess {
        uint8 one;
        uint8 two;
        uint8 three;
        uint8 four;
        bool submitted;
    }

    struct HB {
        uint8 hit;
        uint8 blow;
        bool submitted;
    }

    mapping(address => Guess)[MAX_ROUND] public submittedGuess;
    mapping(address => HB)[MAX_ROUND] public submittedHB;

    event SubmitGuess(
        address indexed player,
        uint8 currentRound,
        uint8 a,
        uint8 b,
        uint8 c,
        uint8 d
    );
    event SubmitHB(
        address indexed player,
        uint8 currentRound,
        uint8 hit,
        uint8 blow
    );

    event StageChange(Stages stage);
    event Register(address indexed player);
    event CommitSolutionHash(address indexed player, uint256 solutionHash);

    event Reveal(address indexed player, uint8 a, uint8 b, uint8 c, uint8 d);
    event GameFinish();
    event Initialize();
    IHasher public hasher;

    constructor(IHasher _hasher) {
        console.log("Deploying a HitAndBlow!");
        hasher = _hasher;
    }

    // for debug everyone can initialize states
    // function initialize() public onlyOwner {
    function initialize() public {
        initGameState();
    }

    function initGameState() private {
        stage = Stages.StageZero;
        currentRound = 1;
        // looking for better way...
        for (uint8 i = 0; i < MAX_ROUND; i++) {
            delete submittedGuess[i][players[0]];
            delete submittedGuess[i][players[1]];
            delete submittedHB[i][players[0]];
            delete submittedHB[i][players[1]];
        }
        solutionHashes[players[0]] = 0;
        solutionHashes[players[1]] = 0;
        players[0] = address(0);
        players[1] = address(0);
        winner = address(0);
        emit Initialize();
    }

    function getplayers() public view returns (address[2] memory) {
        return players;
    }

    function getSubmittedGuess(address player)
        public
        view
        returns (Guess[] memory)
    {
        console.log("getSubmittedGuess!");
        Guess[] memory guessArray = new Guess[](currentRound);

        for (uint8 i = 0; i < currentRound; i++) {
            guessArray[i] = submittedGuess[i][player];
        }
        return guessArray;
    }

    function getSubmittedHB(address player) public view returns (HB[] memory) {
        HB[] memory hbArray = new HB[](currentRound);

        for (uint8 i = 0; i < currentRound; i++) {
            hbArray[i] = submittedHB[i][player];
        }
        return hbArray;
    }

    function getOpponentAddr() private view returns (address) {
        if (players[0] == msg.sender) {
            return players[1];
        } else {
            return players[0];
        }
    }

    function register() public atStage(Stages.StageZero) {
        if (players[0] == address(0)) {
            players[0] = msg.sender;
            emit Register(msg.sender);
        } else {
            require(players[0] != msg.sender, "already registerd!");
            players[1] = msg.sender;
            stage = Stages.StageOne;
            emit Register(msg.sender);
            emit StageChange(Stages.StageOne);
        }
    }

    // TODO: 数値の重複防ぐにはどうする？
    function commitSolutionHash(uint256 solutionHash)
        public
        atStage(Stages.StageOne)
    {
        solutionHashes[msg.sender] = solutionHash;
        emit CommitSolutionHash(msg.sender, solutionHash);

        // 0で比較すると本当に0のときに困る...
        if (solutionHashes[getOpponentAddr()] != 0) {
            stage = Stages.StageTwo;
            emit StageChange(Stages.StageTwo);
        }
    }

    function submitGuess(
        uint8 guess1,
        uint8 guess2,
        uint8 guess3,
        uint8 guess4
    ) public atStage(Stages.StageTwo) {
        require(
            submittedGuess[currentRound - 1][msg.sender].submitted == false,
            "already submitted!"
        );

        Guess memory guess = Guess(guess1, guess2, guess3, guess4, true);
        submittedGuess[currentRound - 1][msg.sender] = guess;

        emit SubmitGuess(
            msg.sender,
            currentRound,
            guess1,
            guess2,
            guess3,
            guess4
        );
    }

    // TODO: how to handle draw?
    function submitHbProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[8] memory input
    ) public atStage(Stages.StageTwo) {
        require(verifyProof(a, b, c, input), "verification error");
        uint8 hit = uint8(input[5]);
        uint8 blow = uint8(input[6]);
        HB memory hb = HB(hit, blow, true);
        submittedHB[currentRound - 1][msg.sender] = hb;

        if (hit == 4) {
            winner = getOpponentAddr();
            stage = Stages.StageThree;
            emit StageChange(Stages.StageThree);
            return;
        }

        address opponentAddr = getOpponentAddr();
        if (submittedHB[currentRound - 1][opponentAddr].submitted == true) {
            currentRound++;
        }

        emit SubmitHB(msg.sender, currentRound, hit, blow);
    }

    function reveal(
        uint256 salt,
        uint8 a,
        uint8 b,
        uint8 c,
        uint8 d
    ) public atStage(Stages.StageThree) {
        // Check the hash to ensure the solution is correct
        require(
            hasher.poseidon([salt, a, b, c, d]) == solutionHashes[msg.sender],
            "invalid hash"
        );

        emit Reveal(msg.sender, a, b, c, d);

        // 勝った方だけrevealすればok。
        if (msg.sender == winner) {
            initGameState();
            console.log("GameFinish");
            emit GameFinish();
        }
    }
}
