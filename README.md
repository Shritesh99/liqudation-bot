# Aave V3 Liquidation Bot

A fully automated liquidation bot for Aave V3 that monitors the network for liquidatable positions and executes flash loan liquidations on XRP EVM Testnet.

## Overview

This bot continuously monitors all borrowers on the Aave V3 pool, identifies positions with health factors below 1.0, and automatically liquidates them using flash loans to generate profit.

### Key Features

-    Automatic monitoring of all pool borrowers
-    Real-time health factor tracking
-    Flash loan based liquidations
-    Automatic profit withdrawal
-    Network event scanning for borrower discovery
-    Minimal configuration required
-    Human-readable logging and output

## Architecture

### Components

1. **Smart Contract** (`AaveV3LiquidationBot.sol`)

     - Receives flash loans from Aave
     - Executes liquidation calls
     - Receives collateral as profit
     - Withdraws profits to owner

2. **Bot Script** (`scripts/AaveV3LiquidationBot.ts`)

     - Monitors all borrowers
     - Calculates liquidation opportunities
     - Prepares and executes transactions
     - Manages bot balance and gas

3. **Tests** (`test/AaveV3LiquidationBot.ts`)
     - Full test coverage
     - Setup and liquidation flows
     - Profit withdrawal verification

## Prerequisites

-    Node.js v16 or higher
-    npm or yarn
-    Private key with testnet XRP for gas fees
-    Deployed AaveV3LiquidationBot contract

## Installation

### 1. Clone the repository

### 2. Deploy the AaveV3LiquidationBot (optional)

```
cd aavev3-deploy
HARDHAT_NETWORK=xrplevm-testnet MARKET_NAME=Aave npx hardhat deploy
```

### 3. Install dependencies

```
cd bot
npm i
```

### 4. Setup the env vars, check out [.env.example](/bot/.env.example)

### 5. Run the tests optional

```
npm run test
```

### 6. Run the bot

```
npm run bot
```

<details>
<summary> Example Output </summary>

    Setting up bot...
    Deployer: 0xA1Cf6afA635e8Ea6Cf3d46c6857982273Ae7D2Ef
    Setup complete

    ========================================
    LIQUIDATION BOT STARTED
    ========================================

    Check 1 at 19:24:26

    Getting all borrowers from network...

    Fetching all borrowers from the pool...
    Scanning blocks 1000 to 5000 for pool interactions

    Found 23 supply events
    Found 18 borrow events
    Checking 30 addresses for opportunities...

    Address: 0x456...
    Health Factor: 1.0500
    Collateral: 5.0000 ETH
    Debt: 8.0000 ETH
    Status: Safe

    Address: 0x789...
    Health Factor: 0.9200
    Collateral: 10.0000 ETH
    Debt: 15.0000 ETH
    Status: CAN BE LIQUIDATED
    Potential Profit: $15000.00

    Found 1 liquidation opportunity(ies)

    Best opportunity:
    Borrower: 0x789...
    Health Factor: 0.9200
    Potential Profit: $15000.00

    Preparing bot for liquidation...
    Bot USDC balance: 45000.000000
    Debt to cover: 7.5 USDC
    Bot is ready

    Executing liquidation...
    Borrower: 0x789...
    Debt to cover: 7.5 USDC

    Transaction sent: 0xabc123...
    Liquidation successful!
    Block: 5100
    Gas used: 250000

    Withdrew 150.50 USDC from bot

    Cycle complete. Profit: $15000.00

</details>

### 7. Stop the bot

```
Press Ctrl+C in terminal
Or kill the process
```

## How It Works

### Monitoring Phase

1. Connects to Aave V3 pool contract
2. Queries blockchain events (Supply, Borrow, Repay, Withdraw)
3. Extracts unique borrower addresses
4. Checks each borrower's account data

### Analysis Phase

1. Calculates health factor for each borrower
2. Identifies positions with health factor < 1.0
3. Estimates potential profit from liquidation
4. Sorts by profitability

### Liquidation Phase

1. Prepares bot (ensures sufficient balance and gas)
2. Initiates flash loan for debt asset
3. Flash loan received by bot
4. Bot calls liquidationCall on pool
5. Pool transfers collateral to bot
6. Bot repays flash loan + fee
7. Remaining collateral = profit

### Withdrawal Phase

1. Withdraws all profits to owner
2. Withdraws ETH to owner
3. Waits for next monitoring cycle

## Smart Contract Details

### AaveV3LiquidationBot.sol

**Main Functions:**

-    `liquidateWithFlashLoan(address borrower, address collateral, address debt, uint256 debtToCover)`

     -    Initiates flash loan and liquidation process
     -    Only callable by owner

-    `executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params)`

     -    Called by Aave pool during flash loan
     -    Executes the actual liquidation
     -    Repays flash loan + premium

-    `withdrawProfits(address token, uint256 amount)`

     -    Withdraws specific amount of tokens
     -    Only callable by owner

-    `withdrawAllProfits(address token)`

     -    Withdraws all balance of token
     -    Only callable by owner

-    `withdrawETH()`
     -    Withdraws all ETH
     -    Only callable by owner

## Network Configuration

### XRP EVM Testnet

-    **RPC URL:** `https://rpc.testnet.xrplevm.org`
-    **Chain ID:** 1449000
-    **Currency:** XRP
-    **Block Explorer:** `https://explorer.testnet.xrplevm.org`

### Important Addresses (XRP EVM Testnet)

| Contract         | Address                                      |
| ---------------- | -------------------------------------------- |
| Pool Proxy       | `0x2Bd659a3eCD54FF2143DE3e774f46E884658B06f` |
| Address Provider | `0x6b698FB7F6f813f7F2663e2AcffdcA8F350719e8` |
| WETH             | `0xD4af7891561bf8B6123e54A67B46D37AdF74B90B` |
| USDC             | `0x7Fd95Fb54726e26E80AF4DfAea7429fFE2060612` |
| Faucet           | `0xAd0f70996f82f314b2a511330cc5208f6C546e78` |

## Acknowledgments

Built with:

-    Aave V3 Flash Loans
-    Hardhat for development
-    Ethers.js for Web3 interactions
-    XRP Ledger EVM Sidechain

## License

MIT
