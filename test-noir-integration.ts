/**
 * Simple test to verify Noir/Barretenberg integration
 */

import { NoirMysteryBoxCircuit } from './src/circuits/noir-integration';

async function testNoirIntegration() {
  console.log('Testing Noir integration...');
  
  try {
    const circuit = new NoirMysteryBoxCircuit();
    
    console.log('Generating test proof...');
    const proof = await circuit.generateRevealProof(
      'test_box_1',
      'test_token_1',
      {
        traits: {
          'Power': 'Fire',
          'Ability': 'Flight'
        }
      },
      {
        type: 'timelock',
        timestamp: Date.now() - 1000
      },
      'test_encryption_key',
      'full'
    );
    
    console.log('Proof generated successfully!');
    console.log('Proof length:', proof.proof.length);
    console.log('Public inputs count:', proof.publicInputs.length);
    
    console.log('\nVerifying proof...');
    const isValid = await circuit.verifyRevealProof(
      proof,
      'test_box_1',
      'test_token_1',
      'full'
    );
    
    console.log('Proof verification result:', isValid);
    
    if (isValid) {
      console.log('\n✅ Noir integration test PASSED');
    } else {
      console.log('\n❌ Noir integration test FAILED');
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

testNoirIntegration();
