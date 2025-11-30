import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AaveV3LiquidationBot, IERC20, IPool } from "../typechain";

describe("AaveV3LiquidationBot - XRP EVM Testnet", () => {
	let liquidationBot: AaveV3LiquidationBot;
	let pool: IPool;
	let weth: IERC20;
	let usdc: IERC20;
	let aWeth: IERC20;
	let aUsdc: IERC20;
	let debtUSDC: IERC20;

	let owner: SignerWithAddress;
	let lender: SignerWithAddress;
	let borrower: SignerWithAddress;
	let attacker: SignerWithAddress;

	// XRP EVM Testnet - Pool Addresses
	const POOL_PROXY_ADDRESS = "0x2Bd659a3eCD54FF2143DE3e774f46E884658B06f"; // Pool-Proxy-Aave
	const ADDRESS_PROVIDER = "0x6b698FB7F6f813f7F2663e2AcffdcA8F350719e8"; // PoolAddressesProvider-Aave
	const POOL_DATA_PROVIDER = "0x523240bC63d1F12F1239874059d819FeD7E62444"; // PoolDataProvider-Aave
	const AAVE_ORACLE = "0x2cA403099B4bf3ca5007256bF05e5E447677DB7F"; // AaveOracle-Aave
	const POOL_CONFIGURATOR = "0xB4f1b9C8Ea4C382688dD86fE2B14889a23c2e1a4"; // PoolConfigurator-Proxy-Aave
	const ACL_MANAGER = "0x92DbdE61c2f5f5556064ee8fbE1bD17452EFA1BA"; // ACLManager-Aave
	const FAUCET = "0xAd0f70996f82f314b2a511330cc5208f6C546e78"; // Faucet-Aave

	// XRP EVM Testnet - Token Addresses
	const WETH_ADDRESS = "0xD4af7891561bf8B6123e54A67B46D37AdF74B90B"; // WETH-TestnetMintableERC20-Aave
	const USDC_ADDRESS = "0x7Fd95Fb54726e26E80AF4DfAea7429fFE2060612"; // USDC-TestnetMintableERC20-Aave
	const DAI_ADDRESS = "0x467a84dB50e42d88B9F3273328EF7fE1Ab5eE12A"; // DAI-TestnetMintableERC20-Aave
	const LINK_ADDRESS = "0x1cA8BA5d3350B3579b1995c24406f16115ed02dC"; // LINK-TestnetMintableERC20-Aave
	const WBTC_ADDRESS = "0xEe4AfaD7385F7fA976aB125388A686DeEe7cc012"; // WBTC-TestnetMintableERC20-Aave
	const USDT_ADDRESS = "0xEbb6c020b0a2402e8abCdAA2059681547dA2b605"; // USDT-TestnetMintableERC20-Aave
	const AAVE_REWARD_ADDRESS = "0x9dbD4D7E3ED41395C7429e745a471F9440DAa485"; // AAVE-TestnetMintableERC20-Aave
	const EURS_ADDRESS = "0x233bB35b651EAfB16bA8428688925122eAB714D5"; // EURS-TestnetMintableERC20-Aave

	// XRP EVM Testnet - AToken Addresses
	const aWETH_ADDRESS = "0x59E9Ab606C7F6C99A427801ce0ffD941EF9CeEDc"; // WETH-AToken-Aave
	const aUSDC_ADDRESS = "0x32635BcBf8847689ce2b7c1858501b37e7Ce1E16"; // USDC-AToken-Aave
	const aDAI_ADDRESS = "0x52080CcfF6bc4a368cC88D27EA5444a5B2c4c5FA"; // DAI-AToken-Aave

	// XRP EVM Testnet - Debt Token Addresses
	const debtUSDC_VARIABLE = "0x51448EA131846d88Ec932fEf93375923568Ea25a"; // USDC-VariableDebtToken-Aave
	const debtUSDC_STABLE = "0x93f17D458110E4B4cc850f2ECBaF7E0929816966"; // USDC-StableDebtToken-Aave
	const debtWETH_VARIABLE = "0x6Cf1C45D2F45025589b80FB547f882F0351A018c"; // WETH-VariableDebtToken-Aave
	const debtWETH_STABLE = "0x948c150430999664ECbD9107C2E926f51aF1899c"; // WETH-StableDebtToken-Aave
	const debtDAI_VARIABLE = "0x7bE98B5DB951F87644A886477d716270C6106D97"; // DAI-VariableDebtToken-Aave

	// Bot Address
	const BOT_ADDRESS = "0xeD041d002B1976c642Aeb2d9b914d064339a23a6";

	// Deployer address from deployment output
	const DEPLOYER_ADDRESS = "0xA1Cf6afA635e8Ea6Cf3d46c6857982273Ae7D2Ef";

	// Test amounts
	const WETH_SUPPLY = hre.ethers.utils.parseUnits("50", 18);
	const USDC_SUPPLY = hre.ethers.utils.parseUnits("100000", 6);
	const WETH_COLLATERAL = hre.ethers.utils.parseUnits("5", 18);
	const USDC_BORROW = hre.ethers.utils.parseUnits("10000", 6);
	const DEBT_TO_COVER = hre.ethers.utils.parseUnits("5000", 6);

	before(async () => {
		[owner, lender, borrower, attacker] = await hre.ethers.getSigners();

		console.log("\n📋 Test Setup Information:");
		console.log(`   Owner: ${owner.address}`);
		console.log(`   Lender: ${lender.address}`);
		console.log(`   Borrower: ${borrower.address}`);
		console.log(`   Attacker: ${attacker.address}\n`);

		// Get contract instances
		pool = await hre.ethers.getContractAt("IPool", POOL_PROXY_ADDRESS);
		weth = await hre.ethers.getContractAt("IERC20", WETH_ADDRESS);
		usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS);
		aWeth = await hre.ethers.getContractAt("IERC20", aWETH_ADDRESS);
		aUsdc = await hre.ethers.getContractAt("IERC20", aUSDC_ADDRESS);
		debtUSDC = await hre.ethers.getContractAt(
			"IERC20",
			debtUSDC_VARIABLE
		);

		// Get or deploy liquidation bot
		try {
			liquidationBot = await hre.ethers.getContractAt(
				"AaveV3LiquidationBot",
				BOT_ADDRESS
			);
		} catch (error) {
			// Deploy if doesn't exist
			const LiquidationBotFactory =
				await hre.ethers.getContractFactory("AaveV3LiquidationBot");
			liquidationBot = await LiquidationBotFactory.deploy(
				ADDRESS_PROVIDER
			);
			await liquidationBot.waitForDeployment();
			console.log(`✅ LiquidationBot deployed at: ${BOT_ADDRESS}\n`);
		}

		// Mint tokens via faucet
		const faucet = await hre.ethers.getContractAt(
			[
				"function mint(address token, address to, uint256 amount) external",
			],
			FAUCET
		);

		console.log("🔨 Minting test tokens via faucet...");
		try {
			// Mint WETH
			await faucet.mint(WETH_ADDRESS, lender.address, WETH_SUPPLY);
			await faucet.mint(
				WETH_ADDRESS,
				borrower.address,
				WETH_COLLATERAL.mul(2n)
			);

			// Mint USDC
			await faucet.mint(USDC_ADDRESS, lender.address, USDC_SUPPLY);
			await faucet.mint(USDC_ADDRESS, BOT_ADDRESS, USDC_SUPPLY);

			console.log("✅ Tokens minted successfully\n");
		} catch (error) {
			console.error(
				"⚠️  Faucet mint failed (tokens may already exist):",
				error
			);
		}
	});

	describe("Deployment & Initialization", () => {
		it("Should have correct owner", async () => {
			const botOwner = await liquidationBot.owner();
			expect(botOwner).to.equal(owner.address);
		});

		it("Should have correct ADDRESS_PROVIDER", async () => {
			const provider = await liquidationBot.ADDRESSES_PROVIDER();
			expect(provider).to.equal(ADDRESS_PROVIDER);
		});

		it("Should have correct POOL address", async () => {
			const botPool = await liquidationBot.POOL();
			expect(botPool).to.equal(POOL_PROXY_ADDRESS);
		});

		it("Should start with zero ETH balance", async () => {
			const balance = await hre.ethers.provider.getBalance(
				BOT_ADDRESS
			);
			expect(balance).to.equal(0);
		});

		it("Should accept ETH via receive function", async () => {
			const botAddress = BOT_ADDRESS;
			const ethBefore = await hre.ethers.provider.getBalance(
				botAddress
			);

			const ethAmount = hre.ethers.utils.parseUnits("0.1", 18);
			await owner.sendTransaction({
				to: botAddress,
				value: ethAmount,
			});

			const ethAfter = await hre.ethers.provider.getBalance(
				botAddress
			);
			expect(ethAfter).to.equal(ethBefore.add(ethAmount));
		});
	});

	describe("Access Control", () => {
		it("Only owner can initiate liquidation", async () => {
			const tx = liquidationBot
				.connect(attacker)
				.liquidateWithFlashLoan(
					borrower.address,
					WETH_ADDRESS,
					USDC_ADDRESS,
					DEBT_TO_COVER
				);

			await expect(tx).to.be.revertedWith("Only owner");
		});

		it("Only owner can withdraw profits", async () => {
			const tx = liquidationBot
				.connect(attacker)
				.withdrawProfits(WETH_ADDRESS, 0);

			await expect(tx).to.be.revertedWith("Only owner");
		});

		it("Only owner can withdraw all profits", async () => {
			const tx = liquidationBot
				.connect(attacker)
				.withdrawAllProfits(WETH_ADDRESS);

			await expect(tx).to.be.revertedWith("Only owner");
		});

		it("Only owner can withdraw ETH", async () => {
			const tx = liquidationBot.connect(attacker).withdrawETH();

			await expect(tx).to.be.revertedWith("Only owner");
		});
	});

	describe("Aave Setup - Supply and Borrow", () => {
		it("Lender should supply USDC to Aave", async () => {
			const usdcWithLender = usdc.connect(lender);

			await usdcWithLender.approve(POOL_PROXY_ADDRESS, USDC_SUPPLY);
			await pool
				.connect(lender)
				.supply(USDC_ADDRESS, USDC_SUPPLY, lender.address, 0);

			const [totalCollateral] = await pool.getUserAccountData(
				lender.address
			);
			expect(totalCollateral).to.be.greaterThan(0);
		});

		it("Lender should supply WETH to Aave", async () => {
			const wethWithLender = weth.connect(lender);

			await wethWithLender.approve(POOL_PROXY_ADDRESS, WETH_SUPPLY);
			await pool
				.connect(lender)
				.supply(WETH_ADDRESS, WETH_SUPPLY, lender.address, 0);

			const aTokenBalance = await aWeth.balanceOf(lender.address);
			expect(aTokenBalance).to.be.greaterThan(0);
		});

		it("Borrower should supply WETH as collateral", async () => {
			const wethWithBorrower = weth.connect(borrower);

			await wethWithBorrower.approve(
				POOL_PROXY_ADDRESS,
				WETH_COLLATERAL
			);
			await pool
				.connect(borrower)
				.supply(WETH_ADDRESS, WETH_COLLATERAL, borrower.address, 0);

			const aTokenBalance = await aWeth.balanceOf(borrower.address);
			expect(aTokenBalance).to.be.greaterThan(0);
		});

		it("Borrower should borrow USDC against WETH collateral", async () => {
			const poolWithBorrower = pool.connect(borrower);

			// Borrow (interestRateMode = 2 for variable)
			await poolWithBorrower.borrow(
				USDC_ADDRESS,
				USDC_BORROW,
				2,
				0,
				borrower.address
			);

			const debtBalance = await debtUSDC.balanceOf(borrower.address);
			expect(debtBalance).to.be.greaterThan(0);
		});

		it("Health factor should be > 1 after setup", async () => {
			const [, , , , , healthFactor] = await pool.getUserAccountData(
				borrower.address
			);

			expect(healthFactor).to.be.greaterThan(
				hre.ethers.utils.parseUnits("1", 18)
			);
		});

		it("Should verify borrower debt and collateral", async () => {
			const [
				totalCollateralBase,
				totalDebtBase,
				availableBorrowsBase,
				currentLiquidationThreshold,
				ltv,
				healthFactor,
			] = await pool.getUserAccountData(borrower.address);

			console.log(`\n📊 Borrower Account Data:`);
			console.log(
				`   Total Collateral: ${hre.ethers.utils.formatUnits(
					totalCollateralBase,
					8
				)}`
			);
			console.log(
				`   Total Debt: ${hre.ethers.utils.formatUnits(
					totalDebtBase,
					8
				)}`
			);
			console.log(
				`   Available Borrows: ${hre.ethers.utils.formatUnits(
					availableBorrowsBase,
					8
				)}`
			);
			console.log(
				`   Liquidation Threshold: ${currentLiquidationThreshold}`
			);
			console.log(`   LTV: ${ltv}`);
			console.log(
				`   Health Factor: ${hre.ethers.utils.formatUnits(
					healthFactor,
					18
				)}\n`
			);

			expect(totalCollateralBase).to.be.greaterThan(0);
			expect(totalDebtBase).to.be.greaterThan(0);
			expect(healthFactor).to.be.greaterThan(0);
		});
	});

	describe("Flash Loan Parameters", () => {
		it("Should encode liquidation parameters correctly", async () => {
			const params = hre.ethers.AbiCoder.defaultAbiCoder().encode(
				["address", "address", "address"],
				[borrower.address, WETH_ADDRESS, USDC_ADDRESS]
			);

			const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
				["address", "address", "address"],
				params
			);

			expect(decoded[0]).to.equal(borrower.address);
			expect(decoded[1]).to.equal(WETH_ADDRESS);
			expect(decoded[2]).to.equal(USDC_ADDRESS);
		});

		it("Should have valid parameter for flash loan", async () => {
			const borrowerData = await pool.getUserAccountData(
				borrower.address
			);
			const [, totalDebt] = borrowerData;

			expect(totalDebt).to.be.greaterThan(0);
			expect(DEBT_TO_COVER).to.be.lessThanOrEqual(totalDebt);
		});
	});

	describe("Profit Withdrawal - ERC20", () => {
		it("Owner should withdraw partial profits", async () => {
			// Add profits to bot
			const profitAmount = hre.ethers.utils.parseUnits("1", 6); // 1 USDC
			const usdcWithLender = usdc.connect(lender);
			await usdcWithLender.transfer(BOT_ADDRESS, profitAmount);

			const balanceBefore = await usdc.balanceOf(owner.address);
			const withdrawAmount = hre.ethers.utils.parseUnits("0.5", 6);

			await liquidationBot
				.connect(owner)
				.withdrawProfits(USDC_ADDRESS, withdrawAmount);

			const balanceAfter = await usdc.balanceOf(owner.address);
			expect(balanceAfter).to.equal(balanceBefore.add(withdrawAmount));
		});

		it("Should emit ProfitsWithdrawn event", async () => {
			const profitAmount = hre.ethers.utils.parseUnits("1", 6);
			const usdcWithLender = usdc.connect(lender);
			await usdcWithLender.transfer(BOT_ADDRESS, profitAmount);

			await expect(
				liquidationBot
					.connect(owner)
					.withdrawProfits(USDC_ADDRESS, profitAmount)
			)
				.to.emit(liquidationBot, "ProfitsWithdrawn")
				.withArgs(USDC_ADDRESS, profitAmount, owner.address);
		});

		it("Should revert if insufficient balance", async () => {
			const excessiveAmount = hre.ethers.utils.parseUnits("999999", 6);

			const tx = liquidationBot
				.connect(owner)
				.withdrawProfits(USDC_ADDRESS, excessiveAmount);

			await expect(tx).to.be.revertedWith(
				"LiquidationBot: Insufficient balance"
			);
		});

		it("Owner should withdraw all profits", async () => {
			const profitAmount = hre.ethers.utils.parseUnits("2", 6);
			const usdcWithLender = usdc.connect(lender);
			await usdcWithLender.transfer(BOT_ADDRESS, profitAmount);

			const balanceBefore = await usdc.balanceOf(owner.address);

			await liquidationBot
				.connect(owner)
				.withdrawAllProfits(USDC_ADDRESS);

			const balanceAfter = await usdc.balanceOf(owner.address);
			expect(balanceAfter).to.equal(balanceBefore.add(profitAmount));
		});

		it("Should emit ProfitsWithdrawn on withdrawAll", async () => {
			const profitAmount = hre.ethers.utils.parseUnits("1", 6);
			const usdcWithLender = usdc.connect(lender);
			await usdcWithLender.transfer(BOT_ADDRESS, profitAmount);

			await expect(
				liquidationBot
					.connect(owner)
					.withdrawAllProfits(USDC_ADDRESS)
			)
				.to.emit(liquidationBot, "ProfitsWithdrawn")
				.withArgs(USDC_ADDRESS, profitAmount, owner.address);
		});

		it("Should revert withdrawAll if no balance", async () => {
			// Try to withdraw from token with no balance
			const emptyAddress = hre.ethers.Wallet.createRandom().address;

			const tx = liquidationBot
				.connect(owner)
				.withdrawAllProfits(emptyAddress);

			// Will fail at IERC20 level
			await expect(tx).to.be.reverted;
		});
	});

	describe("ETH Handling", () => {
		it("Should receive ETH via receive function", async () => {
			const botAddress = BOT_ADDRESS;
			const ethBefore = await hre.ethers.provider.getBalance(
				botAddress
			);

			const ethAmount = hre.ethers.utils.parseUnits("0.5", 18);
			await owner.sendTransaction({
				to: botAddress,
				value: ethAmount,
			});

			const ethAfter = await hre.ethers.provider.getBalance(
				botAddress
			);
			expect(ethAfter).to.equal(ethBefore.add(ethAmount));
		});

		it("Owner should withdraw ETH", async () => {
			const botAddress = BOT_ADDRESS;

			const ethAmount = hre.ethers.utils.parseUnits("0.5", 18);
			await owner.sendTransaction({
				to: botAddress,
				value: ethAmount,
			});

			const balanceBefore = await hre.ethers.provider.getBalance(
				owner.address
			);

			const tx = await liquidationBot.connect(owner).withdrawETH();
			const receipt = await tx.wait();
			const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

			const balanceAfter = await hre.ethers.provider.getBalance(
				owner.address
			);
			expect(balanceAfter).to.be.greaterThan(
				balanceBefore.sub(gasUsed.mul(2n))
			);
		});

		it("Should accept fallback function with ETH", async () => {
			const botAddress = BOT_ADDRESS;
			const ethBefore = await hre.ethers.provider.getBalance(
				botAddress
			);

			const ethAmount = hre.ethers.utils.parseUnits("0.1", 18);
			await owner.sendTransaction({
				to: botAddress,
				data: "0xdeadbeef",
				value: ethAmount,
			});

			const ethAfter = await hre.ethers.provider.getBalance(
				botAddress
			);
			expect(ethAfter).to.equal(ethBefore.add(ethAmount));
		});
	});

	describe("Flash Loan Execution", () => {
		it("Should prepare for flash loan liquidation", async () => {
			const liquidationBotWithOwner = liquidationBot.connect(owner);

			// Just verify setup is correct
			const botAddress = BOT_ADDRESS;
			const botBalance = await usdc.balanceOf(botAddress);

			expect(botBalance).to.be.greaterThan(0);
		});

		it("Should have sufficient USDC for flash loan repayment", async () => {
			const botAddress = BOT_ADDRESS;
			const botBalance = await usdc.balanceOf(botAddress);

			// Should have at least debt + flash loan fee
			const expectedMinimum = DEBT_TO_COVER.mul(1005n).div(1000n); // 0.5% fee
			expect(botBalance).to.be.greaterThanOrEqual(expectedMinimum);
		});

		it("executeOperation should be callable", async () => {
			// Just verify function exists and has correct signature
			expect(liquidationBot.executeOperation).to.exist;
		});
	});

	describe("Edge Cases", () => {
		it("Should handle zero debt amount", async () => {
			const liquidationBotWithOwner = liquidationBot.connect(owner);

			const tx = liquidationBotWithOwner.liquidateWithFlashLoan(
				borrower.address,
				WETH_ADDRESS,
				USDC_ADDRESS,
				0
			);

			// Flash loan should reject zero amount
			await expect(tx).to.be.rejected;
		});

		it("Should handle invalid borrower address", async () => {
			const liquidationBotWithOwner = liquidationBot.connect(owner);

			const tx = liquidationBotWithOwner.liquidateWithFlashLoan(
				hre.ethers.ZeroAddress,
				WETH_ADDRESS,
				USDC_ADDRESS,
				DEBT_TO_COVER
			);

			await expect(tx).to.be.rejected;
		});

		it("Should handle invalid collateral asset", async () => {
			const fakeToken = hre.ethers.Wallet.createRandom().address;

			const liquidationBotWithOwner = liquidationBot.connect(owner);

			const tx = liquidationBotWithOwner.liquidateWithFlashLoan(
				borrower.address,
				fakeToken,
				USDC_ADDRESS,
				DEBT_TO_COVER
			);

			await expect(tx).to.be.rejected;
		});

		it("Should handle invalid debt asset", async () => {
			const fakeToken = hre.ethers.Wallet.createRandom().address;

			const liquidationBotWithOwner = liquidationBot.connect(owner);

			const tx = liquidationBotWithOwner.liquidateWithFlashLoan(
				borrower.address,
				WETH_ADDRESS,
				fakeToken,
				DEBT_TO_COVER
			);

			await expect(tx).to.be.rejected;
		});
	});

	describe("Gas Optimization", () => {
		it("withdrawProfits should be gas efficient", async () => {
			const profitAmount = hre.ethers.utils.parseUnits("1", 6);
			const usdcWithLender = usdc.connect(lender);
			await usdcWithLender.transfer(BOT_ADDRESS, profitAmount);

			const tx = await liquidationBot
				.connect(owner)
				.withdrawProfits(USDC_ADDRESS, profitAmount);

			const receipt = await tx.wait();
			console.log(`\n⛽ Gas used for withdrawal: ${receipt?.gasUsed}`);

			expect(receipt!.gasUsed).to.be.lessThan(100000n);
		});

		it("withdrawETH should be gas efficient", async () => {
			const ethAmount = hre.ethers.utils.parseUnits("0.1", 18);
			await owner.sendTransaction({
				to: BOT_ADDRESS,
				value: ethAmount,
			});

			const tx = await liquidationBot.connect(owner).withdrawETH();
			const receipt = await tx.wait();
			console.log(
				`⛽ Gas used for ETH withdrawal: ${receipt?.gasUsed}`
			);

			expect(receipt!.gasUsed).to.be.lessThan(50000n);
		});
	});

	describe("State Management", () => {
		it("Owner should remain unchanged", async () => {
			expect(await liquidationBot.owner()).to.equal(owner.address);
		});

		it("POOL address should remain unchanged", async () => {
			expect(await liquidationBot.POOL()).to.equal(POOL_PROXY_ADDRESS);
		});

		it("ADDRESS_PROVIDER should remain unchanged", async () => {
			expect(await liquidationBot.ADDRESSES_PROVIDER()).to.equal(
				ADDRESS_PROVIDER
			);
		});
	});

	describe("Integration Tests", () => {
		it("Should handle multiple profit withdrawals", async () => {
			const usdcWithLender = usdc.connect(lender);

			const amount1 = hre.ethers.utils.parseUnits("0.5", 6);
			await usdcWithLender.transfer(BOT_ADDRESS, amount1);
			await liquidationBot
				.connect(owner)
				.withdrawProfits(USDC_ADDRESS, amount1);

			const amount2 = hre.ethers.utils.parseUnits("0.5", 6);
			await usdcWithLender.transfer(BOT_ADDRESS, amount2);
			await liquidationBot
				.connect(owner)
				.withdrawProfits(USDC_ADDRESS, amount2);

			expect(true).to.be.true;
		});

		it("Should maintain correct state after failed operations", async () => {
			const liquidationBotWithOwner = liquidationBot.connect(owner);

			try {
				await liquidationBotWithOwner.liquidateWithFlashLoan(
					hre.ethers.ZeroAddress,
					WETH_ADDRESS,
					USDC_ADDRESS,
					DEBT_TO_COVER
				);
			} catch (error) {
				// Expected to fail
			}

			expect(await liquidationBot.owner()).to.equal(owner.address);
		});

		it("Full workflow: setup, borrow, and prepare for liquidation", async () => {
			// Verify all setup is complete
			const [totalCollateral, totalDebt, , , , healthFactor] =
				await pool.getUserAccountData(borrower.address);

			console.log(`\n✅ Full Integration Test Complete`);
			console.log(
				`   Borrower Collateral: ${hre.ether.utils.formatUnits(
					totalCollateral,
					8
				)}`
			);
			console.log(
				`   Borrower Debt: ${hre.ethers.utils.formatUnits(
					totalDebt,
					8
				)}`
			);
			console.log(
				`   Health Factor: ${hre.ethers.utils.formatUnits(
					healthFactor,
					18
				)}`
			);
			console.log(
				`   Bot Balance: ${hre.ethers.utils.formatUnits(
					await usdc.balanceOf(BOT_ADDRESS),
					6
				)} USDC\n`
			);

			expect(totalCollateral).to.be.greaterThan(0);
			expect(totalDebt).to.be.greaterThan(0);
			expect(healthFactor).to.be.greaterThan(0);
		});
	});
});
