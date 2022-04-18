//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./verifier.sol";

interface IHasher {
    function poseidon(uint256[5] calldata inputs)
        external
        pure
        returns (uint256);
}

contract HitAndBlow is Verifier {
    string private greeting;
    uint8 public constant MAX_ROUND = 50;
    uint8 public currentRound = 0;
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
    // mapping(address => bool) public isHbSubmitted;

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

    event StageChanged(Stages stage);
    event Reveal(address indexed player, uint8 a, uint8 b, uint8 c, uint8 d);
    event GameFinish();
    IHasher public hasher;

    constructor(IHasher _hasher) {
        console.log("Deploying a HitAndBlow!");
        hasher = _hasher;
    }

    function initGameState() private {
        stage = Stages.StageZero;
        currentRound = 0;
        delete submittedGuess;
        delete submittedHB;
        players[0] = address(0);
        players[1] = address(0);
        winner = address(0);
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
        } else {
            players[1] = msg.sender;
            stage = Stages.StageOne;
            emit StageChanged(Stages.StageOne);
        }
    }

    function commitSolutionHash(uint256 solutionHash)
        public
        atStage(Stages.StageOne)
    {
        solutionHashes[msg.sender] = solutionHash;
        // 0で比較すると本当に0のときに困る...
        if (solutionHashes[getOpponentAddr()] != 0) {
            stage = Stages.StageTwo;
            emit StageChanged(Stages.StageTwo);
        }
    }

    function submitGuess(
        uint8 guess1,
        uint8 guess2,
        uint8 guess3,
        uint8 guess4
    ) public atStage(Stages.StageTwo) {
        require(
            submittedGuess[currentRound][msg.sender].submitted == false,
            "already submitted!"
        );

        Guess memory guess = Guess(guess1, guess2, guess3, guess4, true);
        submittedGuess[currentRound][msg.sender] = guess;

        emit SubmitGuess(
            msg.sender,
            currentRound,
            guess1,
            guess2,
            guess3,
            guess4
        );
    }

    function submitHbProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[8] memory input
    ) public atStage(Stages.StageTwo) {
        require(verifyProof(a, b, c, input), "verification error");
        uint8 hit = uint8(input[5]);
        uint8 blow = uint8(input[6]);
        if (hit == 4) {
            winner = getOpponentAddr();
            stage = Stages.StageThree;
            emit StageChanged(Stages.StageThree);
            return;
        }

        HB memory hb = HB(hit, blow, true);
        submittedHB[currentRound][msg.sender] = hb;
        address opponentAddr = getOpponentAddr();
        uint8 _currentRound = currentRound;
        if (submittedHB[currentRound][opponentAddr].submitted == true) {
            currentRound++;
        }

        emit SubmitHB(msg.sender, _currentRound, hit, blow);
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
