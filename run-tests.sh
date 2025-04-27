#!/usr/bin/env bash

# Colors for output formatting
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}           Short-Link Application Test Suite            ${NC}"
echo -e "${BLUE}=======================================================${NC}"

# Create .env.test if it doesn't exist yet
if [ ! -f .env.test ]; then
  echo -e "${YELLOW}Creating .env.test file for testing...${NC}"
  cat << EOF > .env.test
PORT=3001
MONGODB_URI=mongodb://localhost:27017/short-link-test
SESSION_SECRET=test-secret-key
JWT_SECRET=test-jwt-secret
NODE_ENV=test
EOF
  echo -e "${GREEN}Created .env.test file${NC}"
fi

# Parse command-line arguments
TEST_TYPE="all"
COVERAGE=false

for arg in "$@"; do
  case $arg in
    --unit)
      TEST_TYPE="unit"
      shift
      ;;
    --integration)
      TEST_TYPE="integration"
      shift
      ;;
    --e2e)
      TEST_TYPE="e2e"
      shift
      ;;
    --coverage)
      COVERAGE=true
      shift
      ;;
    --help)
      echo -e "Usage: ./run-tests.sh [options]"
      echo -e "Options:"
      echo -e "  --unit       Run only unit tests"
      echo -e "  --integration Run only integration tests"
      echo -e "  --e2e        Run only end-to-end tests"
      echo -e "  --coverage   Generate test coverage report"
      echo -e "  --help       Display this help message"
      exit 0
      ;;
  esac
done

# Run the tests based on specified type
echo -e "${YELLOW}Starting ${TEST_TYPE} tests...${NC}"

if [ "$COVERAGE" = true ]; then
  echo -e "${YELLOW}Collecting test coverage...${NC}"
  if [ "$TEST_TYPE" = "all" ]; then
    npm run test:coverage
  else
    npx jest tests/$TEST_TYPE --coverage
  fi
else
  case $TEST_TYPE in
    "unit")
      npm run test:unit
      ;;
    "integration")
      npm run test:integration
      ;;
    "e2e")
      npm run test:e2e
      ;;
    "all")
      npm run test
      ;;
  esac
fi

# Exit with the exit code from the Jest process
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}All tests passed successfully!${NC}"
else
  echo -e "${RED}Some tests failed. Please check the output above for details.${NC}"
fi

exit $EXIT_CODE