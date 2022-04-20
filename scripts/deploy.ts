import { ethers } from "hardhat";
import { HitAndBlow } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { poseidonContract } = require("circomlibjs");

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
async function main() {
  const [owner] = await ethers.getSigners();
  const poseidonContract = await deployPoseidon(owner);
  const hitAndBlow = (await deploy(
    "HitAndBlow",
    poseidonContract.address
  )) as HitAndBlow;

  console.log("hitAndBlow deployed to:", hitAndBlow.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
