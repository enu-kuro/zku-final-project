import { ethers } from "hardhat";
import { HitAndBlow, Verifier } from "../typechain";
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
  const verifier = (await deploy("Verifier")) as Verifier;
  const hitAndBlow = (await deploy(
    "HitAndBlow",
    verifier.address,
    poseidonContract.address
  )) as HitAndBlow;
  console.log("poseidon deployed to:", poseidonContract.address);
  console.log("verifier deployed to:", verifier.address);
  console.log("hitAndBlow deployed to:", hitAndBlow.address);
}

// testnet
// poseidon deployed to: 0xf4d0De40D42268869875Db677F43A9FCb8a5b2c3
// verifier deployed to: 0x3Cd7aD79A7fbF9BF1640D51aaeF9d8f5Ec42eF1a
// hitAndBlow deployed to: 0x3c903E0b9E82bd7a4A2Ee7aDA07A46C1393f40Ff

// mainnet
// poseidon deployed to: 0x3b79660bDe39f415ad649509259F995BE428e006
// verifier deployed to: 0x71073366a8B61b1b6634554a9e24cd07B31CB7D4
// hitAndBlow deployed to: 0x320Af97E6E8C580D6850890C81fd7161a3332C71

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
