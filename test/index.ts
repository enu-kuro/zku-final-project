import { ethers } from "hardhat";
import { expect } from "chai";
import { HitAndBlow } from "../typechain";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const buildPoseidon = require("circomlibjs").buildPoseidon;
const { poseidonContract } = require("circomlibjs");

const snarkjs = require("snarkjs");

type ProofInput = {
  pubGuessA: number;
  pubGuessB: number;
  pubGuessC: number;
  pubGuessD: number;
  pubNumHit: number;
  pubNumBlow: number;
  pubSolnHash: BigNumber;
  privSolnA: number;
  privSolnB: number;
  privSolnC: number;
  privSolnD: number;
  privSalt: BigNumber;
};

type SolidityProof = {
  a: [BigNumber, BigNumber];
  b: [[BigNumber, BigNumber], [BigNumber, BigNumber]];
  c: [BigNumber, BigNumber];
  input: [
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
  ];
};
type ZeroToNine = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type FourNumbers = [ZeroToNine, ZeroToNine, ZeroToNine, ZeroToNine];

// @ts-ignore
function buildSolidityProof(snarkProof, publicSignals) {
  return {
    a: snarkProof.pi_a.slice(0, 2),
    b: [
      snarkProof.pi_b[0].slice(0).reverse(),
      snarkProof.pi_b[1].slice(0).reverse(),
    ],
    c: snarkProof.pi_c.slice(0, 2),
    input: publicSignals,
  } as SolidityProof;
}

function calculateHB(guess: FourNumbers, solution: FourNumbers) {
  const hit = solution.filter((sol, i) => {
    return sol === guess[i];
  }).length;

  const blow = solution.filter((sol, i) => {
    return sol !== guess[i] && guess.some((g) => g === sol);
  }).length;

  return [hit, blow];
}

async function generateProof(inputs: ProofInput) {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    "circuits/HitAndBlow_js/HitAndBlow.wasm",
    "circuits/HitAndBlow_0001.zkey"
  );

  const solidityProof = await buildSolidityProof(proof, publicSignals);

  return [
    solidityProof.a,
    solidityProof.b,
    solidityProof.c,
    solidityProof.input,
  ] as const;
}

async function deploy(contractName: string, ...args: any[]) {
  const Factory = await ethers.getContractFactory(contractName);
  const instance = await Factory.deploy(...args);
  return instance.deployed();
}

async function deployPoseidon(signer: SignerWithAddress) {
  const Factory = new ethers.ContractFactory(
    poseidonContract.generateABI(5),
    poseidonContract.createCode(5),
    signer
  );
  const instance = await Factory.deploy();
  return instance.deployed();
}

describe("Hit and Blow!", function () {
  let hitAndBlow: HitAndBlow;
  // TODO: type
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

  it("play game!", async function () {
    // const [owner, player1, player2] = await ethers.getSigners();
    await hitAndBlow.connect(player1).register();
    expect(await hitAndBlow.connect(player2).register())
      .to.emit(hitAndBlow, "StageChange")
      .withArgs(1);

    const solution1: FourNumbers = [4, 5, 6, 7];
    const salt1 = ethers.BigNumber.from(ethers.utils.randomBytes(32));

    const solutionHash1 = ethers.BigNumber.from(
      poseidonJs.F.toObject(poseidonJs([salt1, ...solution1]))
    );

    const solution2: FourNumbers = [6, 1, 3, 9];
    const salt2 = ethers.BigNumber.from(ethers.utils.randomBytes(32));
    const solutionHash2 = ethers.BigNumber.from(
      poseidonJs.F.toObject(poseidonJs([salt2, ...solution2]))
    );

    await hitAndBlow.connect(player1).commitSolutionHash(solutionHash1);
    await expect(hitAndBlow.connect(player2).commitSolutionHash(solutionHash2))
      .to.emit(hitAndBlow, "StageChange")
      .withArgs(2);

    const guess1: FourNumbers = [1, 2, 3, 9];
    await expect(hitAndBlow.connect(player1).submitGuess(...guess1))
      .to.emit(hitAndBlow, "SubmitGuess")
      .withArgs(player1.address, 0, ...guess1);

    const guess2: FourNumbers = [1, 2, 3, 4];
    await hitAndBlow.connect(player2).submitGuess(...guess2);

    const [hit, blow] = calculateHB(guess1, solution2);

    const proofInput2: ProofInput = {
      pubGuessA: guess1[0],
      pubGuessB: guess1[1],
      pubGuessC: guess1[2],
      pubGuessD: guess1[3],
      pubNumHit: hit,
      pubNumBlow: blow,
      pubSolnHash: solutionHash2,
      privSolnA: solution2[0],
      privSolnB: solution2[1],
      privSolnC: solution2[2],
      privSolnD: solution2[3],
      privSalt: salt2,
    };

    const proof2 = await generateProof(proofInput2);
    await hitAndBlow.connect(player2).submitHbProof(...proof2);

    // TOOD: proof for player1
    await expect(hitAndBlow.connect(player1).submitHbProof(...proof2))
      .to.emit(hitAndBlow, "SubmitHB")
      .withArgs(player1.address, 0, ...[hit, blow]);

    await hitAndBlow.connect(player1).submitGuess(...solution2);

    const proofInputHitAll: ProofInput = {
      pubGuessA: solution2[0],
      pubGuessB: solution2[1],
      pubGuessC: solution2[2],
      pubGuessD: solution2[3],
      pubNumHit: 4,
      pubNumBlow: 0,
      pubSolnHash: solutionHash2,
      privSolnA: solution2[0],
      privSolnB: solution2[1],
      privSolnC: solution2[2],
      privSolnD: solution2[3],
      privSalt: salt2,
    };
    const proofHitAll = await generateProof(proofInputHitAll);
    expect(await hitAndBlow.connect(player2).submitHbProof(...proofHitAll))
      .to.emit(hitAndBlow, "StageChange")
      .withArgs(3);

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
