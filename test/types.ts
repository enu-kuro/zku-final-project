import { BigNumber } from "ethers";

export type ProofInput = {
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

export type SolidityProof = {
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
export type ZeroToNine = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type FourNumbers = [ZeroToNine, ZeroToNine, ZeroToNine, ZeroToNine];
