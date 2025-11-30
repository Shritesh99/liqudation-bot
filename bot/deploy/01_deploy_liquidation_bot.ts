import { HardhatRuntimeEnvironment } from "hardhat/types/";
import { DeployFunction } from "hardhat-deploy/types";

const AAVE_ADDRESS_PROVIDER = process.env.AAVE_ADDRESS_POOL_PROVIDER;

const deployLiquidationBot: DeployFunction = async function (
	hre: HardhatRuntimeEnvironment
) {
	const { deployments, getNamedAccounts, ethers, network } = hre;
	const { deploy, log } = deployments;
	const { deployer } = await getNamedAccounts();

	log("\n" + "=".repeat(80));
	log("🚀 Deploying AaveV3LiquidationBot");
	log("=".repeat(80));

	log(`\n📍 Network: ${network.name}`);
	log(`💳 Deployer: ${deployer}`);
	log(`🏢 Aave Address Provider: ${AAVE_ADDRESS_PROVIDER}\n`);

	// Get gas price
	const gasPrice = await ethers.provider.getGasPrice();
	console.log(`⛽ Gas Price: ${gasPrice.toString()}\n`);

	// Check if contract already deployed
	const deployment = await deployments.getOrNull("AaveV3LiquidationBot");

	if (deployment) {
		log(
			"✅ AaveV3LiquidationBot already deployed at:",
			deployment.address
		);
		log("Skipping deployment...\n");
		return;
	}

	try {
		// Deploy LiquidationBot
		const deployResult = await deploy("AaveV3LiquidationBot", {
			from: deployer,
			args: [AAVE_ADDRESS_PROVIDER],
			log: true,
			deterministicDeployment: false,
			skipIfAlreadyDeployed: true,
		});

		log("\n✅ AaveV3LiquidationBot deployed successfully!");
		log(`📬 Contract Address: ${deployResult.address}`);
		log(`⛽ Gas Used: ${deployResult.receipt?.gasUsed}`);
		log(`🔗 Transaction Hash: ${deployResult.transactionHash}\n`);

		// Verify deployment
		const liquidationBot = await ethers.getContractAt(
			"AaveV3LiquidationBot",
			deployResult.address
		);

		log("📋 Contract Details:");
		log(`  AAVE Address Provider: ${AAVE_ADDRESS_PROVIDER}\n`);
		log(`  AaveV3LiquidationBot: ${liquidationBot.address}\n`);

		log("\n" + "=".repeat(80));
		log("✅ Deployment completed successfully!");
		log("=".repeat(80) + "\n");
	} catch (error) {
		log("\n❌ Deployment failed!");
		console.error(error);
		throw error;
	}
};

export default deployLiquidationBot;
