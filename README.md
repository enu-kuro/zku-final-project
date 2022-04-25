# Hit and Blow Onchain

This is my final project for Zero Knowledge University(zku.ONE).  
https://zku.one/  
Hit & Blow is a popular code-breaking PvP game.  
(also known as Bulls and Cows)  
https://apps.apple.com/app/id1554440792  

# Gameplay

```
On a sheet of paper, the players each write a 4-digit secret number.  
The digits must be all different. Then, in turn, the players try to guess their opponent's number who gives the number of matches.  
If the matching digits are in their right positions, they are "bulls", if in different positions, they are "cows". 

Example:

Secret number: 4271
Opponent's try: 1234
Answer: 1 bull and 2 cows. (The bull is "2", the cows are "4" and "1".)

The first player to reveal the other's secret number wins the game.
```
https://en.wikipedia.org/wiki/Bulls_and_Cows

# Why

## 1. ZKP ensures the integrity of the game.  

This game is a great use case for Zero Knowledge proofs(ZKP) because we have to keep our solution a secret.  
Just for secrecy, Commit-Reveal Schemes is enough, but without ZKP, we can't prevent cheating in mid-game.   
With ZKP, we can prove that the hit and blow numbers are true.  
https://weijiek.medium.com/how-i-learned-zk-snarks-from-scratch-177a01c5514e


## 2. ZKP can improve UX? (I haven't implemented anything about this solution in this final project)  

I like playing casual games but but I haven't seen onchain casual games.  
Of course there are decent reasons. One of the biggest reason is Bad UX.  
Now Metamask is the de facto standard for dApps and for interacting with blockchain we have to wait for Metamask showing a confirmation view and confirm it.  
Usually it's not a problem but playing games requaires a lot of interactions.
(Expensive gas fee and slow finality are also serious problem on Ethereum but not on Harmony.)  

Is there any possibility that we execute offchain in mid-game and verify game results onchain at the end of the game?  
Though it needs offchain servers, probably there are some ways to make it more decentralized and trustless way?  
  
(When you play Dark Forst, you have to store your private key on a browsers local storage for better UX. So you don't have to use Metamask. It's not an ideal solution.)  


# Code

## Circuit

- inputs & output
```
    // Public inputs
    signal input pubGuessA;
    signal input pubGuessB;
    signal input pubGuessC;
    signal input pubGuessD;
    signal input pubNumHit;
    signal input pubNumBlow;
    signal input pubSolnHash;

    // Private inputs
    signal input privSolnA;
    signal input privSolnB;
    signal input privSolnC;
    signal input privSolnD;
    signal input privSalt;

    // Output
    signal output solnHashOut;
```

- Constraints for less than 10 and no duplication
```
    // Create a constraint that the solution and guess digits are all less than 10.
    for (j=0; j<4; j++) {
        lessThan[j] = LessThan(4);
        lessThan[j].in[0] <== guess[j];
        lessThan[j].in[1] <== 10;
        lessThan[j].out === 1;
        lessThan[j+4] = LessThan(4);
        lessThan[j+4].in[0] <== soln[j];
        lessThan[j+4].in[1] <== 10;
        lessThan[j+4].out === 1;
        for (k=j+1; k<4; k++) {
            // Create a constraint that the solution and guess digits are unique. no duplication.
            equalGuess[equalIdx] = IsEqual();
            equalGuess[equalIdx].in[0] <== guess[j];
            equalGuess[equalIdx].in[1] <== guess[k];
            equalGuess[equalIdx].out === 0;
            equalSoln[equalIdx] = IsEqual();
            equalSoln[equalIdx].in[0] <== soln[j];
            equalSoln[equalIdx].in[1] <== soln[k];
            equalSoln[equalIdx].out === 0;
            equalIdx += 1;
        }
    }
```

- Constraints for num of hit & blow
```
    // Count hit & blow
    var hit = 0;
    var blow = 0;
    component equalHB[16];

    for (j=0; j<4; j++) {
        for (k=0; k<4; k++) {
            equalHB[4*j+k] = IsEqual();
            equalHB[4*j+k].in[0] <== soln[j];
            equalHB[4*j+k].in[1] <== guess[k];
            blow += equalHB[4*j+k].out;
            if (j == k) {
                hit += equalHB[4*j+k].out;
                blow -= equalHB[4*j+k].out;
            }
        }
    }

    // Create a constraint around the number of hit
    component equalHit = IsEqual();
    equalHit.in[0] <== pubNumHit;
    equalHit.in[1] <== hit;
    equalHit.out === 1;
    
    // Create a constraint around the number of blow
    component equalBlow = IsEqual();
    equalBlow.in[0] <== pubNumBlow;
    equalBlow.in[1] <== blow;
    equalBlow.out === 1;
```

- Constraint for solution hash
```
    // Verify that the hash of the private solution matches pubSolnHash
    component poseidon = Poseidon(5);
    poseidon.inputs[0] <== privSalt;
    poseidon.inputs[1] <== privSolnA;
    poseidon.inputs[2] <== privSolnB;
    poseidon.inputs[3] <== privSolnC;
    poseidon.inputs[4] <== privSolnD;

    solnHashOut <== poseidon.out;
    pubSolnHash === solnHashOut;
```
https://github.com/enu-kuro/zku-final-project/blob/main/circuits/hitandblow.circom


## Test code for 2 players playing the game from beginning to end
```
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
```
https://github.com/enu-kuro/zku-final-project/blob/main/test/index.ts


# Demo

https://user-images.githubusercontent.com/3497643/165048222-72250e91-d38e-4b70-ac7f-ff1287569935.mov


# Frontend code

https://github.com/enu-kuro/zku-final-projetct-frontend
