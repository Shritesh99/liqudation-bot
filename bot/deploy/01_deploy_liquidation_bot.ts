import { HardhatRuntimeEnvironment } from "hardhat/types/";
import { DeployFunction } from "hardhat-deploy/types";

const AAVE_ADDRESS_PROVIDER = process.env.AAVE_ADDRESS_POOL_PROVIDER;

const deployLiquidationBot: DeployFunction = async function (
	hre: HardhatRuntimeEnvironment
) {
	const { deployments, getNamedAccounts, ethers, network } = hre;
	const { deploy, log } = deployments;
	const { deployer } = await getNamedAccounts();

	log(`\nNetwork: ${network.name}`);
	log(`Deployer: ${deployer}`);
	log(`Aave Address Provider: ${AAVE_ADDRESS_PROVIDER}\n`);

	const deployment = await deployments.getOrNull("AaveV3LiquidationBot");

	if (deployment) {
		log("AaveV3LiquidationBot already deployed at:", deployment.address);
		return;
	}

	try {
		const deployResult = await deploy("AaveV3LiquidationBot", {
			from: deployer,
			args: [AAVE_ADDRESS_PROVIDER],
			log: true,
			deterministicDeployment: false,
			skipIfAlreadyDeployed: true,
		});

		const liquidationBot = await ethers.getContractAt(
			"AaveV3LiquidationBot",
			deployResult.address
		);

		log("Contract Details:");
		log(`  AAVE Address Provider: ${AAVE_ADDRESS_PROVIDER}\n`);
		log(`  AaveV3LiquidationBot: ${liquidationBot.address}\n`);
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export default deployLiquidationBot;
