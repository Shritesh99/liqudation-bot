import "hardhat-deploy";
import "@nomicfoundation/hardhat-toolbox";

import type { HardhatUserConfig } from "hardhat/config";

import {
	hardhatNetworkSettings,
	getCommonNetworkConfig,
} from "./helpers/hardhat-config-helpers";

import { eXrpNetwork } from "./helpers/types";

import { DEFAULT_NAMED_ACCOUNTS } from "./helpers/constants";

const config: HardhatUserConfig = {
	solidity: {
		compilers: [
			{
				version: "0.8.20",
				settings: {
					optimizer: { enabled: true, runs: 100_000 },
					evmVersion: "berlin",
				},
			},
		],
	},
	networks: {
		hardhat: hardhatNetworkSettings,
		localhost: {
			url: "http://127.0.0.1:8545",
			...hardhatNetworkSettings,
		},
		[eXrpNetwork.main]: getCommonNetworkConfig(eXrpNetwork.main, 1440000),
		[eXrpNetwork.testnet]: getCommonNetworkConfig(
			eXrpNetwork.testnet,
			1449000
		),
	},
	typechain: {
		outDir: "typechain",
		target: "ethers-v5",
	},
	namedAccounts: {
		...DEFAULT_NAMED_ACCOUNTS,
	},
	mocha: {
		timeout: 0,
	},
};
export default config;
