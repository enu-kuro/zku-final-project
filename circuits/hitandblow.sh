# Compiling our circuit
circom HitAndBlow.circom --r1cs --wasm --sym

# Computing the witness with WebAssembly
node ./HitAndBlow_js/generate_witness.js ./HitAndBlow_js/HitAndBlow.wasm input_hitandblow.json ./HitAndBlow_js/witness.wtns

# # Powers of Tau
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -e="random"


# # Phase 2
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
snarkjs groth16 setup HitAndBlow.r1cs pot12_final.ptau HitAndBlow_0000.zkey
snarkjs zkey contribute HitAndBlow_0000.zkey HitAndBlow_0001.zkey --name="1st Contributor Name" -e="random"

# Export the verification key:
snarkjs zkey export verificationkey HitAndBlow_0001.zkey verification_key.json


# Generating a Proof
snarkjs groth16 prove HitAndBlow_0001.zkey ./HitAndBlow_js/witness.wtns hitandblow_proof.json public.json


# Verifying a Proof
snarkjs groth16 verify verification_key.json public.json hitandblow_proof.json

# Verifying from a Smart Contract
snarkjs zkey export solidityverifier HitAndBlow_0001.zkey ../contracts/verifier.sol
# https://stackoverflow.com/questions/25486667/sed-without-backup-file
sed -i '' -e 's/0\.6\.11/0\.8\.0/' ../contracts/verifier.sol

# snarkjs generatecall | tee parameters.txt

