// DevMirror AI Demo Project
// test.js
const assert = require('assert');
const { verifyToken } = require('./authHelper.js');

function runTests() {
  console.log("Starting authentication helper tests...");
  
  // Test case 1: Verify token from body (legacy style)
  const reqBody = {
    headers: {},
    body: { token: "secret_jwt_token_xyz" }
  };
  const res1 = verifyToken(reqBody);
  assert.strictEqual(res1.authenticated, true, "Should authenticate via request body parameter");
  console.log("✓ Test Case 1 Passed: Legacy Body token authenticated.");

  // Test case 2: Verify token from Authorization Header (modern JWT style)
  // React front-end client uses this format.
  const reqHeader = {
    headers: {
      authorization: "Bearer secret_jwt_token_xyz"
    },
    body: {}
  };
  const res2 = verifyToken(reqHeader);
  assert.strictEqual(res2.authenticated, true, "Should authenticate via Authorization Bearer header");
  console.log("✓ Test Case 2 Passed: Authorization Header token authenticated.");

  console.log("✓ All 2 authentication tests passed successfully!");
}

try {
  runTests();
  process.exit(0);
} catch (error) {
  console.error("\n❌ TEST SUITE FAILED:");
  console.error(error.message);
  process.exit(1);
}
