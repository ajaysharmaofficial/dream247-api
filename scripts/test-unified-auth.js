const jwt = require('jsonwebtoken');

// Test JWT token generation with unified auth fields
async function testTokenGeneration() {
  console.log('Testing JWT Token Generation...\n');
  
  const SECRET_TOKEN = 'test-secret-key';
  
  // Import jose for token signing
  const { SignJWT } = await import('jose');
  const secret = Buffer.from(SECRET_TOKEN);
  
  // Test user data
  const testUser = {
    _id: '507f1f77bcf86cd799439011',
    mobile: 1234567890,
    shop_enabled: true,
    fantasy_enabled: true,
    modules: ['shop', 'fantasy']
  };
  
  // Generate token
  const token = await new SignJWT({ 
    _id: testUser._id,
    userId: testUser._id,
    mobile: testUser.mobile,
    modules: testUser.modules,
    shop_enabled: testUser.shop_enabled,
    fantasy_enabled: testUser.fantasy_enabled
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(secret);
  
  console.log('✓ Token generated successfully');
  console.log('Token:', token.substring(0, 50) + '...\n');
  
  // Verify token
  const decoded = jwt.verify(token, SECRET_TOKEN);
  
  console.log('✓ Token decoded successfully');
  console.log('Decoded payload:', JSON.stringify(decoded, null, 2));
  
  // Validate required fields
  const requiredFields = ['_id', 'userId', 'mobile', 'modules', 'shop_enabled', 'fantasy_enabled'];
  const missingFields = requiredFields.filter(field => !(field in decoded));
  
  if (missingFields.length === 0) {
    console.log('\n✓ All required fields present in token');
  } else {
    console.log('\n✗ Missing fields:', missingFields);
    return false;
  }
  
  // Validate modules array
  if (Array.isArray(decoded.modules) && decoded.modules.includes('fantasy')) {
    console.log('✓ Fantasy module included in token');
  } else {
    console.log('✗ Fantasy module not found in token');
    return false;
  }
  
  // Validate fantasy_enabled flag
  if (decoded.fantasy_enabled === true) {
    console.log('✓ Fantasy enabled flag is true');
  } else {
    console.log('✗ Fantasy enabled flag is not true');
    return false;
  }
  
  console.log('\n✅ All token validation tests passed!');
  return true;
}

// Test module access validation logic
function testModuleValidation() {
  console.log('\n\nTesting Module Access Validation...\n');
  
  const testCases = [
    {
      name: 'Valid token with fantasy access',
      token: {
        _id: '123',
        modules: ['shop', 'fantasy'],
        fantasy_enabled: true
      },
      expectedResult: true
    },
    {
      name: 'Token without fantasy module',
      token: {
        _id: '123',
        modules: ['shop'],
        fantasy_enabled: true
      },
      expectedResult: false,
      expectedError: 'Fantasy module not enabled for this account'
    },
    {
      name: 'Token with fantasy disabled',
      token: {
        _id: '123',
        modules: ['shop', 'fantasy'],
        fantasy_enabled: false
      },
      expectedResult: false,
      expectedError: 'Fantasy access disabled'
    },
    {
      name: 'Token without modules array',
      token: {
        _id: '123',
        fantasy_enabled: true
      },
      expectedResult: false,
      expectedError: 'Fantasy module not enabled for this account'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(testCase => {
    const decoded = testCase.token;
    let hasAccess = true;
    let error = null;
    
    // Simulate middleware logic
    if (!decoded.modules || !decoded.modules.includes('fantasy')) {
      hasAccess = false;
      error = 'Fantasy module not enabled for this account';
    } else if (decoded.fantasy_enabled === false) {
      hasAccess = false;
      error = 'Fantasy access disabled';
    }
    
    if (hasAccess === testCase.expectedResult) {
      console.log(`✓ ${testCase.name}: PASSED`);
      passed++;
    } else {
      console.log(`✗ ${testCase.name}: FAILED`);
      console.log(`  Expected: ${testCase.expectedResult}, Got: ${hasAccess}`);
      failed++;
    }
    
    if (!testCase.expectedResult && error) {
      console.log(`  Error message: ${error}`);
    }
  });
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ All module validation tests passed!');
    return true;
  } else {
    console.log('❌ Some module validation tests failed');
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('='.repeat(60));
  console.log('Unified Authentication System - Validation Tests');
  console.log('='.repeat(60) + '\n');
  
  try {
    const tokenTestPassed = await testTokenGeneration();
    const moduleTestPassed = testModuleValidation();
    
    console.log('\n' + '='.repeat(60));
    if (tokenTestPassed && moduleTestPassed) {
      console.log('✅ All tests passed successfully!');
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.log('❌ Some tests failed');
      console.log('='.repeat(60));
      process.exit(1);
    }
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
}

runTests();
