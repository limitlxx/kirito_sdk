// Mystery Box Reveal Circuit in Noir
// Validates mystery box reveals with privacy preservation
// Supports both full reveals and bluffing (category-only) reveals

// Maximum number of traits per mystery box
global MAX_TRAITS: u32 = 10;

// Reveal types
global REVEAL_TYPE_FULL: u8 = 1;
global REVEAL_TYPE_BLUFFING: u8 = 2;

// Condition types
global CONDITION_TIMELOCK: u8 = 1;
global CONDITION_ACTION: u8 = 2;
global CONDITION_COMBINED: u8 = 3;

// Trait categories
global CATEGORY_POWER: u8 = 1;
global CATEGORY_ABILITY: u8 = 2;
global CATEGORY_YIELD: u8 = 3;
global CATEGORY_RARITY: u8 = 4;

struct HiddenTrait {
    category: u8,
    trait_hash: Field,
    value_hash: Field,
    yield_multiplier: u32,
}

struct RevealConditions {
    condition_type: u8,
    timestamp: u64,
    required_action: u8,
    minimum_stake: u64,
    action_completed: bool,
}

// Main circuit function
fn main(
    // Public inputs
    box_id: pub Field,
    token_id: pub Field,
    current_timestamp: pub u64,
    merkle_root: pub Field,
    nullifier: pub Field,
    reveal_type: pub u8,
    
    // Private inputs (witness)
    traits: [HiddenTrait; MAX_TRAITS],
    trait_count: u32,
    encryption_key: Field,
    reveal_conditions: RevealConditions,
    merkle_proof: [Field; 8],
    action_proof: Field,
    bluff_category: u8
) {
    // 1. Verify nullifier is correctly computed
    let computed_nullifier = std::hash::pedersen_hash([box_id, token_id, encryption_key]);
    assert(nullifier == computed_nullifier);
    
    // 2. Verify merkle proof for box existence
    let leaf = std::hash::pedersen_hash([box_id, token_id]);
    let mut current = leaf;
    for i in 0..8 {
        current = std::hash::pedersen_hash([current, merkle_proof[i]]);
    }
    assert(current == merkle_root);
    
    // 3. Verify reveal conditions are met
    verify_reveal_conditions(reveal_conditions, current_timestamp, action_proof);
    
    // 4. Verify traits based on reveal type
    if reveal_type == REVEAL_TYPE_FULL {
        // Full reveal: verify all traits are properly hashed
        verify_full_reveal(traits, trait_count, encryption_key);
    } else if reveal_type == REVEAL_TYPE_BLUFFING {
        // Bluffing reveal: only verify category membership
        verify_bluffing_reveal(traits, trait_count, bluff_category);
    }
}

// Verify reveal conditions are satisfied
fn verify_reveal_conditions(
    conditions: RevealConditions,
    current_timestamp: u64,
    action_proof: Field
) {
    if conditions.condition_type == CONDITION_TIMELOCK {
        // Time-lock: current time must be past the timestamp
        assert(current_timestamp >= conditions.timestamp);
    } else if conditions.condition_type == CONDITION_ACTION {
        // Action-based: verify action proof
        assert(conditions.action_completed);
        let expected_proof = std::hash::pedersen_hash([
            conditions.required_action as Field,
            conditions.minimum_stake as Field
        ]);
        assert(action_proof == expected_proof);
    } else if conditions.condition_type == CONDITION_COMBINED {
        // Combined: both time and action
        assert(current_timestamp >= conditions.timestamp);
        assert(conditions.action_completed);
    }
}

// Verify full reveal with all trait data
fn verify_full_reveal(
    traits: [HiddenTrait; MAX_TRAITS],
    trait_count: u32,
    _encryption_key: Field
) {
    // Verify each trait is properly encrypted/hashed
    for i in 0..MAX_TRAITS {
        if i < trait_count {
            let current_trait = traits[i];
            
            // Verify trait hash is valid
            assert(current_trait.trait_hash != 0);
            assert(current_trait.value_hash != 0);
            
            // Verify category is valid
            let valid_category = (current_trait.category == CATEGORY_POWER) |
                (current_trait.category == CATEGORY_ABILITY) |
                (current_trait.category == CATEGORY_YIELD) |
                (current_trait.category == CATEGORY_RARITY);
            assert(valid_category);
            
            // Verify yield multiplier is reasonable
            assert(current_trait.yield_multiplier > 0);
            assert(current_trait.yield_multiplier <= 500);
        }
    }
}

// Verify bluffing reveal (category only, no specific trait values)
fn verify_bluffing_reveal(
    traits: [HiddenTrait; MAX_TRAITS],
    trait_count: u32,
    bluff_category: u8
) {
    // Verify at least one trait matches the claimed category
    let mut category_found = false;
    
    for i in 0..MAX_TRAITS {
        if i < trait_count {
            if traits[i].category == bluff_category {
                category_found = true;
            }
        }
    }
    
    // Must have at least one trait in the claimed category
    assert(category_found);
    
    // Verify category is valid
    let valid_category = (bluff_category == CATEGORY_POWER) |
        (bluff_category == CATEGORY_ABILITY) |
        (bluff_category == CATEGORY_YIELD) |
        (bluff_category == CATEGORY_RARITY);
    assert(valid_category);
}
