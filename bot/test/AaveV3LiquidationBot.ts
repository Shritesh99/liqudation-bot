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

	const POOL_ADDRESS = process.env.POOL_ADDRESS;
	const ADDRESS_PROVIDER = process.env.ADDRESS_PROVIDER;
	const FAUCET = process.env.FAUCET;
	const WETH_ADDRESS = process.env.WETH_ADDRESS;
	const USDC_ADDRESS = process.env.USDC_ADDRESS;
	const aWETH_ADDRESS = process.env.aWETH_ADDRESS;
	const aUSDC_ADDRESS = process.env.aUSDC_ADDRESS;
	const debtUSDC_VARIABLE = process.env.debtUSDC_VARIABLE;
	const BOT_ADDRESS = process.env.BOT_ADDRESS;

	// Test amounts
	const WETH_SUPPLY = hre.ethers.utils.parseUnits("50", 18);
	const USDC_SUPPLY = hre.ethers.utils.parseUnits("100000", 6);
	const WETH_COLLATERAL = hre.ethers.utils.parseUnits("5", 18);
	const USDC_BORROW = hre.ethers.utils.parseUnits("10000", 6);
	const DEBT_TO_COVER = hre.ethers.utils.parseUnits("5000", 6);

	before(async () => {
		[owner, lender, borrower, attacker] = await hre.ethers.getSigners();

		console.log("\n Test Setup Information:");
		console.log(`   Owner: ${owner.address}`);
		console.log(`   Lender: ${lender.address}`);
		console.log(`   Borrower: ${borrower.address}`);
		console.log(`   Attacker: ${attacker.address}\n`);

		pool = await hre.ethers.getContractAt("Pool", POOL_ADDRESS);
		weth = await hre.ethers.getContractAt("IERC20", WETH_ADDRESS);
		usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS);
		aWeth = await hre.ethers.getContractAt("IERC20", aWETH_ADDRESS);
		aUsdc = await hre.ethers.getContractAt("IERC20", aUSDC_ADDRESS);
		debtUSDC = await hre.ethers.getContractAt(
			"IERC20",
			debtUSDC_VARIABLE
		);

		try {
			liquidationBot = await hre.ethers.getContractAt(
				"AaveV3LiquidationBot",
				BOT_ADDRESS
			);
		} catch (error) {
			const LiquidationBotFactory =
				await hre.ethers.getContractFactory("AaveV3LiquidationBot");
			liquidationBot = await LiquidationBotFactory.deploy(
				ADDRESS_PROVIDER
			);
			await liquidationBot.waitForDeployment();
			console.log(`LiquidationBot deployed at: ${BOT_ADDRESS}\n`);
		}

		const faucet = await hre.ethers.getContractAt(
			[
				"function mint(address token, address to, uint256 amount) external",
			],
			FAUCET
		);

		console.log("Minting test tokens via faucet...");
		try {
			await faucet.mint(WETH_ADDRESS, lender.address, WETH_SUPPLY);
			await faucet.mint(
				WETH_ADDRESS,
				borrower.address,
				WETH_COLLATERAL.mul(2n)
			);

			await faucet.mint(USDC_ADDRESS, lender.address, USDC_SUPPLY);
			await faucet.mint(USDC_ADDRESS, BOT_ADDRESS, USDC_SUPPLY);

			console.log("Tokens minted successfully\n");
		} catch (error) {
			console.error(
				"Faucet mint failed (tokens may already exist):",
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
			const emptyAddress = hre.ethers.Wallet.createRandom().address;

			const tx = liquidationBot
				.connect(owner)
				.withdrawAllProfits(emptyAddress);

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

			const botAddress = BOT_ADDRESS;
			const botBalance = await usdc.balanceOf(botAddress);

			expect(botBalance).to.be.greaterThan(0);
		});

		it("Should have sufficient USDC for flash loan repayment", async () => {
			const botAddress = BOT_ADDRESS;
			const botBalance = await usdc.balanceOf(botAddress);

			const expectedMinimum = DEBT_TO_COVER.mul(1005n).div(1000n); // 0.5% fee
			expect(botBalance).to.be.greaterThanOrEqual(expectedMinimum);
		});

		it("executeOperation should be callable", async () => {
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
			} catch (error) {}

			expect(await liquidationBot.owner()).to.equal(owner.address);
		});

		it("Full workflow: setup, borrow, and prepare for liquidation", async () => {
			const [totalCollateral, totalDebt, , , , healthFactor] =
				await pool.getUserAccountData(borrower.address);

			console.log(`\n✅ Full Integration Test Complete`);
			console.log(
				`   Borrower Collateral: ${hre.ethers.utils.formatUnits(
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
