import { ethers } from "hardhat";
import { FourNumbers, ProofInput, SolidityProof } from "./types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { poseidonContract } = require("circomlibjs");
const snarkjs = require("snarkjs");

// @ts-ignore
export function buildSolidityProof(snarkProof, publicSignals) {
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

export function calculateHB(guess: FourNumbers, solution: FourNumbers) {
  const hit = solution.filter((sol, i) => {
    return sol === guess[i];
  }).length;

  const blow = solution.filter((sol, i) => {
    return sol !== guess[i] && guess.some((g) => g === sol);
  }).length;

  return [hit, blow];
}

export async function generateProof(inputs: ProofInput) {
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

export async function deploy(contractName: string, ...args: any[]) {
  const Factory = await ethers.getContractFactory(contractName);
  const instance = await Factory.deploy(...args);
  return instance.deployed();
}

export async function deployPoseidon(signer: SignerWithAddress) {
  const Factory = new ethers.ContractFactory(
    poseidonContract.generateABI(5),
    poseidonContract.createCode(5),
    signer
  );
  const instance = await Factory.deploy();
  return instance.deployed();
}
