import hre from "hardhat";
import dotenv from "dotenv";

dotenv.config();

const POOL_ADDRESS = process.env.POOL_ADDRESS || "";
const WETH_ADDRESS = process.env.WETH_ADDRESS || "";
const USDC_ADDRESS = process.env.USDC_ADDRESS || "";
const FAUCET_ADDRESS = process.env.FAUCET || "";

interface BorrowerInfo {
	address: string;
	healthFactor: number;
	totalCollateral: number;
	totalDebt: number;
	canBeLiquidated: boolean;
}

interface LiquidationOpportunity {
	borrower: string;
	healthFactor: number;
	collateral: number;
	debt: number;
	potentialProfit: number;
}

class LiquidationBot {
	private deployer: any;
	private pool: any;
	private bot: any;
	private usdc: any;
	private botAddress: string;
	private provider: any;

	constructor(botAddress: string) {
		this.botAddress = botAddress;
	}

	async setup() {
		const signers = await hre.ethers.getSigners();
		this.deployer = signers[0];
		this.provider = hre.ethers.provider;

		console.log("Setting up bot...");
		console.log("Deployer:", this.deployer.address);

		this.pool = await hre.ethers.getContractAt("IPool", POOL_ADDRESS);
		this.bot = await hre.ethers.getContractAt(
			"AaveV3LiquidationBot",
			this.botAddress
		);
		this.usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS);

		console.log("Setup complete\n");
	}

	async getAllPoolInteractions(): Promise<string[]> {
		console.log("Fetching all borrowers from the pool...");

		const uniqueAddresses = new Set<string>();
		const currentBlockNumber = await this.provider.getBlockNumber();
		const batchSize = 1000;
		const lookbackBlocks = Math.min(10000, currentBlockNumber);
		const startBlock = Math.max(0, currentBlockNumber - lookbackBlocks);

		console.log(
			`Scanning blocks ${startBlock} to ${currentBlockNumber} for pool interactions\n`
		);

		try {
			const filter = this.pool.filters.Supply();

			const supplyLogs = await this.pool.queryFilter(
				filter,
				startBlock,
				currentBlockNumber
			);

			console.log("Fetched supply logs:", supplyLogs.length);
			for (const log of supplyLogs) {
				if (log.args && log.args[1]) {
					uniqueAddresses.add(log.args[1].toLowerCase());
				}
			}

			console.log(`Found ${supplyLogs.length} supply events`);
		} catch (error) {
			console.log("Could not fetch supply events:", error);
		}

		try {
			const filterBorrow = this.pool.filters.Borrow();
			const borrowLogs = await this.pool.queryFilter(
				filterBorrow,
				startBlock,
				currentBlockNumber
			);

			for (const log of borrowLogs) {
				if (log.args && log.args[1]) {
					uniqueAddresses.add(log.args[1].toLowerCase());
				}
			}

			console.log(`Found ${borrowLogs.length} borrow events`);
		} catch (error) {
			console.log("Could not fetch borrow events:", error);
		}

		try {
			const filterRepay = this.pool.filters.Repay();
			const repayLogs = await this.pool.queryFilter(
				filterRepay,
				startBlock,
				currentBlockNumber
			);

			for (const log of repayLogs) {
				if (log.args && log.args[1]) {
					uniqueAddresses.add(log.args[1].toLowerCase());
				}
			}

			console.log(`Found ${repayLogs.length} repay events`);
		} catch (error) {
			console.log("Could not fetch repay events:", error);
		}

		try {
			const filterWithdraw = this.pool.filters.Withdraw();
			const withdrawLogs = await this.pool.queryFilter(
				filterWithdraw,
				startBlock,
				currentBlockNumber
			);

			for (const log of withdrawLogs) {
				if (log.args && log.args[1]) {
					uniqueAddresses.add(log.args[1].toLowerCase());
				}
			}

			console.log(`Found ${withdrawLogs.length} withdraw events\n`);
		} catch (error) {
			console.log("Could not fetch withdraw events:", error);
		}

		return Array.from(uniqueAddresses);
	}

	async getBorrowerInfo(address: string): Promise<BorrowerInfo | null> {
		try {
			const [totalCollateral, totalDebt, , , , healthFactor] =
				await this.pool.getUserAccountData(address);

			const collateralInEth = parseFloat(
				hre.ethers.utils.formatUnits(totalCollateral, 18)
			);
			const debtInEth = parseFloat(
				hre.ethers.utils.formatUnits(totalDebt, 18)
			);
			const healthFactorNumber = parseFloat(
				hre.ethers.utils.formatUnits(healthFactor, 18)
			);

			const canBeLiquidated = healthFactorNumber < 1;

			if (debtInEth === 0) {
				return null;
			}

			return {
				address,
				healthFactor: healthFactorNumber,
				totalCollateral: collateralInEth,
				totalDebt: debtInEth,
				canBeLiquidated,
			};
		} catch (error) {
			return null;
		}
	}

	async monitorBorrowers(): Promise<LiquidationOpportunity[]> {
		console.log("Getting all borrowers from network...\n");

		let borrowerAddresses: string[] = [];

		try {
			borrowerAddresses = await this.getAllPoolInteractions();
		} catch (error) {
			console.log(
				"Could not get borrowers from network events, using test accounts"
			);
			const signers = await hre.ethers.getSigners();
			borrowerAddresses = signers.map((s) => s.address);
		}

		console.log(
			`Checking ${borrowerAddresses.length} addresses for opportunities...\n`
		);

		const opportunities: LiquidationOpportunity[] = [];
		let checkedCount = 0;

		for (const address of borrowerAddresses) {
			const info = await this.getBorrowerInfo(address);

			if (!info) {
				continue;
			}

			checkedCount++;

			console.log("Address:", address);
			console.log("Health Factor:", info.healthFactor.toFixed(4));
			console.log(
				"Collateral:",
				info.totalCollateral.toFixed(4),
				"ETH"
			);
			console.log("Debt:", info.totalDebt.toFixed(4), "ETH");

			if (info.canBeLiquidated) {
				const potentialProfit = info.totalDebt * 0.05 * 2000;
				opportunities.push({
					borrower: address,
					healthFactor: info.healthFactor,
					collateral: info.totalCollateral,
					debt: info.totalDebt,
					potentialProfit,
				});
				console.log("Status: CAN BE LIQUIDATED");
				console.log(
					"Potential Profit: $" + potentialProfit.toFixed(2)
				);
			} else {
				console.log("Status: Safe");
			}
			console.log("");

			if (checkedCount % 10 === 0) {
				console.log(
					`Checked ${checkedCount} addresses so far...\n`
				);
			}
		}

		console.log(`Checked ${checkedCount} total addresses\n`);

		return opportunities.sort(
			(a, b) => b.potentialProfit - a.potentialProfit
		);
	}

	async prepareBotForLiquidation(debtAmount: string): Promise<boolean> {
		console.log("Preparing bot for liquidation...");

		try {
			const botBalance = await this.usdc.balanceOf(this.botAddress);
			const debtInUsdc = hre.ethers.utils.parseUnits(debtAmount, 6);

			console.log(
				"Bot USDC balance:",
				hre.ethers.utils.formatUnits(botBalance, 6)
			);
			console.log("Debt to cover:", debtAmount, "USDC");

			if (botBalance < debtInUsdc) {
				console.log(
					"Bot balance too low, attempting to mint tokens..."
				);
				await this.mintTokensToBot();

				const newBalance = await this.usdc.balanceOf(
					this.botAddress
				);
				if (newBalance < debtInUsdc) {
					console.log("Failed to get enough balance");
					return false;
				}
			}

			const botEth = await hre.ethers.provider.getBalance(
				this.botAddress
			);
			const minimumEth = hre.ethers.utils.parseUnits("0.01", 18);

			if (botEth < minimumEth) {
				console.log("Sending ETH to bot for gas...");
				const tx = await this.deployer.sendTransaction({
					to: this.botAddress,
					value: hre.ethers.utils.parseUnits("0.5", 18),
				});
				await tx.wait();
			}

			console.log("Bot is ready\n");
			return true;
		} catch (error) {
			console.error("Error preparing bot:", error);
			return false;
		}
	}

	private async mintTokensToBot() {
		try {
			const faucet = await hre.ethers.getContractAt(
				[
					"function mint(address token, address to, uint256 amount) external",
				],
				FAUCET_ADDRESS
			);

			const amount = hre.ethers.utils.parseUnits("50000", 6);
			const tx = await faucet.mint(
				USDC_ADDRESS,
				this.botAddress,
				amount
			);
			await tx.wait();

			console.log("Minted 50000 USDC to bot");
		} catch (error) {
			console.error("Mint failed:", error);
		}
	}

	async executeLiquidation(
		borrower: string,
		debtToCover: string
	): Promise<boolean> {
		console.log("Executing liquidation...");
		console.log("Borrower:", borrower);
		console.log("Debt to cover:", debtToCover, "USDC\n");

		try {
			const debtInWei = hre.ethers.utils.parseUnits(debtToCover, 6);

			const tx = await this.bot.liquidateWithFlashLoan(
				borrower,
				WETH_ADDRESS,
				USDC_ADDRESS,
				debtInWei
			);

			console.log("Transaction sent:", tx.hash);
			const receipt = await tx.wait();

			if (receipt?.status === 1) {
				console.log("Liquidation successful!");
				console.log("Block:", receipt.blockNumber);
				console.log("Gas used:", receipt.gasUsed.toString(), "\n");

				await this.withdrawProfits();
				return true;
			} else {
				console.log("Liquidation failed (reverted)");
				return false;
			}
		} catch (error: any) {
			console.error("Liquidation error:", error.message || error);
			return false;
		}
	}

	private async withdrawProfits() {
		console.log("Withdrawing profits...");

		try {
			const balance = await this.usdc.balanceOf(this.botAddress);

			if (balance > 0) {
				const tx = await this.bot.withdrawAllProfits(USDC_ADDRESS);
				await tx.wait();

				console.log(
					"Withdrew",
					hre.ethers.utils.formatUnits(balance, 6),
					"USDC from bot"
				);
			}
		} catch (error) {
			console.error("Could not withdraw profits:", error);
		}
	}

	async start() {
		console.log("========================================");
		console.log("LIQUIDATION BOT STARTED");
		console.log("========================================\n");

		let checkCount = 0;

		const checkAndLiquidate = async () => {
			checkCount++;
			console.log(
				`Check ${checkCount} at ${new Date().toLocaleTimeString()}`
			);
			console.log("");

			const opportunities = await this.monitorBorrowers();

			if (opportunities.length === 0) {
				console.log("No liquidation opportunities found\n");
				return;
			}

			console.log(
				`Found ${opportunities.length} liquidation opportunity(ies)\n`
			);

			const best = opportunities[0];

			console.log("Best opportunity:");
			console.log("Borrower:", best.borrower);
			console.log("Health Factor:", best.healthFactor.toFixed(4));
			console.log(
				"Potential Profit: $" + best.potentialProfit.toFixed(2)
			);
			console.log("");

			const debtToCover = (best.debt * 0.5).toString();

			const isPrepared = await this.prepareBotForLiquidation(
				debtToCover
			);
			if (!isPrepared) {
				console.log("Could not prepare bot, skipping this cycle\n");
				return;
			}

			const isSuccess = await this.executeLiquidation(
				best.borrower,
				debtToCover
			);

			if (isSuccess) {
				console.log(
					"Cycle complete. Profit: $" +
						best.potentialProfit.toFixed(2)
				);
			} else {
				console.log("Cycle failed");
			}

			console.log("\n----------------------------------------\n");
		};

		await checkAndLiquidate();

		const intervalMs = parseInt(process.env.CHECK_INTERVAL || "60000");
		console.log(`Next check in ${intervalMs / 1000} seconds`);
		console.log("Press Ctrl+C to stop\n");

		setInterval(checkAndLiquidate, intervalMs);
	}
}

async function main() {
	const botAddress =
		process.env.BOT_ADDRESS ||
		"0xeD041d002B1976c642Aeb2d9b914d064339a23a6";

	const bot = new LiquidationBot(botAddress);
	await bot.setup();
	await bot.start();

	process.on("SIGINT", () => {
		console.log("\n\nShutting down...");
		process.exit(0);
	});
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
