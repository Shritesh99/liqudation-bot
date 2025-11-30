import fs from "fs";
import path from "path";
import { HardhatNetworkForkingUserConfig } from "hardhat/types";

import { iParamsPerNetwork, eNetwork, eXrpNetwork } from "./types";

import dotenv from "dotenv";
dotenv.config();

export const DEFAULT_BLOCK_GAS_LIMIT = 21000000;

export const FORK = (process.env.FORK || "") as eNetwork;
export const FORK_BLOCK_NUMBER = process.env.FORK_BLOCK_NUMBER
	? parseInt(process.env.FORK_BLOCK_NUMBER)
	: 0;
const MNEMONIC_PATH = "m/44'/60'/0'/0";
const MNEMONIC = process.env.MNEMONIC || "";

export const NETWORKS_RPC_URL: iParamsPerNetwork<string> = {
	[eXrpNetwork.main]: `https://rpc.xrplevm.org`,
	[eXrpNetwork.testnet]: `https://rpc.testnet.xrplevm.org`,
};

export const buildForkConfig = ():
	| HardhatNetworkForkingUserConfig
	| undefined => {
	let forkMode: HardhatNetworkForkingUserConfig | undefined;
	if (FORK && NETWORKS_RPC_URL[FORK]) {
		forkMode = {
			url: NETWORKS_RPC_URL[FORK] as string,
		};
		if (FORK_BLOCK_NUMBER) {
			forkMode.blockNumber = FORK_BLOCK_NUMBER;
		}
	}
	return forkMode;
};

export const hardhatNetworkSettings = {
	gas: 12000000,
	gasPrice: 1000000000,
	initialBaseFeePerGas: "0",
	// blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
	throwOnTransactionFailures: true,
	throwOnCallFailures: true,
	chainId: 31337,
	forking: buildForkConfig(),
	saveDeployments: true,
	allowUnlimitedContractSize: true,
	tags: ["local"],
	accounts:
		FORK && !!MNEMONIC
			? {
					mnemonic: MNEMONIC,
					path: MNEMONIC_PATH,
					initialIndex: 0,
					count: 10,
			  }
			: undefined,
};

export const LIVE_NETWORKS: iParamsPerNetwork<boolean> = {
	[eXrpNetwork.main]: true,
};

const MNEMONICS: iParamsPerNetwork<string> = {
	[eXrpNetwork.main]: process.env.XRP_MNEMONIC,
	[eXrpNetwork.testnet]: process.env.XRP_TESTNET_MNEMONIC,
};

export const getCommonNetworkConfig = (
	networkName: eNetwork,
	chainId?: number
) => ({
	url: NETWORKS_RPC_URL[networkName] || "",
	// blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
	gas: DEFAULT_BLOCK_GAS_LIMIT,
	chainId,
	...((!!MNEMONICS[networkName] || !!MNEMONIC) && {
		accounts: {
			mnemonic: MNEMONICS[networkName] || MNEMONIC,
			path: MNEMONIC_PATH,
			initialIndex: 0,
			count: 10,
		},
	}),
	live: LIVE_NETWORKS[networkName] || false,
});
