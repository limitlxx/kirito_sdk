"use strict";
// Compute correct nullifier for test inputs
// This helps us generate valid test data for the Noir circuit
// For testing, we'll use a simple hash simulation
// In reality, this would use the actual Pedersen hash from Noir
const box_id = 12345n;
const token_id = 67890n;
const encryption_key = 99999n;
// Simple hash simulation (not actual Pedersen)
// Just for generating test data
const simulated_hash = (box_id + token_id + encryption_key) % 1000000n;
console.log('Test inputs:');
console.log('box_id:', box_id);
console.log('token_id:', token_id);
console.log('encryption_key:', encryption_key);
console.log('\nComputed nullifier (simulated):', simulated_hash);
console.log('\nNote: For actual circuit execution, the nullifier must be computed using Pedersen hash');
console.log('The circuit will compute: pedersen_hash([box_id, token_id, encryption_key])');
//# sourceMappingURL=compute_nullifier.js.map