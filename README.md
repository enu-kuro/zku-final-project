# Hit and Blow Onchain

This project is for Zero Knowledge University(zku.ONE).  
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

# Demo Play (3x speed)
https://user-images.githubusercontent.com/3497643/167441401-0c616c78-285a-4873-a162-6024f04f011b.mp4

# Demo Site
https://hit-and-blow-onchain.herokuapp.com/

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


# Circuit

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


# Frontend code

https://github.com/enu-kuro/zku-final-projetct-frontend
