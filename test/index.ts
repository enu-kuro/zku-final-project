import { ethers } from "hardhat";
import { expect } from "chai";
import { HitAndBlow } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { FourNumbers, ProofInput } from "./types";
import { calculateHB, deploy, deployPoseidon, generateProof } from "./utils";
const buildPoseidon = require("circomlibjs").buildPoseidon;

describe("Hit and Blow!", function () {
  let hitAndBlow: HitAndBlow;
  let poseidonJs: any;

  let owner: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;

  before(async () => {
    [owner, player1, player2] = await ethers.getSigners();
    const poseidonContract = await deployPoseidon(owner);
    hitAndBlow = (await deploy(
      "HitAndBlow",
      poseidonContract.address
    )) as HitAndBlow;
    poseidonJs = await buildPoseidon();
  });

  it("fetch", async function () {
    const submittedGuess = await hitAndBlow
      .connect(player1)
      .getSubmittedGuess(player1.address);
    expect(submittedGuess[0].submitted).to.equal(false);
    const submittedHB = await hitAndBlow
      .connect(player1)
      .getSubmittedHB(player1.address);
    expect(submittedHB[0].submitted).to.equal(false);
  });

  it("play game!", async function () {
    // register
    await hitAndBlow.connect(player1).register();
    expect(await hitAndBlow.connect(player2).register())
      .to.emit(hitAndBlow, "StageChange")
      .withArgs(1);

    // Player1 Solution & SolutionHash
    const solution1: FourNumbers = [4, 5, 6, 7];
    const salt1 = ethers.BigNumber.from(ethers.utils.randomBytes(32));
    const solutionHash1 = ethers.BigNumber.from(
      poseidonJs.F.toObject(poseidonJs([salt1, ...solution1]))
    );

    // Player2 Solution & SolutionHash
    const solution2: FourNumbers = [6, 1, 3, 9];
    const salt2 = ethers.BigNumber.from(ethers.utils.randomBytes(32));
    const solutionHash2 = ethers.BigNumber.from(
      poseidonJs.F.toObject(poseidonJs([salt2, ...solution2]))
    );

    // Commit SolutionHash
    await hitAndBlow.connect(player1).commitSolutionHash(solutionHash1);
    await expect(hitAndBlow.connect(player2).commitSolutionHash(solutionHash2))
      .to.emit(hitAndBlow, "StageChange")
      .withArgs(2);

    // Player1 submits guess
    const guess1: FourNumbers = [1, 2, 3, 9];
    await expect(hitAndBlow.connect(player1).submitGuess(...guess1))
      .to.emit(hitAndBlow, "SubmitGuess")
      .withArgs(player1.address, 1, ...guess1);

    /*
      Player2 receives Player1's guess and submits num of hit & blow with zk proof.
    */

    // Player1 guesses Player2 Solution is [1, 2, 3, 9].
    // It's actually [6, 1, 3, 9] so 2 hits 1 blow.
    const [hit2, blow2] = calculateHB(guess1, solution2);

    const proofInput2: ProofInput = {
      pubGuessA: guess1[0],
      pubGuessB: guess1[1],
      pubGuessC: guess1[2],
      pubGuessD: guess1[3],
      pubNumHit: hit2,
      pubNumBlow: blow2,
      pubSolnHash: solutionHash2,
      privSolnA: solution2[0],
      privSolnB: solution2[1],
      privSolnC: solution2[2],
      privSolnD: solution2[3],
      privSalt: salt2,
    };

    // Generate proof at local
    const proof2 = await generateProof(proofInput2);
    // Submit proof and verify proof in SmartContract.
    await hitAndBlow.connect(player2).submitHbProof(...proof2);

    // Player2 submits guess
    const guess2: FourNumbers = [1, 2, 3, 4];
    await hitAndBlow.connect(player2).submitGuess(...guess2);

    /*
      Player1 receives Player2's guess and submits num of hit & blow with zk proof.
    */

    // 0 hit 1 blow (Solution: [4, 5, 6, 7], Guess: [1, 2, 3, 4])
    const [hit1, blow1] = calculateHB(guess2, solution1);

    const proofInput1: ProofInput = {
      pubGuessA: guess2[0],
      pubGuessB: guess2[1],
      pubGuessC: guess2[2],
      pubGuessD: guess2[3],
      pubNumHit: hit1,
      pubNumBlow: blow1,
      pubSolnHash: solutionHash1,
      privSolnA: solution1[0],
      privSolnB: solution1[1],
      privSolnC: solution1[2],
      privSolnD: solution1[3],
      privSalt: salt1,
    };

    const proof1 = await generateProof(proofInput1);
    await expect(hitAndBlow.connect(player1).submitHbProof(...proof1))
      .to.emit(hitAndBlow, "SubmitHB")
      .withArgs(player1.address, 2, ...[hit1, blow1]);

    // Player1 submits correct guess.
    const allHitGuess = solution2;
    await hitAndBlow.connect(player1).submitGuess(...allHitGuess);

    /*
      Player2 receives Player1's 4 hits guess and submits result with zk proof.
    */
    // It must be 4 hits and 0 blow.
    const [hit4, blow0] = calculateHB(allHitGuess, solution2);

    const proofInputHitAll: ProofInput = {
      pubGuessA: solution2[0],
      pubGuessB: solution2[1],
      pubGuessC: solution2[2],
      pubGuessD: solution2[3],
      pubNumHit: hit4,
      pubNumBlow: blow0,
      pubSolnHash: solutionHash2,
      privSolnA: solution2[0],
      privSolnB: solution2[1],
      privSolnC: solution2[2],
      privSolnD: solution2[3],
      privSalt: salt2,
    };

    // Player1 Win! (leave drawn game out of consideration...)
    const proofHitAll = await generateProof(proofInputHitAll);
    expect(await hitAndBlow.connect(player2).submitHbProof(...proofHitAll))
      .to.emit(hitAndBlow, "StageChange")
      .withArgs(3);

    // Lastly winner reveals its solution.
    expect(await hitAndBlow.connect(player1).reveal(salt1, ...solution1))
      .to.emit(hitAndBlow, "Reveal")
      .withArgs(player1.address, ...solution1)
      .to.emit(hitAndBlow, "GameFinish")
      .withArgs();

    // Initialize
    expect(await hitAndBlow.stage()).to.equal(0);
    expect(
      (await hitAndBlow.submittedGuess(0, player1.address)).submitted
    ).to.equal(false);
    expect(
      (await hitAndBlow.submittedHB(0, player2.address)).submitted
    ).to.equal(false);
  });
});
